import { NextResponse } from 'next/server';
import { db, products, productVariants, skuMappings, skuCategories } from '@/db';
import { eq, isNull, and, like } from 'drizzle-orm';
import { generateSkuSuggestions } from '@/lib/sku-generator';

// GET /api/skus - Get SKU mappings and suggestions
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    if (action === 'missing') {
      // Get variants missing SKUs with suggestions
      const variants = await db.select({
        shopifyId: productVariants.shopifyId,
        variantTitle: productVariants.title,
        currentSku: productVariants.shopifySku,
        productTitle: products.title,
        price: productVariants.price,
        inventoryQuantity: productVariants.inventoryQuantity,
      })
        .from(productVariants)
        .leftJoin(products, eq(productVariants.productId, products.id));

      // Filter to only missing SKUs
      const missingSkuVariants = variants.filter(v => !v.currentSku || v.currentSku.trim() === '');

      // Get existing SKUs for uniqueness check
      const existingSkus = new Set(
        variants
          .filter(v => v.currentSku && v.currentSku.trim() !== '')
          .map(v => v.currentSku!)
      );

      // Generate suggestions
      const suggestions = generateSkuSuggestions(
        missingSkuVariants.map(v => ({
          shopifyId: v.shopifyId,
          productTitle: v.productTitle || '',
          variantTitle: v.variantTitle,
          currentSku: v.currentSku,
        })),
        existingSkus
      );

      return NextResponse.json({
        total: missingSkuVariants.length,
        suggestions,
      });
    }

    if (action === 'duplicates') {
      // Find duplicate SKUs
      const variants = await db.select({
        shopifyId: productVariants.shopifyId,
        variantTitle: productVariants.title,
        shopifySku: productVariants.shopifySku,
        productTitle: products.title,
      })
        .from(productVariants)
        .leftJoin(products, eq(productVariants.productId, products.id));

      const skuCounts = new Map<string, typeof variants>();

      for (const v of variants) {
        if (v.shopifySku && v.shopifySku.trim() !== '') {
          if (!skuCounts.has(v.shopifySku)) {
            skuCounts.set(v.shopifySku, []);
          }
          skuCounts.get(v.shopifySku)!.push(v);
        }
      }

      const duplicates = Array.from(skuCounts.entries())
        .filter(([, items]) => items.length > 1)
        .map(([sku, items]) => ({ sku, count: items.length, variants: items }));

      return NextResponse.json({
        totalDuplicates: duplicates.length,
        duplicates,
      });
    }

    // Default: return all SKU mappings
    const mappings = await db.select().from(skuMappings);
    return NextResponse.json({ mappings });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/skus - Create or update SKU mapping
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shopifyVariantId, generatedSku, customSku, productTitle, variantTitle, categoryId } = body;

    if (!shopifyVariantId || !generatedSku) {
      return NextResponse.json(
        { error: 'shopifyVariantId and generatedSku are required' },
        { status: 400 }
      );
    }

    // Get original SKU from variant
    const variant = await db.select()
      .from(productVariants)
      .where(eq(productVariants.shopifyId, shopifyVariantId))
      .limit(1);

    const originalSku = variant[0]?.shopifySku || null;

    // Upsert mapping
    const existing = await db.select()
      .from(skuMappings)
      .where(eq(skuMappings.shopifyVariantId, shopifyVariantId))
      .limit(1);

    if (existing.length > 0) {
      await db.update(skuMappings)
        .set({
          generatedSku,
          customSku,
          originalSku,
          productTitle,
          variantTitle,
          categoryId,
          updatedAt: new Date(),
        })
        .where(eq(skuMappings.shopifyVariantId, shopifyVariantId));
    } else {
      await db.insert(skuMappings).values({
        shopifyVariantId,
        originalSku,
        generatedSku,
        customSku,
        productTitle,
        variantTitle,
        categoryId,
      });
    }

    // Also update the variant's generated/custom SKU
    await db.update(productVariants)
      .set({
        generatedSku,
        customSku,
        updatedAt: new Date(),
      })
      .where(eq(productVariants.shopifyId, shopifyVariantId));

    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/skus/bulk - Bulk generate and save SKUs for missing items
export async function PUT(request: Request) {
  try {
    // Get all variants missing SKUs
    const variants = await db.select({
      shopifyId: productVariants.shopifyId,
      variantTitle: productVariants.title,
      currentSku: productVariants.shopifySku,
      productTitle: products.title,
    })
      .from(productVariants)
      .leftJoin(products, eq(productVariants.productId, products.id));

    const missingSkuVariants = variants.filter(v => !v.currentSku || v.currentSku.trim() === '');

    const existingSkus = new Set(
      variants
        .filter(v => v.currentSku && v.currentSku.trim() !== '')
        .map(v => v.currentSku!)
    );

    const suggestions = generateSkuSuggestions(
      missingSkuVariants.map(v => ({
        shopifyId: v.shopifyId,
        productTitle: v.productTitle || '',
        variantTitle: v.variantTitle,
        currentSku: v.currentSku,
      })),
      existingSkus
    );

    // Save all generated SKUs
    let saved = 0;
    for (const suggestion of suggestions) {
      await db.update(productVariants)
        .set({ generatedSku: suggestion.suggestedSku })
        .where(eq(productVariants.shopifyId, suggestion.shopifyVariantId));

      // Also create mapping
      const existing = await db.select()
        .from(skuMappings)
        .where(eq(skuMappings.shopifyVariantId, suggestion.shopifyVariantId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(skuMappings).values({
          shopifyVariantId: suggestion.shopifyVariantId,
          originalSku: suggestion.currentSku,
          generatedSku: suggestion.suggestedSku,
          productTitle: suggestion.productTitle,
          variantTitle: suggestion.variantTitle,
        });
      }

      saved++;
    }

    return NextResponse.json({
      success: true,
      generated: saved,
    });

  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

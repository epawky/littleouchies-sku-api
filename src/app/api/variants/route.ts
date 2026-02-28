import { NextResponse } from 'next/server';
import { db, products, productVariants } from '@/db';
import { eq, isNull, and, or, like, desc } from 'drizzle-orm';

// GET /api/variants - List variants with filtering options
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const missingSku = searchParams.get('missing_sku') === 'true';
  const search = searchParams.get('search');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    let baseQuery = db.select({
      id: productVariants.id,
      shopifyId: productVariants.shopifyId,
      productId: productVariants.productId,
      title: productVariants.title,
      shopifySku: productVariants.shopifySku,
      generatedSku: productVariants.generatedSku,
      customSku: productVariants.customSku,
      price: productVariants.price,
      inventoryQuantity: productVariants.inventoryQuantity,
      option1: productVariants.option1,
      option2: productVariants.option2,
      option3: productVariants.option3,
      productTitle: products.title,
      productType: products.productType,
    })
      .from(productVariants)
      .leftJoin(products, eq(productVariants.productId, products.id))
      .orderBy(desc(productVariants.updatedAt))
      .limit(limit)
      .offset(offset);

    const result = await baseQuery;

    // Apply filters in memory (for complex conditions)
    let filtered = result;

    if (missingSku) {
      filtered = filtered.filter(v => !v.shopifySku || v.shopifySku.trim() === '');
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(v =>
        v.productTitle?.toLowerCase().includes(searchLower) ||
        v.title?.toLowerCase().includes(searchLower) ||
        v.shopifySku?.toLowerCase().includes(searchLower)
      );
    }

    // Calculate stats
    const allVariants = await db.select().from(productVariants);
    const totalVariants = allVariants.length;
    const missingSkuCount = allVariants.filter(v => !v.shopifySku || v.shopifySku.trim() === '').length;
    const withSkuCount = totalVariants - missingSkuCount;

    return NextResponse.json({
      variants: filtered,
      total: filtered.length,
      stats: {
        totalVariants,
        withSku: withSkuCount,
        missingSku: missingSkuCount,
      },
      limit,
      offset,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PATCH /api/variants - Update variant SKU
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { shopifyId, customSku, generatedSku } = body;

    if (!shopifyId) {
      return NextResponse.json({ error: 'shopifyId is required' }, { status: 400 });
    }

    const updateData: Record<string, string> = {};
    if (customSku !== undefined) updateData.customSku = customSku;
    if (generatedSku !== undefined) updateData.generatedSku = generatedSku;

    await db.update(productVariants)
      .set(updateData)
      .where(eq(productVariants.shopifyId, shopifyId));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

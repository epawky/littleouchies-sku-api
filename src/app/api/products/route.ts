import { NextResponse } from 'next/server';
import { db, products, productVariants } from '@/db';
import { eq, like, isNull, desc } from 'drizzle-orm';

// GET /api/products - List all products with variants
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const missingSku = searchParams.get('missing_sku') === 'true';
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    let query = db.select({
      product: products,
      variant: productVariants,
    })
      .from(products)
      .leftJoin(productVariants, eq(products.id, productVariants.productId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(products.updatedAt));

    const result = await query;

    // Group variants by product
    const productsMap = new Map<number, {
      product: typeof products.$inferSelect;
      variants: Array<typeof productVariants.$inferSelect>;
    }>();

    for (const row of result) {
      if (!row.product) continue;

      if (!productsMap.has(row.product.id)) {
        productsMap.set(row.product.id, {
          product: row.product,
          variants: [],
        });
      }

      if (row.variant) {
        // Apply filters
        if (missingSku && row.variant.shopifySku) continue;
        if (search && !row.product.title.toLowerCase().includes(search.toLowerCase())) continue;

        productsMap.get(row.product.id)!.variants.push(row.variant);
      }
    }

    const productsList = Array.from(productsMap.values());

    return NextResponse.json({
      products: productsList,
      total: productsList.length,
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

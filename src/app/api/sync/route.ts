import { NextResponse } from 'next/server';
import { db, products, productVariants, orders, orderLineItems, syncLogs } from '@/db';
import { shopifyGraphQL, PRODUCTS_QUERY, ORDERS_QUERY, extractGid } from '@/lib/shopify';
import { eq } from 'drizzle-orm';

// TypeScript interfaces for Shopify data - defined at top to avoid circular reference
interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  vendor: string;
  productType: string;
  handle: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  variants: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        sku: string;
        barcode: string;
        price: string;
        compareAtPrice: string;
        inventoryQuantity: number;
        inventoryItem: { id: string };
        selectedOptions: Array<{ name: string; value: string }>;
        createdAt: string;
        updatedAt: string;
      };
    }>;
  };
}

interface ShopifyOrder {
  id: string;
  name: string;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  subtotalPriceSet: { shopMoney: { amount: string } };
  totalTaxSet: { shopMoney: { amount: string } };
  totalDiscountsSet: { shopMoney: { amount: string } };
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  shippingAddress: { city: string; province: string; country: string } | null;
  processedAt: string;
  createdAt: string;
  updatedAt: string;
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        variantTitle: string;
        sku: string;
        quantity: number;
        originalUnitPriceSet: { shopMoney: { amount: string } };
        product: { id: string } | null;
        variant: { id: string } | null;
      };
    }>;
  };
}

interface ProductsResponse {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string };
    edges: Array<{ node: ShopifyProduct }>;
  };
}

interface OrdersResponse {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string };
    edges: Array<{ node: ShopifyOrder }>;
  };
}

// POST /api/sync - Trigger a full sync from Shopify
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';

  try {
    const results: Record<string, { processed: number; errors: string[] }> = {};

    if (type === 'all' || type === 'products') {
      results.products = await syncProducts();
    }

    if (type === 'all' || type === 'orders') {
      results.orders = await syncOrders();
    }

    // Log the sync
    await db.insert(syncLogs).values({
      entityType: type,
      status: 'completed',
      recordsProcessed: Object.values(results).reduce((sum, r) => sum + r.processed, 0),
      errors: JSON.stringify(Object.values(results).flatMap(r => r.errors)),
      completedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await db.insert(syncLogs).values({
      entityType: type,
      status: 'failed',
      errors: errorMessage,
      completedAt: new Date(),
    });

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

// GET /api/sync - Get sync status/history
export async function GET() {
  const logs = await db.select().from(syncLogs).orderBy(syncLogs.id).limit(20);
  return NextResponse.json(logs);
}

async function syncProducts() {
  const result = { processed: 0, errors: [] as string[] };
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const data: ProductsResponse = await shopifyGraphQL<ProductsResponse>(PRODUCTS_QUERY, { first: 50, after: cursor });

    for (const edge of data.products.edges) {
      try {
        await syncProduct(edge.node);
        result.processed++;
      } catch (error) {
        result.errors.push(`Product ${edge.node.title}: ${error}`);
      }
    }

    hasMore = data.products.pageInfo.hasNextPage;
    cursor = hasMore ? data.products.pageInfo.endCursor : null;
  }

  return result;
}

async function syncProduct(node: ShopifyProduct) {
  const shopifyId = extractGid(node.id);

  // Upsert product
  const existing = await db.select().from(products).where(eq(products.shopifyId, shopifyId)).limit(1);

  let productId: number;

  if (existing.length > 0) {
    await db.update(products)
      .set({
        title: node.title,
        description: node.description,
        vendor: node.vendor,
        productType: node.productType,
        handle: node.handle,
        status: node.status,
        updatedAt: new Date(node.updatedAt),
        syncedAt: new Date(),
      })
      .where(eq(products.shopifyId, shopifyId));
    productId = existing[0].id;
  } else {
    const inserted = await db.insert(products)
      .values({
        shopifyId,
        title: node.title,
        description: node.description,
        vendor: node.vendor,
        productType: node.productType,
        handle: node.handle,
        status: node.status,
        createdAt: new Date(node.createdAt),
        updatedAt: new Date(node.updatedAt),
        syncedAt: new Date(),
      })
      .returning({ id: products.id });
    productId = inserted[0].id;
  }

  // Sync variants
  for (const variantEdge of node.variants.edges) {
    const variant = variantEdge.node;
    const variantShopifyId = extractGid(variant.id);

    const existingVariant = await db.select()
      .from(productVariants)
      .where(eq(productVariants.shopifyId, variantShopifyId))
      .limit(1);

    const options = variant.selectedOptions || [];

    if (existingVariant.length > 0) {
      await db.update(productVariants)
        .set({
          title: variant.title,
          shopifySku: variant.sku,
          barcode: variant.barcode,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          inventoryQuantity: variant.inventoryQuantity,
          inventoryItemId: variant.inventoryItem?.id ? extractGid(variant.inventoryItem.id) : null,
          option1: options[0]?.value,
          option2: options[1]?.value,
          option3: options[2]?.value,
          updatedAt: new Date(variant.updatedAt),
        })
        .where(eq(productVariants.shopifyId, variantShopifyId));
    } else {
      await db.insert(productVariants).values({
        shopifyId: variantShopifyId,
        productId,
        title: variant.title,
        shopifySku: variant.sku,
        barcode: variant.barcode,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        inventoryQuantity: variant.inventoryQuantity,
        inventoryItemId: variant.inventoryItem?.id ? extractGid(variant.inventoryItem.id) : null,
        option1: options[0]?.value,
        option2: options[1]?.value,
        option3: options[2]?.value,
        createdAt: new Date(variant.createdAt),
        updatedAt: new Date(variant.updatedAt),
      });
    }
  }
}

async function syncOrders() {
  const result = { processed: 0, errors: [] as string[] };
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const data: OrdersResponse = await shopifyGraphQL<OrdersResponse>(ORDERS_QUERY, { first: 50, after: cursor });

    for (const edge of data.orders.edges) {
      try {
        await syncOrder(edge.node);
        result.processed++;
      } catch (error) {
        result.errors.push(`Order ${edge.node.name}: ${error}`);
      }
    }

    hasMore = data.orders.pageInfo.hasNextPage;
    cursor = hasMore ? data.orders.pageInfo.endCursor : null;
  }

  return result;
}

async function syncOrder(node: ShopifyOrder) {
  const shopifyId = extractGid(node.id);

  const existing = await db.select().from(orders).where(eq(orders.shopifyId, shopifyId)).limit(1);

  let orderId: number;

  const orderData = {
    shopifyId,
    orderNumber: node.name.replace('#', ''),
    name: node.name,
    totalPrice: node.totalPriceSet.shopMoney.amount,
    subtotalPrice: node.subtotalPriceSet.shopMoney.amount,
    totalTax: node.totalTaxSet.shopMoney.amount,
    totalDiscounts: node.totalDiscountsSet.shopMoney.amount,
    currency: node.totalPriceSet.shopMoney.currencyCode,
    financialStatus: node.displayFinancialStatus,
    fulfillmentStatus: node.displayFulfillmentStatus,
    shippingCity: node.shippingAddress?.city,
    shippingProvince: node.shippingAddress?.province,
    shippingCountry: node.shippingAddress?.country,
    processedAt: node.processedAt ? new Date(node.processedAt) : null,
    updatedAt: new Date(node.updatedAt),
    syncedAt: new Date(),
  };

  if (existing.length > 0) {
    await db.update(orders).set(orderData).where(eq(orders.shopifyId, shopifyId));
    orderId = existing[0].id;
  } else {
    const inserted = await db.insert(orders)
      .values({ ...orderData, createdAt: new Date(node.createdAt) })
      .returning({ id: orders.id });
    orderId = inserted[0].id;
  }

  // Sync line items
  for (const itemEdge of node.lineItems.edges) {
    const item = itemEdge.node;
    const itemShopifyId = extractGid(item.id);

    const existingItem = await db.select()
      .from(orderLineItems)
      .where(eq(orderLineItems.shopifyId, itemShopifyId))
      .limit(1);

    if (existingItem.length === 0) {
      await db.insert(orderLineItems).values({
        shopifyId: itemShopifyId,
        orderId,
        productId: item.product?.id ? extractGid(item.product.id) : null,
        variantId: item.variant?.id ? extractGid(item.variant.id) : null,
        title: item.title,
        variantTitle: item.variantTitle,
        sku: item.sku,
        quantity: item.quantity,
        price: item.originalUnitPriceSet.shopMoney.amount,
      });
    }
  }
}


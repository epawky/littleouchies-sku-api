import { NextResponse } from 'next/server';
import { shopifyGraphQL, ORDERS_QUERY, extractGid } from '@/lib/shopify';
import {
  getOdooConfig,
  authenticate,
  getOrCreateCustomer,
  getProductBySku,
  findSaleOrderByRef,
  createSaleOrder,
  confirmSaleOrder,
} from '@/lib/odoo';
import { db, odooProductMappings } from '@/db';
import { eq } from 'drizzle-orm';

interface ShopifyCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

interface ShopifyAddress {
  firstName: string;
  lastName: string;
  address1: string;
  address2: string | null;
  city: string;
  province: string;
  provinceCode: string;
  zip: string;
  country: string;
  countryCodeV2: string;
  phone: string | null;
}

interface ShopifyOrder {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  subtotalPriceSet: { shopMoney: { amount: string } };
  totalTaxSet: { shopMoney: { amount: string } };
  totalDiscountsSet: { shopMoney: { amount: string } };
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  customer: ShopifyCustomer | null;
  shippingAddress: ShopifyAddress | null;
  billingAddress: ShopifyAddress | null;
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

interface OrdersResponse {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string };
    edges: Array<{ node: ShopifyOrder }>;
  };
}

interface SyncResult {
  synced: number;
  skipped: number;
  errors: string[];
  details: Array<{
    shopifyOrderName: string;
    odooOrderId?: number;
    status: 'created' | 'skipped' | 'error';
    reason?: string;
  }>;
}

// POST /api/sync/odoo-orders - Sync Shopify orders to Odoo as Sales Orders
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || 'fulfillment_status:unfulfilled';
  const autoConfirm = searchParams.get('confirm') !== 'false';
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  try {
    const result = await syncOrdersToOdoo(query, limit, autoConfirm);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

// GET /api/sync/odoo-orders - Preview orders that would be synced
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') || 'fulfillment_status:unfulfilled';
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  try {
    const orders = await fetchShopifyOrders(query, limit);

    // Check which ones already exist in Odoo
    const config = getOdooConfig();
    const uid = await authenticate(config);

    const preview = [];
    for (const order of orders) {
      const existing = await findSaleOrderByRef(config, uid, `SHOPIFY-${order.name}`);
      preview.push({
        shopifyOrderName: order.name,
        customerName: getCustomerName(order),
        email: order.email || order.customer?.email,
        totalPrice: order.totalPriceSet.shopMoney.amount,
        financialStatus: order.displayFinancialStatus,
        fulfillmentStatus: order.displayFulfillmentStatus,
        lineItemCount: order.lineItems.edges.length,
        existsInOdoo: !!existing,
        odooOrderName: existing?.name,
      });
    }

    return NextResponse.json({
      success: true,
      count: orders.length,
      orders: preview,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

async function fetchShopifyOrders(query: string, limit: number): Promise<ShopifyOrder[]> {
  const allOrders: ShopifyOrder[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore && allOrders.length < limit) {
    const batchSize = Math.min(50, limit - allOrders.length);
    const data: OrdersResponse = await shopifyGraphQL<OrdersResponse>(
      ORDERS_QUERY,
      { first: batchSize, after: cursor, query }
    );

    for (const edge of data.orders.edges) {
      allOrders.push(edge.node);
    }

    hasMore = data.orders.pageInfo.hasNextPage;
    cursor = hasMore ? data.orders.pageInfo.endCursor : null;
  }

  return allOrders;
}

function getCustomerName(order: ShopifyOrder): string {
  if (order.customer?.firstName || order.customer?.lastName) {
    return `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim();
  }
  if (order.shippingAddress?.firstName || order.shippingAddress?.lastName) {
    return `${order.shippingAddress.firstName || ''} ${order.shippingAddress.lastName || ''}`.trim();
  }
  if (order.billingAddress?.firstName || order.billingAddress?.lastName) {
    return `${order.billingAddress.firstName || ''} ${order.billingAddress.lastName || ''}`.trim();
  }
  return order.email || 'Unknown Customer';
}

async function syncOrdersToOdoo(query: string, limit: number, autoConfirm: boolean): Promise<SyncResult> {
  const result: SyncResult = {
    synced: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  // Fetch orders from Shopify
  const orders = await fetchShopifyOrders(query, limit);

  if (orders.length === 0) {
    return result;
  }

  // Authenticate with Odoo
  const config = getOdooConfig();
  const uid = await authenticate(config);

  // Process each order
  for (const order of orders) {
    const externalRef = `SHOPIFY-${order.name}`;

    try {
      // Check if order already exists in Odoo
      const existingOrder = await findSaleOrderByRef(config, uid, externalRef);
      if (existingOrder) {
        result.skipped++;
        result.details.push({
          shopifyOrderName: order.name,
          odooOrderId: existingOrder.id,
          status: 'skipped',
          reason: `Already exists as ${existingOrder.name}`,
        });
        continue;
      }

      // Get or create customer
      const customerName = getCustomerName(order);
      const address = order.shippingAddress || order.billingAddress;

      const partnerId = await getOrCreateCustomer(config, uid, {
        name: customerName,
        email: order.email || order.customer?.email || undefined,
        phone: order.phone || order.customer?.phone || address?.phone || undefined,
        street: address?.address1,
        street2: address?.address2 || undefined,
        city: address?.city,
        state: address?.province || address?.provinceCode,
        zip: address?.zip,
        country: address?.country || address?.countryCodeV2,
      });

      // Process line items and match products by SKU
      const orderLines: Array<{
        productId: number;
        quantity: number;
        priceUnit: number;
        description?: string;
      }> = [];

      const unmatchedSkus: string[] = [];

      for (const itemEdge of order.lineItems.edges) {
        const item = itemEdge.node;

        if (!item.sku) {
          unmatchedSkus.push(`${item.title} (no SKU)`);
          continue;
        }

        // First check the mapping table
        const mapping = await db.select()
          .from(odooProductMappings)
          .where(eq(odooProductMappings.shopifySku, item.sku))
          .limit(1);

        let odooProductId: number | null = null;

        if (mapping.length > 0) {
          // Found in mapping table
          odooProductId = mapping[0].odooProductId;
        } else {
          // Fallback: Try direct SKU lookup in Odoo
          const odooProduct = await getProductBySku(config, uid, item.sku);
          if (odooProduct) {
            odooProductId = odooProduct.id;
          }
        }

        if (!odooProductId) {
          unmatchedSkus.push(item.sku);
          continue;
        }

        orderLines.push({
          productId: odooProductId,
          quantity: item.quantity,
          priceUnit: parseFloat(item.originalUnitPriceSet.shopMoney.amount),
          description: item.variantTitle
            ? `${item.title} - ${item.variantTitle}`
            : item.title,
        });
      }

      if (orderLines.length === 0) {
        result.errors.push(`${order.name}: No matching products found in Odoo (SKUs: ${unmatchedSkus.join(', ')})`);
        result.details.push({
          shopifyOrderName: order.name,
          status: 'error',
          reason: `No matching products (${unmatchedSkus.length} unmatched)`,
        });
        continue;
      }

      // Create Sales Order in Odoo with matching order name
      const orderId = await createSaleOrder(config, uid, {
        partnerId,
        externalRef,
        orderName: order.name, // Match Shopify order number (e.g., "#26230")
        orderDate: order.processedAt || order.createdAt,
        notes: unmatchedSkus.length > 0
          ? `Note: ${unmatchedSkus.length} item(s) not found in Odoo: ${unmatchedSkus.join(', ')}`
          : undefined,
        lines: orderLines,
      });

      // Optionally confirm the order
      if (autoConfirm) {
        try {
          await confirmSaleOrder(config, uid, orderId);
        } catch (confirmError) {
          // Order created but confirmation failed - still count as success
          console.warn(`Order ${order.name} created but confirmation failed:`, confirmError);
        }
      }

      result.synced++;
      result.details.push({
        shopifyOrderName: order.name,
        odooOrderId: orderId,
        status: 'created',
        reason: unmatchedSkus.length > 0
          ? `Created with ${orderLines.length} items (${unmatchedSkus.length} unmatched)`
          : undefined,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`${order.name}: ${errorMessage}`);
      result.details.push({
        shopifyOrderName: order.name,
        status: 'error',
        reason: errorMessage,
      });
    }
  }

  return result;
}

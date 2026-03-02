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

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

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
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  } | null;
  shippingAddress: ShopifyAddress | null;
  billingAddress: ShopifyAddress | null;
  processedAt: string;
  createdAt: string;
  lineItems: {
    edges: Array<{
      node: {
        title: string;
        variantTitle: string;
        sku: string;
        quantity: number;
        originalUnitPriceSet: { shopMoney: { amount: string } };
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

export async function GET(request: Request) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncRecentOrders();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cron sync error:', errorMessage);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

async function syncRecentOrders() {
  // Fetch recent unfulfilled orders from Shopify
  const query = 'fulfillment_status:unfulfilled';
  const data: OrdersResponse = await shopifyGraphQL<OrdersResponse>(
    ORDERS_QUERY,
    { first: 50, query }
  );

  const orders = data.orders.edges.map(e => e.node);

  if (orders.length === 0) {
    return { synced: 0, skipped: 0, errors: [] };
  }

  // Authenticate with Odoo
  const config = getOdooConfig();
  const uid = await authenticate(config);

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const order of orders) {
    const externalRef = `SHOPIFY-${order.name}`;

    try {
      // Skip if already exists
      const existing = await findSaleOrderByRef(config, uid, externalRef);
      if (existing) {
        skipped++;
        continue;
      }

      // Get customer name
      const customerName = order.customer?.firstName
        ? `${order.customer.firstName} ${order.customer.lastName}`.trim()
        : order.shippingAddress?.firstName
        ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`.trim()
        : order.email || 'Unknown Customer';

      const address = order.shippingAddress || order.billingAddress;

      // Create/find customer
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

      // Match line items
      const orderLines: Array<{
        productId: number;
        quantity: number;
        priceUnit: number;
        description?: string;
      }> = [];

      for (const itemEdge of order.lineItems.edges) {
        const item = itemEdge.node;
        if (!item.sku) continue;

        const odooProduct = await getProductBySku(config, uid, item.sku);
        if (!odooProduct) continue;

        orderLines.push({
          productId: odooProduct.id,
          quantity: item.quantity,
          priceUnit: parseFloat(item.originalUnitPriceSet.shopMoney.amount),
          description: item.variantTitle ? `${item.title} - ${item.variantTitle}` : item.title,
        });
      }

      if (orderLines.length === 0) {
        errors.push(`${order.name}: No matching products`);
        continue;
      }

      // Create and confirm order
      const orderId = await createSaleOrder(config, uid, {
        partnerId,
        externalRef,
        orderDate: order.processedAt || order.createdAt,
        lines: orderLines,
      });

      await confirmSaleOrder(config, uid, orderId);
      synced++;

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${order.name}: ${msg}`);
    }
  }

  return { synced, skipped, errors };
}

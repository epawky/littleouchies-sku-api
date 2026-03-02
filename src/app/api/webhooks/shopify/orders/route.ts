import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getOdooConfig,
  authenticate,
  getOrCreateCustomer,
  getProductBySku,
  findSaleOrderByRef,
  createSaleOrder,
  confirmSaleOrder,
} from '@/lib/odoo';

const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

interface ShopifyWebhookOrder {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  processed_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  } | null;
  shipping_address: {
    first_name: string;
    last_name: string;
    address1: string;
    address2: string | null;
    city: string;
    province: string;
    province_code: string;
    zip: string;
    country: string;
    country_code: string;
    phone: string | null;
  } | null;
  billing_address: {
    first_name: string;
    last_name: string;
    address1: string;
    address2: string | null;
    city: string;
    province: string;
    province_code: string;
    zip: string;
    country: string;
    country_code: string;
  } | null;
  line_items: Array<{
    id: number;
    title: string;
    variant_title: string | null;
    sku: string | null;
    quantity: number;
    price: string;
  }>;
}

// Verify Shopify webhook signature
function verifyWebhook(body: string, hmacHeader: string | null): boolean {
  if (!SHOPIFY_WEBHOOK_SECRET || !hmacHeader) {
    console.warn('Webhook verification skipped - no secret configured');
    return true; // Allow in development
  }

  const hash = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(body, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}

export async function POST(request: Request) {
  const body = await request.text();
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
  const topic = request.headers.get('x-shopify-topic');

  // Verify webhook signature
  if (!verifyWebhook(body, hmacHeader)) {
    console.error('Webhook verification failed');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse the order data
  let order: ShopifyWebhookOrder;
  try {
    order = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log(`Webhook received: ${topic} - Order ${order.name}`);

  try {
    const result = await syncOrderToOdoo(order);
    return NextResponse.json({
      success: true,
      order: order.name,
      ...result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Webhook error for order ${order.name}:`, errorMessage);
    // Return 200 to prevent Shopify from retrying (we log the error)
    return NextResponse.json({
      success: false,
      order: order.name,
      error: errorMessage,
    });
  }
}

async function syncOrderToOdoo(order: ShopifyWebhookOrder) {
  const externalRef = `SHOPIFY-${order.name}`;

  // Authenticate with Odoo
  const config = getOdooConfig();
  const uid = await authenticate(config);

  // Check if order already exists
  const existing = await findSaleOrderByRef(config, uid, externalRef);
  if (existing) {
    return { status: 'skipped', reason: 'Order already exists in Odoo' };
  }

  // Get customer name
  const customerName = order.customer?.first_name
    ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
    : order.shipping_address?.first_name
    ? `${order.shipping_address.first_name} ${order.shipping_address.last_name}`.trim()
    : order.email || 'Unknown Customer';

  const address = order.shipping_address || order.billing_address;

  // Create/find customer
  const partnerId = await getOrCreateCustomer(config, uid, {
    name: customerName,
    email: order.email || order.customer?.email || undefined,
    phone: order.phone || order.customer?.phone || order.shipping_address?.phone || undefined,
    street: address?.address1,
    street2: address?.address2 || undefined,
    city: address?.city,
    state: address?.province || address?.province_code,
    zip: address?.zip,
    country: address?.country || address?.country_code,
  });

  // Match line items to Odoo products
  const orderLines: Array<{
    productId: number;
    quantity: number;
    priceUnit: number;
    description?: string;
  }> = [];

  const unmatchedSkus: string[] = [];

  for (const item of order.line_items) {
    if (!item.sku) {
      unmatchedSkus.push(`${item.title} (no SKU)`);
      continue;
    }

    const odooProduct = await getProductBySku(config, uid, item.sku);
    if (!odooProduct) {
      unmatchedSkus.push(item.sku);
      continue;
    }

    orderLines.push({
      productId: odooProduct.id,
      quantity: item.quantity,
      priceUnit: parseFloat(item.price),
      description: item.variant_title ? `${item.title} - ${item.variant_title}` : item.title,
    });
  }

  if (orderLines.length === 0) {
    return {
      status: 'error',
      reason: `No matching products found (unmatched: ${unmatchedSkus.join(', ')})`,
    };
  }

  // Create Sales Order
  const orderId = await createSaleOrder(config, uid, {
    partnerId,
    externalRef,
    orderDate: order.processed_at || order.created_at,
    notes: unmatchedSkus.length > 0
      ? `Note: ${unmatchedSkus.length} item(s) not found: ${unmatchedSkus.join(', ')}`
      : undefined,
    lines: orderLines,
  });

  // Auto-confirm the order
  try {
    await confirmSaleOrder(config, uid, orderId);
  } catch (confirmError) {
    console.warn(`Order ${order.name} created but confirmation failed:`, confirmError);
  }

  return {
    status: 'created',
    odooOrderId: orderId,
    itemsSynced: orderLines.length,
    itemsUnmatched: unmatchedSkus.length,
  };
}

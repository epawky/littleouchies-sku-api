// Odoo JSON-RPC client for server-side use

interface OdooConfig {
  url: string;
  db: string;
  user: string;
  apiKey: string;
}

export function getOdooConfig(): OdooConfig {
  return {
    url: process.env.ODOO_URL || 'https://copper-cat-systems.odoo.com',
    db: process.env.ODOO_DB || 'copper-cat-systems',
    user: process.env.ODOO_USER || 'connect@coppercatsystems.com',
    apiKey: process.env.ODOO_API_KEY || '',
  };
}

export async function jsonRpcCall<T>(
  url: string,
  service: string,
  method: string,
  args: unknown[]
): Promise<T> {
  const response = await fetch(`${url}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: { service, method, args },
      id: Math.floor(Math.random() * 1000000),
    }),
  });

  const result = await response.json();

  if (result.error) {
    throw new Error(result.error.data?.message || JSON.stringify(result.error));
  }

  return result.result as T;
}

export async function authenticate(config: OdooConfig): Promise<number> {
  const uid = await jsonRpcCall<number>(
    config.url,
    'common',
    'authenticate',
    [config.db, config.user, config.apiKey, {}]
  );

  if (!uid) {
    throw new Error('Odoo authentication failed');
  }

  return uid;
}

export async function searchRead<T>(
  config: OdooConfig,
  uid: number,
  model: string,
  domain: unknown[],
  fields: string[],
  options: { limit?: number; offset?: number; order?: string } = {}
): Promise<T[]> {
  return jsonRpcCall<T[]>(
    config.url,
    'object',
    'execute_kw',
    [
      config.db,
      uid,
      config.apiKey,
      model,
      'search_read',
      [domain],
      { fields, ...options },
    ]
  );
}

export async function create(
  config: OdooConfig,
  uid: number,
  model: string,
  values: Record<string, unknown>
): Promise<number> {
  return jsonRpcCall<number>(
    config.url,
    'object',
    'execute_kw',
    [config.db, uid, config.apiKey, model, 'create', [values]]
  );
}

export async function write(
  config: OdooConfig,
  uid: number,
  model: string,
  ids: number[],
  values: Record<string, unknown>
): Promise<boolean> {
  return jsonRpcCall<boolean>(
    config.url,
    'object',
    'execute_kw',
    [config.db, uid, config.apiKey, model, 'write', [ids, values]]
  );
}

export async function search(
  config: OdooConfig,
  uid: number,
  model: string,
  domain: unknown[][]
): Promise<number[]> {
  return jsonRpcCall<number[]>(
    config.url,
    'object',
    'execute_kw',
    [config.db, uid, config.apiKey, model, 'search', [domain]]
  );
}

// Product-specific helpers
export interface OdooProduct {
  id: number;
  name: string;
  default_code: string;
  list_price: number;
  qty_available: number;
  categ_id: [number, string];
}

export async function getProductBySku(
  config: OdooConfig,
  uid: number,
  sku: string
): Promise<OdooProduct | null> {
  // Try exact match first
  let products = await searchRead<OdooProduct>(
    config,
    uid,
    'product.product',
    [['default_code', '=', sku]],
    ['id', 'name', 'default_code', 'list_price', 'qty_available', 'categ_id']
  );

  // If not found, try case-insensitive match
  if (products.length === 0) {
    products = await searchRead<OdooProduct>(
      config,
      uid,
      'product.product',
      [['default_code', '=ilike', sku]],
      ['id', 'name', 'default_code', 'list_price', 'qty_available', 'categ_id']
    );
  }

  return products.length > 0 ? products[0] : null;
}

export async function updateProductQuantity(
  config: OdooConfig,
  uid: number,
  productId: number,
  locationId: number,
  newQty: number
): Promise<number> {
  // Create inventory adjustment
  const quantId = await create(config, uid, 'stock.quant', {
    product_id: productId,
    location_id: locationId,
    inventory_quantity: newQty,
  });

  // Apply the inventory adjustment
  await jsonRpcCall(
    config.url,
    'object',
    'execute_kw',
    [config.db, uid, config.apiKey, 'stock.quant', 'action_apply_inventory', [[quantId]]]
  );

  return quantId;
}

export async function createProduct(
  config: OdooConfig,
  uid: number,
  data: {
    name: string;
    sku: string;
    price?: number;
    categoryId?: number;
    description?: string;
    isStorable?: boolean;
  }
): Promise<number> {
  return create(config, uid, 'product.product', {
    name: data.name,
    default_code: data.sku,
    list_price: data.price || 0,
    categ_id: data.categoryId,
    description: data.description,
    type: data.isStorable ? 'consu' : 'consu',
    is_storable: data.isStorable ?? true,
  });
}

export async function updateProduct(
  config: OdooConfig,
  uid: number,
  productId: number,
  data: {
    name?: string;
    sku?: string;
    price?: number;
    categoryId?: number;
    description?: string;
  }
): Promise<boolean> {
  const values: Record<string, unknown> = {};
  if (data.name !== undefined) values.name = data.name;
  if (data.sku !== undefined) values.default_code = data.sku;
  if (data.price !== undefined) values.list_price = data.price;
  if (data.categoryId !== undefined) values.categ_id = data.categoryId;
  if (data.description !== undefined) values.description = data.description;

  return write(config, uid, 'product.product', [productId], values);
}

// Customer (res.partner) helpers
export interface OdooPartner {
  id: number;
  name: string;
  email: string | false;
  phone: string | false;
  street: string | false;
  street2: string | false;
  city: string | false;
  state_id: [number, string] | false;
  zip: string | false;
  country_id: [number, string] | false;
}

export async function getOrCreateCustomer(
  config: OdooConfig,
  uid: number,
  customerData: {
    name: string;
    email?: string;
    phone?: string;
    street?: string;
    street2?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  }
): Promise<number> {
  // Try to find existing customer by email first
  if (customerData.email) {
    const existing = await searchRead<OdooPartner>(
      config,
      uid,
      'res.partner',
      [['email', '=', customerData.email]],
      ['id']
    );
    if (existing.length > 0) {
      return existing[0].id;
    }
  }

  // Try to find by name if no email match
  const byName = await searchRead<OdooPartner>(
    config,
    uid,
    'res.partner',
    [['name', '=', customerData.name]],
    ['id']
  );
  if (byName.length > 0) {
    return byName[0].id;
  }

  // Look up country and state IDs
  let countryId: number | undefined;
  let stateId: number | undefined;

  if (customerData.country) {
    const countries = await searchRead<{ id: number; code: string }>(
      config,
      uid,
      'res.country',
      ['|', ['name', 'ilike', customerData.country], ['code', '=', customerData.country.toUpperCase()]],
      ['id', 'code'],
      { limit: 1 }
    );
    if (countries.length > 0) {
      countryId = countries[0].id;

      // Now look up state within that country
      if (customerData.state) {
        const states = await searchRead<{ id: number }>(
          config,
          uid,
          'res.country.state',
          [
            ['country_id', '=', countryId],
            '|',
            ['name', 'ilike', customerData.state],
            ['code', '=', customerData.state.toUpperCase()]
          ],
          ['id'],
          { limit: 1 }
        );
        if (states.length > 0) {
          stateId = states[0].id;
        }
      }
    }
  }

  // Create new customer
  const partnerData: Record<string, unknown> = {
    name: customerData.name,
    customer_rank: 1,
  };

  if (customerData.email) partnerData.email = customerData.email;
  if (customerData.phone) partnerData.phone = customerData.phone;
  if (customerData.street) partnerData.street = customerData.street;
  if (customerData.street2) partnerData.street2 = customerData.street2;
  if (customerData.city) partnerData.city = customerData.city;
  if (customerData.zip) partnerData.zip = customerData.zip;
  if (countryId) partnerData.country_id = countryId;
  if (stateId) partnerData.state_id = stateId;

  return create(config, uid, 'res.partner', partnerData);
}

// Sales Order helpers
export interface OdooSaleOrder {
  id: number;
  name: string;
  partner_id: [number, string];
  state: string;
  amount_total: number;
  date_order: string;
  client_order_ref: string | false;
}

export interface OdooSaleOrderLine {
  id: number;
  product_id: [number, string];
  product_uom_qty: number;
  price_unit: number;
  price_subtotal: number;
}

export async function findSaleOrderByRef(
  config: OdooConfig,
  uid: number,
  externalRef: string
): Promise<OdooSaleOrder | null> {
  const orders = await searchRead<OdooSaleOrder>(
    config,
    uid,
    'sale.order',
    [['client_order_ref', '=', externalRef]],
    ['id', 'name', 'partner_id', 'state', 'amount_total', 'date_order', 'client_order_ref']
  );
  return orders.length > 0 ? orders[0] : null;
}

// Convert ISO8601 date to Odoo format (YYYY-MM-DD HH:MM:SS)
function toOdooDatetime(isoDate: string): string {
  const date = new Date(isoDate);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export async function createSaleOrder(
  config: OdooConfig,
  uid: number,
  orderData: {
    partnerId: number;
    externalRef: string;
    orderName?: string; // Custom order name to match Shopify (e.g., "#26230")
    orderDate?: string;
    notes?: string;
    lines: Array<{
      productId: number;
      quantity: number;
      priceUnit: number;
      description?: string;
    }>;
  }
): Promise<number> {
  // Create order lines in Odoo format
  const orderLines = orderData.lines.map(line => [
    0, // Create command
    0,
    {
      product_id: line.productId,
      product_uom_qty: line.quantity,
      price_unit: line.priceUnit,
      name: line.description || '',
    }
  ]);

  const saleOrderData: Record<string, unknown> = {
    partner_id: orderData.partnerId,
    client_order_ref: orderData.externalRef,
    order_line: orderLines,
  };

  // Set custom order name to match Shopify order number
  if (orderData.orderName) {
    saleOrderData.name = orderData.orderName;
  }

  if (orderData.orderDate) {
    saleOrderData.date_order = toOdooDatetime(orderData.orderDate);
  }

  if (orderData.notes) {
    saleOrderData.note = orderData.notes;
  }

  return create(config, uid, 'sale.order', saleOrderData);
}

export async function confirmSaleOrder(
  config: OdooConfig,
  uid: number,
  orderId: number
): Promise<boolean> {
  return jsonRpcCall<boolean>(
    config.url,
    'object',
    'execute_kw',
    [config.db, uid, config.apiKey, 'sale.order', 'action_confirm', [[orderId]]]
  );
}

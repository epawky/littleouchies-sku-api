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
  const products = await searchRead<OdooProduct>(
    config,
    uid,
    'product.product',
    [['default_code', '=', sku]],
    ['id', 'name', 'default_code', 'list_price', 'qty_available', 'categ_id']
  );
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

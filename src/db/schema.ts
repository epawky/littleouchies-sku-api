import { pgTable, serial, text, varchar, decimal, integer, timestamp, boolean, uniqueIndex } from 'drizzle-orm/pg-core';

// Products table - synced from Shopify
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  shopifyId: varchar('shopify_id', { length: 50 }).notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  vendor: varchar('vendor', { length: 255 }),
  productType: varchar('product_type', { length: 255 }),
  handle: varchar('handle', { length: 255 }),
  status: varchar('status', { length: 50 }).default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  syncedAt: timestamp('synced_at').defaultNow(),
});

// Product variants table - synced from Shopify
export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  shopifyId: varchar('shopify_id', { length: 50 }).notNull().unique(),
  productId: integer('product_id').references(() => products.id),
  title: varchar('title', { length: 255 }).notNull(),
  shopifySku: varchar('shopify_sku', { length: 255 }),
  generatedSku: varchar('generated_sku', { length: 255 }),
  customSku: varchar('custom_sku', { length: 255 }),
  barcode: varchar('barcode', { length: 255 }),
  price: decimal('price', { precision: 10, scale: 2 }),
  compareAtPrice: decimal('compare_at_price', { precision: 10, scale: 2 }),
  inventoryQuantity: integer('inventory_quantity').default(0),
  inventoryItemId: varchar('inventory_item_id', { length: 50 }),
  option1: varchar('option1', { length: 255 }),
  option2: varchar('option2', { length: 255 }),
  option3: varchar('option3', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// SKU categories for organizing products
export const skuCategories = pgTable('sku_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  code: varchar('code', { length: 10 }).notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// SKU mappings - links Shopify variants to custom SKUs
export const skuMappings = pgTable('sku_mappings', {
  id: serial('id').primaryKey(),
  shopifyVariantId: varchar('shopify_variant_id', { length: 50 }).notNull().unique(),
  originalSku: varchar('original_sku', { length: 255 }),
  generatedSku: varchar('generated_sku', { length: 255 }).notNull(),
  customSku: varchar('custom_sku', { length: 255 }),
  productTitle: text('product_title'),
  variantTitle: varchar('variant_title', { length: 255 }),
  categoryId: integer('category_id').references(() => skuCategories.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  generatedSkuIdx: uniqueIndex('generated_sku_idx').on(table.generatedSku),
}));

// Orders table - synced from Shopify
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  shopifyId: varchar('shopify_id', { length: 50 }).notNull().unique(),
  orderNumber: varchar('order_number', { length: 50 }).notNull(),
  name: varchar('name', { length: 50 }),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }),
  subtotalPrice: decimal('subtotal_price', { precision: 10, scale: 2 }),
  totalTax: decimal('total_tax', { precision: 10, scale: 2 }),
  totalDiscounts: decimal('total_discounts', { precision: 10, scale: 2 }),
  currency: varchar('currency', { length: 10 }).default('USD'),
  financialStatus: varchar('financial_status', { length: 50 }),
  fulfillmentStatus: varchar('fulfillment_status', { length: 50 }),
  customerEmail: varchar('customer_email', { length: 255 }),
  shippingCity: varchar('shipping_city', { length: 100 }),
  shippingProvince: varchar('shipping_province', { length: 100 }),
  shippingCountry: varchar('shipping_country', { length: 100 }),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  syncedAt: timestamp('synced_at').defaultNow(),
});

// Order line items
export const orderLineItems = pgTable('order_line_items', {
  id: serial('id').primaryKey(),
  shopifyId: varchar('shopify_id', { length: 50 }).notNull().unique(),
  orderId: integer('order_id').references(() => orders.id),
  productId: varchar('product_id', { length: 50 }),
  variantId: varchar('variant_id', { length: 50 }),
  title: text('title').notNull(),
  variantTitle: varchar('variant_title', { length: 255 }),
  sku: varchar('sku', { length: 255 }),
  quantity: integer('quantity').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }),
});

// Inventory locations
export const locations = pgTable('locations', {
  id: serial('id').primaryKey(),
  shopifyId: varchar('shopify_id', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  address1: text('address1'),
  city: varchar('city', { length: 100 }),
  province: varchar('province', { length: 100 }),
  country: varchar('country', { length: 100 }),
  active: boolean('active').default(true),
});

// Inventory levels
export const inventoryLevels = pgTable('inventory_levels', {
  id: serial('id').primaryKey(),
  inventoryItemId: varchar('inventory_item_id', { length: 50 }).notNull(),
  locationId: varchar('location_id', { length: 50 }).notNull(),
  variantId: integer('variant_id').references(() => productVariants.id),
  available: integer('available').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
  syncedAt: timestamp('synced_at').defaultNow(),
});

// Sync logs
export const syncLogs = pgTable('sync_logs', {
  id: serial('id').primaryKey(),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  recordsProcessed: integer('records_processed').default(0),
  errors: text('errors'),
  startedAt: timestamp('started_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Type exports
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type SkuCategory = typeof skuCategories.$inferSelect;
export type SkuMapping = typeof skuMappings.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderLineItem = typeof orderLineItems.$inferSelect;

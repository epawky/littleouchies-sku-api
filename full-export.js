// Full Shopify Export via GraphQL - Pre-SKU Fix Backup
// Exports all products, variants, inventory, and metafields

const fs = require('fs');

const SHOPIFY_STORE_NAME = process.env.SHOPIFY_STORE_NAME || 'your-store';
const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID || 'your-client-id';
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET || 'your-client-secret';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01';

async function getAccessToken() {
  const tokenEndpoint = `https://${SHOPIFY_STORE_NAME}.myshopify.com/admin/oauth/access_token`;
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const data = await response.json();
  return data.access_token;
}

async function shopifyGraphQL(query, variables) {
  const accessToken = await getAccessToken();
  const endpoint = `https://${SHOPIFY_STORE_NAME}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await response.json();
  if (data.errors) throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
  return data.data;
}

const FULL_PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage, endCursor }
      edges {
        node {
          id
          title
          handle
          description
          descriptionHtml
          vendor
          productType
          status
          tags
          templateSuffix
          createdAt
          updatedAt
          publishedAt
          onlineStoreUrl
          seo {
            title
            description
          }
          featuredImage {
            url
            altText
          }
          images(first: 20) {
            edges {
              node {
                url
                altText
              }
            }
          }
          options {
            name
            values
          }
          metafields(first: 50) {
            edges {
              node {
                namespace
                key
                value
                type
              }
            }
          }
          collections(first: 20) {
            edges {
              node {
                id
                title
                handle
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                barcode
                price
                compareAtPrice
                position
                inventoryQuantity
                inventoryPolicy
                inventoryItem {
                  id
                  tracked
                }
                selectedOptions {
                  name
                  value
                }
                image {
                  url
                }
                metafields(first: 20) {
                  edges {
                    node {
                      namespace
                      key
                      value
                      type
                    }
                  }
                }
                createdAt
                updatedAt
              }
            }
          }
        }
      }
    }
  }
`;

async function main() {
  console.log('='.repeat(60));
  console.log('FULL SHOPIFY EXPORT - PRE-SKU FIX BACKUP');
  console.log('='.repeat(60));
  console.log(`\nTimestamp: ${new Date().toISOString()}\n`);

  const allProducts = [];
  let cursor = null;
  let hasMore = true;
  let page = 1;

  console.log('Fetching all products with full details...\n');

  while (hasMore) {
    process.stdout.write(`  Page ${page}...`);
    const data = await shopifyGraphQL(FULL_PRODUCTS_QUERY, { first: 25, after: cursor });

    for (const edge of data.products.edges) {
      allProducts.push(edge.node);
    }

    console.log(` fetched ${data.products.edges.length} products (total: ${allProducts.length})`);
    hasMore = data.products.pageInfo.hasNextPage;
    cursor = hasMore ? data.products.pageInfo.endCursor : null;
    page++;
  }

  // Save full JSON backup
  const jsonBackup = {
    exportDate: new Date().toISOString(),
    store: SHOPIFY_STORE_NAME,
    totalProducts: allProducts.length,
    totalVariants: allProducts.reduce((sum, p) => sum + p.variants.edges.length, 0),
    products: allProducts
  };

  fs.writeFileSync('products_backup_pre_sku_fix.json', JSON.stringify(jsonBackup, null, 2));
  console.log(`\nSaved: products_backup_pre_sku_fix.json`);

  // Generate CSV
  const csvRows = [];
  csvRows.push([
    'Handle', 'Title', 'Vendor', 'Product Type', 'Status', 'Tags',
    'Published', 'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value',
    'Option3 Name', 'Option3 Value', 'Variant SKU', 'Variant Barcode',
    'Variant Price', 'Variant Compare At Price', 'Variant Inventory Qty',
    'Variant Position', 'Image URL', 'SEO Title', 'SEO Description',
    'Metafield Namespace', 'Metafield Key', 'Metafield Value', 'Collections',
    'Product ID', 'Variant ID', 'Created At', 'Updated At'
  ].join(','));

  for (const product of allProducts) {
    const collections = product.collections.edges.map(e => e.node.title).join('; ');
    const productMetafields = product.metafields.edges.map(e =>
      `${e.node.namespace}.${e.node.key}=${e.node.value}`
    ).join('; ');

    for (const variantEdge of product.variants.edges) {
      const variant = variantEdge.node;
      const options = variant.selectedOptions || [];
      const variantMetafields = variant.metafields.edges.map(e =>
        `${e.node.namespace}.${e.node.key}=${e.node.value}`
      ).join('; ');

      const row = [
        `"${product.handle}"`,
        `"${(product.title || '').replace(/"/g, '""')}"`,
        `"${product.vendor || ''}"`,
        `"${product.productType || ''}"`,
        `"${product.status}"`,
        `"${(product.tags || []).join(', ')}"`,
        `"${product.publishedAt || ''}"`,
        `"${options[0]?.name || ''}"`,
        `"${options[0]?.value || ''}"`,
        `"${options[1]?.name || ''}"`,
        `"${options[1]?.value || ''}"`,
        `"${options[2]?.name || ''}"`,
        `"${options[2]?.value || ''}"`,
        `"${variant.sku || ''}"`,
        `"${variant.barcode || ''}"`,
        `"${variant.price}"`,
        `"${variant.compareAtPrice || ''}"`,
        `"${variant.inventoryQuantity}"`,
        `"${variant.position}"`,
        `"${variant.image?.url || product.featuredImage?.url || ''}"`,
        `"${(product.seo?.title || '').replace(/"/g, '""')}"`,
        `"${(product.seo?.description || '').replace(/"/g, '""')}"`,
        `"${productMetafields}${variantMetafields ? '; ' + variantMetafields : ''}"`,
        `""`,
        `""`,
        `"${collections}"`,
        `"${product.id}"`,
        `"${variant.id}"`,
        `"${variant.createdAt}"`,
        `"${variant.updatedAt}"`
      ];
      csvRows.push(row.join(','));
    }
  }

  fs.writeFileSync('products_backup_pre_sku_fix.csv', csvRows.join('\n'));
  console.log(`Saved: products_backup_pre_sku_fix.csv`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('EXPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Products: ${allProducts.length}`);
  console.log(`Total Variants: ${jsonBackup.totalVariants}`);

  let withSku = 0, withoutSku = 0, withMetafields = 0;
  for (const p of allProducts) {
    if (p.metafields.edges.length > 0) withMetafields++;
    for (const v of p.variants.edges) {
      if (v.node.sku && v.node.sku.trim()) withSku++;
      else withoutSku++;
    }
  }

  console.log(`Variants with SKU: ${withSku}`);
  console.log(`Variants without SKU: ${withoutSku}`);
  console.log(`Products with Metafields: ${withMetafields}`);
  console.log('\nBackup files:');
  console.log('  - products_backup_pre_sku_fix.json (full data)');
  console.log('  - products_backup_pre_sku_fix.csv (spreadsheet format)');
}

main().catch(console.error);

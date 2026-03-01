// List all products missing SKUs for Odoo Migration

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

const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage, endCursor }
      edges {
        node {
          id, title, productType, vendor, status, tags
          collections(first: 10) { edges { node { title } } }
          variants(first: 100) {
            edges {
              node { id, title, sku, price, inventoryQuantity, selectedOptions { name, value } }
            }
          }
        }
      }
    }
  }
`;

async function main() {
  console.log('Fetching products...\n');

  const allProducts = [];
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    const data = await shopifyGraphQL(PRODUCTS_QUERY, { first: 50, after: cursor });
    for (const edge of data.products.edges) allProducts.push(edge.node);
    hasMore = data.products.pageInfo.hasNextPage;
    cursor = hasMore ? data.products.pageInfo.endCursor : null;
  }

  // Filter products with missing SKUs
  const unskuedProducts = [];

  for (const product of allProducts) {
    const collections = product.collections?.edges?.map(e => e.node.title) || [];
    const variants = product.variants.edges.map(e => e.node);
    const missingSku = variants.filter(v => !v.sku || v.sku.trim() === '');

    if (missingSku.length > 0) {
      unskuedProducts.push({
        title: product.title,
        status: product.status,
        productType: product.productType || 'N/A',
        collections: collections.join(', ') || 'N/A',
        totalVariants: variants.length,
        missingSkuCount: missingSku.length,
        variants: missingSku.map(v => ({
          name: v.title === 'Default Title' ? '(default)' : v.title,
          price: v.price,
          qty: v.inventoryQuantity
        }))
      });
    }
  }

  console.log('=' .repeat(80));
  console.log('PRODUCTS MISSING SKUs - ODOO MIGRATION');
  console.log('='.repeat(80));
  console.log(`\nTotal Products: ${allProducts.length}`);
  console.log(`Products with Missing SKUs: ${unskuedProducts.length}`);
  console.log(`Total Variants Missing SKUs: ${unskuedProducts.reduce((sum, p) => sum + p.missingSkuCount, 0)}\n`);
  console.log('='.repeat(80));

  for (const p of unskuedProducts) {
    console.log(`\n${p.title}`);
    console.log(`  Status: ${p.status} | Type: ${p.productType}`);
    console.log(`  Collections: ${p.collections}`);
    console.log(`  Variants Missing SKU (${p.missingSkuCount} of ${p.totalVariants}):`);
    for (const v of p.variants) {
      console.log(`    • ${v.name} - $${v.price} (Qty: ${v.qty})`);
    }
  }

  // CSV output
  console.log('\n\n' + '='.repeat(80));
  console.log('CSV FORMAT (for import)');
  console.log('='.repeat(80));
  console.log('\nProduct,Variant,Price,Quantity,Collections,Status');
  for (const p of unskuedProducts) {
    for (const v of p.variants) {
      console.log(`"${p.title}","${v.name}","${v.price}","${v.qty}","${p.collections}","${p.status}"`);
    }
  }
}

main().catch(console.error);

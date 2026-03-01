// Odoo Migration Export Script
// Pulls all products from Shopify with categories and identifies products missing SKUs

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
  if (data.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          description
          vendor
          productType
          handle
          status
          tags
          createdAt
          updatedAt
          collections(first: 10) {
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
                inventoryQuantity
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
        }
      }
    }
  }
`;

async function fetchAllProducts() {
  const allProducts = [];
  let cursor = null;
  let hasMore = true;
  let page = 1;

  console.log('Fetching products from Shopify...\n');

  while (hasMore) {
    process.stdout.write(`  Page ${page}...`);
    const data = await shopifyGraphQL(PRODUCTS_QUERY, { first: 50, after: cursor });

    for (const edge of data.products.edges) {
      allProducts.push(edge.node);
    }

    console.log(` fetched ${data.products.edges.length} products`);
    hasMore = data.products.pageInfo.hasNextPage;
    cursor = hasMore ? data.products.pageInfo.endCursor : null;
    page++;
  }

  return allProducts;
}

function inferCategory(product) {
  const title = product.title.toLowerCase();
  const productType = product.productType || '';
  const tags = product.tags || [];
  const collections = product.collections?.edges?.map(e => e.node.title) || [];

  // Return collection-based category if available
  if (collections.length > 0) {
    return {
      category: collections[0],
      parentCategory: productType || 'Products',
      allCollections: collections
    };
  }

  // Infer from product type
  if (productType) {
    return {
      category: productType,
      parentCategory: 'Products',
      allCollections: []
    };
  }

  // Infer from title keywords
  if (title.includes('gift card')) return { category: 'Gift Cards', parentCategory: 'Products', allCollections: [] };
  if (title.includes('spikie') || title.includes('spiky')) return { category: 'Spikie Products', parentCategory: 'Sensory', allCollections: [] };
  if (title.includes('grippie')) return { category: 'Grippie Products', parentCategory: 'Sensory', allCollections: [] };
  if (title.includes('keytar') || title.includes('keychain')) return { category: 'Keychains', parentCategory: 'Accessories', allCollections: [] };
  if (title.includes('bundle') || title.includes('box')) return { category: 'Bundles', parentCategory: 'Products', allCollections: [] };
  if (title.includes('sticker')) return { category: 'Stickers', parentCategory: 'Accessories', allCollections: [] };

  return { category: 'Uncategorized', parentCategory: 'Products', allCollections: [] };
}

async function main() {
  try {
    const products = await fetchAllProducts();

    console.log(`\n${'='.repeat(80)}`);
    console.log('ODOO MIGRATION REPORT - LittleOuchies');
    console.log(`${'='.repeat(80)}\n`);
    console.log(`Total Products: ${products.length}`);

    // Count variants
    let totalVariants = 0;
    let variantsMissingSku = 0;
    const unskuedProducts = [];
    const productsByCategory = {};

    for (const product of products) {
      const categoryInfo = inferCategory(product);
      const category = categoryInfo.category;

      if (!productsByCategory[category]) {
        productsByCategory[category] = {
          parentCategory: categoryInfo.parentCategory,
          products: []
        };
      }

      const variants = product.variants.edges.map(e => e.node);
      totalVariants += variants.length;

      const missingSku = variants.filter(v => !v.sku || v.sku.trim() === '');
      variantsMissingSku += missingSku.length;

      const productInfo = {
        title: product.title,
        handle: product.handle,
        productType: product.productType,
        vendor: product.vendor,
        status: product.status,
        tags: product.tags,
        collections: categoryInfo.allCollections,
        variantCount: variants.length,
        missingSku: missingSku.length,
        variants: variants.map(v => ({
          title: v.title,
          sku: v.sku || '(MISSING)',
          price: v.price,
          inventory: v.inventoryQuantity,
          options: v.selectedOptions
        }))
      };

      productsByCategory[category].products.push(productInfo);

      if (missingSku.length > 0) {
        unskuedProducts.push({
          product: product.title,
          category,
          parentCategory: categoryInfo.parentCategory,
          variants: missingSku.map(v => ({
            title: v.title === 'Default Title' ? '(default)' : v.title,
            price: v.price,
            inventory: v.inventoryQuantity
          }))
        });
      }
    }

    console.log(`Total Variants: ${totalVariants}`);
    console.log(`Variants Missing SKU: ${variantsMissingSku}`);

    // Print products by category
    console.log(`\n${'='.repeat(80)}`);
    console.log('PRODUCTS BY CATEGORY');
    console.log(`${'='.repeat(80)}\n`);

    const categories = Object.keys(productsByCategory).sort();
    for (const category of categories) {
      const info = productsByCategory[category];
      console.log(`\n## ${info.parentCategory} > ${category} (${info.products.length} products)`);
      console.log('-'.repeat(60));

      for (const p of info.products) {
        const skuStatus = p.missingSku > 0 ? ` [${p.missingSku} MISSING SKU]` : '';
        console.log(`  • ${p.title}${skuStatus}`);
        console.log(`    Status: ${p.status} | Type: ${p.productType || 'N/A'} | Vendor: ${p.vendor || 'N/A'}`);
        if (p.collections.length > 0) {
          console.log(`    Collections: ${p.collections.join(', ')}`);
        }
        console.log(`    Variants (${p.variantCount}):`);
        for (const v of p.variants) {
          const optStr = v.options?.map(o => `${o.name}: ${o.value}`).join(', ') || '';
          console.log(`      - ${v.title} | SKU: ${v.sku} | $${v.price} | Qty: ${v.inventory}${optStr ? ' | ' + optStr : ''}`);
        }
      }
    }

    // Print unskued products summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('PRODUCTS MISSING SKUs (FOR ODOO IMPORT)');
    console.log(`${'='.repeat(80)}\n`);

    if (unskuedProducts.length === 0) {
      console.log('All products have SKUs assigned!');
    } else {
      console.log(`${unskuedProducts.length} products with missing SKUs:\n`);

      for (const p of unskuedProducts) {
        console.log(`• ${p.product}`);
        console.log(`  Category: ${p.parentCategory} > ${p.category}`);
        console.log(`  Variants missing SKU:`);
        for (const v of p.variants) {
          console.log(`    - ${v.title} | $${v.price} | Qty: ${v.inventory}`);
        }
        console.log('');
      }
    }

    // CSV-ready summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('CSV EXPORT (for Odoo import)');
    console.log(`${'='.repeat(80)}\n`);
    console.log('Product,Variant,SKU,Price,Quantity,Category,Parent Category,Status');

    for (const category of categories) {
      const info = productsByCategory[category];
      for (const p of info.products) {
        for (const v of p.variants) {
          const variantName = v.title === 'Default Title' ? '' : v.title;
          console.log(`"${p.title}","${variantName}","${v.sku}","${v.price}","${v.inventory}","${category}","${info.parentCategory}","${p.status}"`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

main();

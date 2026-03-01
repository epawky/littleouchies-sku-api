// Check how Judge.me reviews are linked to products
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('products_backup_pre_sku_fix.json', 'utf8'));

console.log('='.repeat(70));
console.log('HOW JUDGE.ME REVIEWS ARE LINKED');
console.log('='.repeat(70));

// Analyze the judgeme widget/badge data
let samplesShown = 0;

for (const product of data.products) {
  const judgemeWidget = product.metafields.edges.find(m =>
    m.node.namespace === 'judgeme' && m.node.key === 'widget'
  );
  const reviewsRating = product.metafields.edges.find(m =>
    m.node.namespace === 'reviews' && m.node.key === 'rating'
  );
  const reviewsCount = product.metafields.edges.find(m =>
    m.node.namespace === 'reviews' && m.node.key === 'rating_count'
  );

  if (judgemeWidget && samplesShown < 3) {
    console.log('\n' + '-'.repeat(70));
    console.log(`Product: ${product.title}`);
    console.log(`Handle: ${product.handle}`);
    console.log(`Shopify Product ID: ${product.id}`);

    // Parse the widget HTML to find identifiers
    const widgetHtml = judgemeWidget.node.value;

    // Look for data attributes
    const dataIdMatch = widgetHtml.match(/data-id=['"]([^'"]+)['"]/);
    const dataProductIdMatch = widgetHtml.match(/data-product-id=['"]([^'"]+)['"]/);
    const dataHandleMatch = widgetHtml.match(/data-handle=['"]([^'"]+)['"]/);
    const dataAverageMatch = widgetHtml.match(/data-average-rating=['"]([^'"]+)['"]/);
    const dataCountMatch = widgetHtml.match(/data-number-of-reviews=['"]([^'"]+)['"]/);

    console.log('\nJudge.me Widget Data Attributes:');
    if (dataIdMatch) console.log(`  data-id: ${dataIdMatch[1]}`);
    if (dataProductIdMatch) console.log(`  data-product-id: ${dataProductIdMatch[1]}`);
    if (dataHandleMatch) console.log(`  data-handle: ${dataHandleMatch[1]}`);
    if (dataAverageMatch) console.log(`  data-average-rating: ${dataAverageMatch[1]}`);
    if (dataCountMatch) console.log(`  data-number-of-reviews: ${dataCountMatch[1]}`);

    if (reviewsRating) {
      console.log('\nShopify reviews.rating metafield:');
      console.log(`  ${reviewsRating.node.value}`);
    }
    if (reviewsCount) {
      console.log(`\nShopify reviews.rating_count: ${reviewsCount.node.value}`);
    }

    // Show variant info
    console.log(`\nVariants (${product.variants.edges.length}):`);
    product.variants.edges.slice(0, 3).forEach(v => {
      console.log(`  - ${v.node.title} | SKU: ${v.node.sku || '(none)'} | ID: ${v.node.id}`);
    });
    if (product.variants.edges.length > 3) {
      console.log(`  ... and ${product.variants.edges.length - 3} more variants`);
    }

    samplesShown++;
  }
}

console.log('\n\n' + '='.repeat(70));
console.log('SUMMARY: HOW JUDGE.ME LINKS REVIEWS');
console.log('='.repeat(70));
console.log(`
Judge.me links reviews to products using:

  1. PRODUCT ID (primary) - The Shopify Product GID
     Example: gid://shopify/Product/1234567890

  2. HANDLE (secondary) - The product URL slug
     Example: little-ouchies-grippie-squish

Reviews are linked at the PRODUCT level, NOT the variant/SKU level.
This means:
  - All variants of a product share the same reviews
  - Changing SKUs will NOT affect reviews
  - Reviews stay linked as long as the Product ID remains the same

For Odoo migration:
  - Export reviews from Judge.me dashboard (CSV)
  - Reviews reference product handles/external IDs
  - You'll need to map Shopify handles to Odoo product IDs
`);

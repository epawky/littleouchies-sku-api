// Create a clean CSV backup without unnecessary columns
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('products_backup_pre_sku_fix.json', 'utf8'));

console.log('Creating clean CSV backup...\n');

const csvRows = [];

// Clean header - essential columns only
csvRows.push([
  'Handle',
  'Title',
  'Vendor',
  'Product Type',
  'Status',
  'Tags',
  'Option1 Name',
  'Option1 Value',
  'Option2 Name',
  'Option2 Value',
  'Option3 Name',
  'Option3 Value',
  'Variant Title',
  'Variant SKU',
  'Variant Barcode',
  'Variant Price',
  'Variant Compare At Price',
  'Variant Inventory Qty',
  'Collections',
  'Avg Rating',
  'Review Count',
  'Product ID',
  'Variant ID'
].join(','));

for (const product of data.products) {
  // Get collections
  const collections = product.collections.edges.map(e => e.node.title).join('; ');

  // Get rating info (clean, not the HTML)
  const ratingMeta = product.metafields.edges.find(m =>
    m.node.namespace === 'reviews' && m.node.key === 'rating'
  );
  const countMeta = product.metafields.edges.find(m =>
    m.node.namespace === 'reviews' && m.node.key === 'rating_count'
  );

  let avgRating = '';
  if (ratingMeta) {
    try {
      const parsed = JSON.parse(ratingMeta.node.value);
      avgRating = parsed.value || '';
    } catch (e) {
      avgRating = ratingMeta.node.value;
    }
  }
  const reviewCount = countMeta ? countMeta.node.value : '';

  for (const variantEdge of product.variants.edges) {
    const variant = variantEdge.node;
    const options = variant.selectedOptions || [];

    const row = [
      `"${product.handle}"`,
      `"${(product.title || '').replace(/"/g, '""')}"`,
      `"${product.vendor || ''}"`,
      `"${product.productType || ''}"`,
      `"${product.status}"`,
      `"${(product.tags || []).join(', ')}"`,
      `"${options[0]?.name || ''}"`,
      `"${options[0]?.value || ''}"`,
      `"${options[1]?.name || ''}"`,
      `"${options[1]?.value || ''}"`,
      `"${options[2]?.name || ''}"`,
      `"${options[2]?.value || ''}"`,
      `"${(variant.title || '').replace(/"/g, '""')}"`,
      `"${variant.sku || ''}"`,
      `"${variant.barcode || ''}"`,
      `"${variant.price}"`,
      `"${variant.compareAtPrice || ''}"`,
      `"${variant.inventoryQuantity}"`,
      `"${collections}"`,
      `"${avgRating}"`,
      `"${reviewCount}"`,
      `"${product.id}"`,
      `"${variant.id}"`
    ];
    csvRows.push(row.join(','));
  }
}

fs.writeFileSync('products_backup_clean.csv', csvRows.join('\n'));
console.log('Saved: products_backup_clean.csv');
console.log(`Total rows: ${csvRows.length - 1} variants`);

// Show sample
console.log('\nSample (first 3 data rows):');
console.log('-'.repeat(80));
csvRows.slice(0, 4).forEach((row, i) => {
  if (i === 0) {
    console.log('HEADER: ' + row.substring(0, 100) + '...');
  } else {
    console.log(`ROW ${i}: ` + row.substring(0, 120) + '...');
  }
});

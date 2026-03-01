// Check for review-related data in Shopify export
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('products_backup_pre_sku_fix.json', 'utf8'));

console.log('='.repeat(60));
console.log('CHECKING FOR REVIEW METAFIELDS');
console.log('='.repeat(60));

const reviewNamespaces = new Set();
const allMetafields = new Map();

for (const product of data.products) {
  for (const mf of product.metafields.edges) {
    const ns = mf.node.namespace;
    const key = mf.node.key;
    const fullKey = `${ns}.${key}`;

    if (!allMetafields.has(fullKey)) {
      allMetafields.set(fullKey, { count: 0, sample: mf.node.value?.substring(0, 100) });
    }
    allMetafields.get(fullKey).count++;

    // Check for review-related namespaces
    const nsLower = ns.toLowerCase();
    const keyLower = key.toLowerCase();
    if (nsLower.includes('review') ||
        nsLower.includes('judge') ||
        nsLower.includes('yotpo') ||
        nsLower.includes('loox') ||
        nsLower.includes('stamped') ||
        nsLower.includes('okendo') ||
        nsLower.includes('alireviews') ||
        nsLower.includes('ryviu') ||
        keyLower.includes('review') ||
        keyLower.includes('rating')) {
      reviewNamespaces.add(ns);
    }
  }
}

console.log('\nAll Metafield Namespaces Found:');
console.log('-'.repeat(40));
const namespaces = [...new Set([...allMetafields.keys()].map(k => k.split('.')[0]))];
namespaces.forEach(ns => console.log('  ' + ns));

console.log('\nAll Metafields (namespace.key):');
console.log('-'.repeat(40));
for (const [key, info] of allMetafields) {
  console.log(`  ${key} (${info.count} products)`);
  if (info.sample) console.log(`    Sample: ${info.sample.substring(0, 80)}...`);
}

if (reviewNamespaces.size > 0) {
  console.log('\n*** REVIEW-RELATED NAMESPACES FOUND:');
  reviewNamespaces.forEach(ns => console.log('  - ' + ns));
} else {
  console.log('\n' + '='.repeat(60));
  console.log('No review metafields found in product data.');
  console.log('='.repeat(60));
  console.log('\nReviews are likely stored by a third-party app. Common review apps:');
  console.log('  - Judge.me');
  console.log('  - Yotpo');
  console.log('  - Loox');
  console.log('  - Stamped.io');
  console.log('  - Okendo');
  console.log('  - Ali Reviews');
  console.log('\nTo preserve reviews during migration:');
  console.log('  1. Check your Shopify Apps for the review app you use');
  console.log('  2. Export reviews from that app (most have CSV export)');
  console.log('  3. Contact the app support for migration assistance');
}

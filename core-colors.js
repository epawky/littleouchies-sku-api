const fs = require('fs');
const data = JSON.parse(fs.readFileSync('products_backup_pre_sku_fix.json', 'utf8'));

const rawColors = new Set();

for (const product of data.products) {
  for (const variantEdge of product.variants.edges) {
    const options = variantEdge.node.selectedOptions || [];
    for (const opt of options) {
      if (opt.name.toLowerCase().includes('color') ||
          opt.name.toLowerCase() === 'base and click color' ||
          opt.name.toLowerCase().includes('middle')) {
        rawColors.add(opt.value);
      }
    }
  }
}

const coreColors = new Set();

for (const color of rawColors) {
  let core = color
    // Remove product prefixes
    .replace(/^(Ergo |Ring |Roller |Spin Click |Spin |Spikie Click |Spikie Keytar |Can Coozie |Pods |BIC Lighter |Clipper )/i, '')
    // Remove suffixes
    .replace(/ (Keys|Middle|Mini|Pod|Stick|Click|Chapstick|Squish)$/i, '')
    .replace(/-Click$/i, '')
    .replace(/-click$/i, '')
    .trim();

  // Skip SKU-like values
  if (core && core.length > 0 && !core.startsWith('SPK-')) {
    coreColors.add(core);
  }
}

const sorted = [...coreColors].sort();
console.log('CORE COLORS (deduplicated) - ' + sorted.length + ' total:');
console.log('='.repeat(50));
sorted.forEach(c => console.log(c));

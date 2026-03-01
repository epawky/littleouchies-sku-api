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

// Normalize function to merge duplicates
function normalize(color) {
  return color
    // Remove product prefixes
    .replace(/^(Ergo |Ring |Roller |Spin Click |Spin |Spikie Click |Spikie Keytar |Can Coozie |Pods |BIC Lighter |Clipper )/i, '')
    // Remove suffixes
    .replace(/ (Keys|Middle|Mini|Pod|Stick|Click|Chapstick|Squish)$/i, '')
    .replace(/-Click$/i, '')
    .replace(/-click$/i, '')
    // Normalize spacing
    .replace(/([a-z])([A-Z])/g, '$1 $2')  // FairyFloss -> Fairy Floss
    .trim();
}

// Map of known duplicates to canonical form
const canonicalMap = {
  'DarkMagic': 'Dark Magic',
  'FairyFloss': 'Fairy Floss',
  'PixieDust': 'Pixie Dust',
  'WitchesBlue': 'Witches Blue',
  'Whitches Blue': 'Witches Blue',
  'Withcraft': 'Witchcraft',
  'Blood Of My Enemies': 'Blood of My Enemies',
  'PAN Pride': 'Pan Pride',
  'Green Apple Elixir': 'Green Apple',
  'Poison Green Apple': 'Poison Apple Green',
};

for (const color of rawColors) {
  let core = normalize(color);

  // Apply canonical mapping
  if (canonicalMap[core]) {
    core = canonicalMap[core];
  }

  // Skip SKU-like values
  if (core && core.length > 0 && !core.startsWith('SPK-')) {
    coreColors.add(core);
  }
}

const sorted = [...coreColors].sort();

// Group by category
const baseColors = [];
const mythicalCreatures = [];
const potionsElixirs = [];
const pride = [];
const seasonal = [];
const special = [];

for (const c of sorted) {
  const lower = c.toLowerCase();
  if (['black', 'blue', 'brown', 'gray', 'green', 'magenta', 'orange', 'pink', 'purple', 'red', 'teal', 'white', 'yellow', 'brass', 'chrome', 'carbon fiber black', 'lavender'].includes(lower)) {
    baseColors.push(c);
  } else if (['fairy floss', 'mermaid', 'pixie dust', 'unicorn', 'funfetti'].includes(lower)) {
    mythicalCreatures.push(c);
  } else if (lower.includes('elixir') || lower.includes('potion') || lower.includes('magic') || lower.includes('witch') || lower.includes('blood') || lower.includes('poison') || lower.includes('galaxy') || lower.includes('ruby') || lower.includes('solar') || lower.includes('night shade') || lower.includes('mint') || lower.includes('shadow')) {
    potionsElixirs.push(c);
  } else if (lower.includes('pride') || lower === 'rainbow' || lower === 'rainbow glow') {
    pride.push(c);
  } else if (lower.includes('valentine') || lower.includes('love') || lower.includes('kiss') || lower.includes('heart') || lower.includes('pumpkin') || lower.includes('ghost') || lower.includes('vampire') || lower.includes('phantom') || lower.includes('monster') || lower.includes('ghoul') || lower.includes('hex') || lower.includes('crimson') || lower.includes('burnt')) {
    seasonal.push(c);
  } else {
    special.push(c);
  }
}

console.log('CORE COLORS - DEDUPLICATED & CATEGORIZED');
console.log('='.repeat(50));
console.log('\n## BASE COLORS (' + baseColors.length + ')');
baseColors.forEach(c => console.log('  ' + c));

console.log('\n## MYTHICAL CREATURES (' + mythicalCreatures.length + ')');
mythicalCreatures.forEach(c => console.log('  ' + c));

console.log('\n## POTIONS & ELIXIRS (' + potionsElixirs.length + ')');
potionsElixirs.forEach(c => console.log('  ' + c));

console.log('\n## PRIDE COLLECTION (' + pride.length + ')');
pride.forEach(c => console.log('  ' + c));

console.log('\n## SEASONAL/HOLIDAY (' + seasonal.length + ')');
seasonal.forEach(c => console.log('  ' + c));

console.log('\n## SPECIAL/OTHER (' + special.length + ')');
special.forEach(c => console.log('  ' + c));

console.log('\n' + '='.repeat(50));
console.log('TOTAL UNIQUE CORE COLORS: ' + sorted.length);

// Odoo Color Import Script
const https = require('https');

const ODOO_URL = process.env.ODOO_URL || 'https://your-company.odoo.com';
const ODOO_DB = process.env.ODOO_DB || 'your-database';
const ODOO_USER = process.env.ODOO_USER || 'user@example.com';
const ODOO_API_KEY = process.env.ODOO_API_KEY || 'your-api-key';

const colors = [
  'Black', 'Blue', 'Brass', 'Brown', 'Carbon Fiber Black', 'Chrome', 'Gray', 'Green',
  'Lavender', 'Magenta', 'Orange', 'Pink', 'Purple', 'Red', 'Teal', 'White', 'Yellow',
  'Fairy Floss', 'Funfetti', 'Mermaid', 'Pixie Dust', 'Unicorn',
  'Blood Lust', 'Blood of My Enemies', 'Bloody Valentine', 'Dark Magic', 'Galaxy',
  'Galaxy Black', 'Lavender Elixir', 'Love Potion', 'Mint', 'Mint Elixir', 'Monster Mint',
  'Night Shade', 'Pale Blue Elixir', 'Poison Apple', 'Poison Apple Green', 'Red Shadow',
  'Ruby', 'Ruby Red', 'Solar Flare', 'Vampire Blood', "Witch's Hex", 'Witchcraft',
  'Witches Blue', 'Witches Brew',
  'Asexual Pride', 'Bi Pride', 'LGBTQ Pride', 'Lesbian Pride', 'Non-Binary Pride',
  'Pan Pride', 'Pride Progress Spikie', 'Rainbow', 'Rainbow Glow', 'Trans Pride',
  'Be My Valentine', 'Black Heart', 'Burnt By Love', 'Cherry Kiss', 'Cotton Candy Kiss',
  'Crimson Curse', 'Ghost Glitter', 'Ghoul Pop', 'Midnight Kiss', 'Phantom Frost',
  'Pumpkin Stripes', 'Pure Love',
  'ARACHNAE', 'Army Brown', 'Army Green', 'Citrus Rave', 'Electric Lime', 'Enchanted Mist',
  'Green Apple', 'Laser Lemon', 'Midnight Crush', 'Neon Berry', 'Phoenix Color Shift',
  'RGB Color Shift'
];

function jsonRpcCall(url, method, params) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params: params,
      id: Math.floor(Math.random() * 1000000)
    });

    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.error) {
            reject(new Error(JSON.stringify(result.error)));
          } else {
            resolve(result.result);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function authenticate() {
  console.log('Authenticating with Odoo...');
  const result = await jsonRpcCall(
    `${ODOO_URL}/jsonrpc`,
    'call',
    {
      service: 'common',
      method: 'authenticate',
      args: [ODOO_DB, ODOO_USER, ODOO_API_KEY, {}]
    }
  );
  return result;
}

async function executeKw(uid, model, method, args, kwargs = {}) {
  return jsonRpcCall(
    `${ODOO_URL}/jsonrpc`,
    'call',
    {
      service: 'object',
      method: 'execute_kw',
      args: [ODOO_DB, uid, ODOO_API_KEY, model, method, args, kwargs]
    }
  );
}

async function main() {
  try {
    // Authenticate
    const uid = await authenticate();
    if (!uid) {
      throw new Error('Authentication failed. Check credentials.');
    }
    console.log(`Authenticated! User ID: ${uid}\n`);

    // Find or create Color attribute
    console.log('Looking for Color attribute...');
    let colorAttrIds = await executeKw(uid, 'product.attribute', 'search', [[['name', '=', 'Color']]]);

    let colorAttrId;
    if (colorAttrIds.length === 0) {
      console.log('Creating Color attribute...');
      colorAttrId = await executeKw(uid, 'product.attribute', 'create', [{
        name: 'Color',
        display_type: 'color',
        create_variant: 'always'
      }]);
      console.log(`Created Color attribute with ID: ${colorAttrId}`);
    } else {
      colorAttrId = colorAttrIds[0];
      console.log(`Found existing Color attribute with ID: ${colorAttrId}`);
    }

    // Get existing color values
    console.log('\nChecking existing color values...');
    const existingValues = await executeKw(uid, 'product.attribute.value', 'search_read',
      [[['attribute_id', '=', colorAttrId]]],
      { fields: ['name'] }
    );
    const existingNames = new Set(existingValues.map(v => v.name.toLowerCase()));
    console.log(`Found ${existingValues.length} existing color values`);

    // Add new colors
    console.log('\nImporting colors...');
    let added = 0;
    let skipped = 0;

    for (const color of colors) {
      if (existingNames.has(color.toLowerCase())) {
        console.log(`  Skipping "${color}" (already exists)`);
        skipped++;
      } else {
        try {
          await executeKw(uid, 'product.attribute.value', 'create', [{
            name: color,
            attribute_id: colorAttrId
          }]);
          console.log(`  Added "${color}"`);
          added++;
        } catch (err) {
          console.log(`  Error adding "${color}": ${err.message}`);
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('IMPORT COMPLETE');
    console.log('='.repeat(50));
    console.log(`Added: ${added} colors`);
    console.log(`Skipped: ${skipped} (already existed)`);
    console.log(`Total in Odoo: ${existingValues.length + added} colors`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();

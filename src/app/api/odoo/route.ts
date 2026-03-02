import { NextRequest, NextResponse } from 'next/server';
import {
  getOdooConfig,
  authenticate,
  searchRead,
  write,
  create,
  OdooProduct,
} from '@/lib/odoo';

// ============================================================================
// CSV FORMAT DEFINITIONS
// ============================================================================

// 1. attribute_values.csv - Define product attributes and their values
interface AttributeValueRow {
  attribute: string;      // Required: e.g., "Color"
  value: string;          // Required: e.g., "Black"
  sequence?: string;      // Optional: display order
}

// 2. products.csv - Define product templates
interface ProductRow {
  name: string;           // Required: product name
  type: string;           // Required: "product", "consu", or "service"
  default_code?: string;  // Optional: internal reference/SKU
  categ?: string;         // Optional: category path e.g., "Finished Products / Spin Click"
  sale_ok?: string;       // Optional: "true" or "false"
  purchase_ok?: string;   // Optional: "true" or "false"
  list_price?: string;    // Optional: sale price
  standard_price?: string;// Optional: cost price
  description?: string;   // Optional: description
}

// 3. product_attributes.csv - Link attributes to products (for variants)
interface ProductAttributeRow {
  product: string;        // Required: matches products.name
  attribute: string;      // Required: e.g., "Color"
  values: string;         // Required: comma-separated e.g., "Black,Red,Blue"
}

const REQUIRED_COLUMNS = {
  attribute_values: ['attribute', 'value'],
  products: ['name', 'type'],
  product_attributes: ['product', 'attribute', 'values'],
};

const VALID_PRODUCT_TYPES = ['product', 'consu', 'service'];

// ============================================================================
// COLOR NAMING CONVENTIONS
// ============================================================================
// Standard 4-letter color codes used in SKUs
export const COLOR_CODES: Record<string, string> = {
  // Base Colors
  'Black': 'BLCK', 'Blue': 'BLUE', 'Brass': 'BRAS', 'Brown': 'BRWN',
  'Carbon Fiber Black': 'CRBN', 'Chrome': 'CHRM', 'Gray': 'GRAY', 'Green': 'GREN',
  'Lavender': 'LAVR', 'Magenta': 'MGTA', 'Orange': 'ORNG', 'Pink': 'PINK',
  'Purple': 'PRPL', 'Red': 'RED_', 'Teal': 'TEAL', 'White': 'WHTE', 'Yellow': 'YLLW',
  // Mythical Creatures
  'Fairy Floss': 'FFLS', 'Funfetti': 'FNFT', 'Mermaid': 'MRMD', 'Pixie Dust': 'PXDT', 'Unicorn': 'UNCN',
  // Potions & Elixirs
  'Blood Lust': 'BLST', 'Blood of My Enemies': 'BOME', 'Bloody Valentine': 'BVLN',
  'Dark Magic': 'DKMG', 'Galaxy': 'GLXY', 'Galaxy Black': 'GXBK', 'Lavender Elixir': 'LVEX',
  'Love Potion': 'LVPT', 'Mint': 'MINT', 'Mint Elixir': 'MNEX', 'Monster Mint': 'MNMN',
  'Night Shade': 'NTSH', 'Pale Blue Elixir': 'PBEX', 'Poison Apple': 'PSAP',
  'Poison Apple Green': 'PSGN', 'Red Shadow': 'RDSH', 'Ruby': 'RUBY', 'Ruby Red': 'RBRD',
  'Solar Flare': 'SLFL', 'Vampire Blood': 'VMPB', "Witch's Hex": 'WTHX',
  'Witchcraft': 'WTCF', 'Witches Blue': 'WTBL', 'Witches Brew': 'WTBR',
  // Pride Collection
  'Asexual Pride': 'ASEX', 'Bi Pride': 'BIPR', 'LGBTQ Pride': 'LGBT', 'Lesbian Pride': 'LESB',
  'Non-Binary Pride': 'NBNR', 'Pan Pride': 'PANP', 'Pride Progress': 'PRGS',
  'Rainbow': 'RNBW', 'Rainbow Glow': 'RBGL', 'Trans Pride': 'TRNS',
  // Seasonal/Holiday
  'Be My Valentine': 'BMVL', 'Black Heart': 'BKHT', 'Burnt By Love': 'BBLV',
  'Cherry Kiss': 'CHKS', 'Cotton Candy Kiss': 'CCKS', 'Crimson Curse': 'CRCS',
  'Ghost Glitter': 'GHGL', 'Ghoul Pop': 'GHPP', 'Midnight Kiss': 'MDKS',
  'Phantom Frost': 'PHFR', 'Pumpkin Stripes': 'PKST', 'Pure Love': 'PRLV',
  // Special/Other
  'ARACHNAE': 'ARCH', 'Army Brown': 'AMBR', 'Army Green': 'AMGR', 'Citrus Rave': 'CTRV',
  'Electric Lime': 'ELIM', 'Enchanted Mist': 'ENMS', 'Green Apple': 'GRAP',
  'Laser Lemon': 'LSLM', 'Midnight Crush': 'MDCR', 'Neon Berry': 'NNBR',
  'Phoenix Color Shift': 'PHCS', 'RGB Color Shift': 'RGBS',
};

// Build reverse lookup: code -> name
const CODE_TO_NAME: Record<string, string> = {};
for (const [name, code] of Object.entries(COLOR_CODES)) {
  CODE_TO_NAME[code] = name;
}

// Generate a unique 4-letter code for a color name
export function generateColorCode(colorName: string, existingCodes: Set<string>): string {
  // Remove special characters and spaces, get uppercase letters
  const cleaned = colorName.replace(/[^a-zA-Z]/g, '').toUpperCase();

  // Strategy 1: First 4 letters
  let code = cleaned.substring(0, 4).padEnd(4, '_');
  if (!existingCodes.has(code)) return code;

  // Strategy 2: First letter + consonants
  const consonants = cleaned.replace(/[AEIOU]/g, '');
  if (consonants.length >= 4) {
    code = consonants.substring(0, 4);
    if (!existingCodes.has(code)) return code;
  }

  // Strategy 3: First 2 letters of each word
  const words = colorName.split(/\s+/);
  if (words.length >= 2) {
    code = words.map(w => w.substring(0, 2).toUpperCase()).join('').substring(0, 4).padEnd(4, '_');
    if (!existingCodes.has(code)) return code;
  }

  // Strategy 4: Add numbers
  for (let i = 1; i <= 99; i++) {
    const base = cleaned.substring(0, 2);
    code = `${base}${i.toString().padStart(2, '0')}`;
    if (!existingCodes.has(code)) return code;
  }

  throw new Error(`Could not generate unique code for color: ${colorName}`);
}

// ============================================================================
// PRODUCT NAMING CONVENTIONS
// ============================================================================
// Product families with their naming patterns
export const PRODUCT_FAMILIES: Record<string, {
  name: string;
  skuPrefix: string;
  category: string;
  description: string;
}> = {
  'GRP': { name: 'Grippie', skuPrefix: 'GRP', category: 'Finished Products / Grippie', description: 'Standard Grippie fidget' },
  'GRP-MINI': { name: 'Mini Grippie', skuPrefix: 'GMINI', category: 'Finished Products / Mini Grippie', description: 'Mini sized Grippie' },
  'GRP-XL': { name: 'Grippie XL', skuPrefix: 'XL', category: 'Finished Products / Grippie XL', description: 'Extra large Grippie' },
  'SPK': { name: 'Spikie', skuPrefix: 'SPIKIE', category: 'Finished Products / Spikie', description: 'Standard Spikie fidget' },
  'SPK-MINI': { name: 'Mini Spikie', skuPrefix: 'MiniSpikie', category: 'Finished Products / Mini Spikie', description: 'Mini sized Spikie' },
  'SPK-MAX': { name: 'Spikie MAX', skuPrefix: 'SPIKIE-MAX', category: 'Finished Products / Spikie MAX', description: 'Maximum intensity Spikie' },
  'SC': { name: 'Grippie Spin Click', skuPrefix: 'SPINCLICK', category: 'Finished Products / Spin Click', description: 'Grippie with spin and click' },
  'SSC': { name: 'Spikie Spin Click', skuPrefix: 'SPIKIESPINCLICK', category: 'Finished Products / Spikie Spin Click', description: 'Spikie with spin and click' },
  'SMSC': { name: 'Spikie MAX Spin Click', skuPrefix: 'SPIKIE-MAX-SC', category: 'Finished Products / Spikie MAX Spin Click', description: 'MAX Spikie spin click' },
  'ERGO': { name: 'Grippie Ergo', skuPrefix: 'ERGO', category: 'Finished Products / Ergo', description: 'Ergonomic Grippie' },
  'RING': { name: 'Grippie Ring', skuPrefix: 'RING', category: 'Finished Products / Ring', description: 'Wearable ring fidget' },
  'ROLLER': { name: 'Grippie Roller', skuPrefix: 'ROLLER', category: 'Finished Products / Roller', description: 'Rolling fidget' },
  'KEYTAR': { name: 'Spikie Keytar', skuPrefix: 'SpikieKeytar', category: 'Finished Products / Keytar', description: 'Keychain Spikie' },
  'SQUISH': { name: 'Squish', skuPrefix: 'SQUISH', category: 'Finished Products / Squish', description: 'Flexible squish fidget' },
  'CLICK': { name: 'Spikie Click', skuPrefix: 'Spikie-Click', category: 'Finished Products / Click', description: 'Click-only Spikie' },
  'GSTICK': { name: 'Grippie Chapstick', skuPrefix: 'GSTICK', category: 'Finished Products / Chapstick', description: 'Chapstick holder' },
  'BIC': { name: 'BIC Lighter Sleeve', skuPrefix: 'BIC', category: 'Finished Products / Lighter', description: 'BIC lighter grippie sleeve' },
  'CLIP': { name: 'Clipper Lighter Sleeve', skuPrefix: 'CLIP', category: 'Finished Products / Lighter', description: 'Clipper lighter grippie sleeve' },
  'EARRING': { name: 'Spikie Earrings', skuPrefix: 'EARRINGS', category: 'Finished Products / Earrings', description: 'Spikie earring pair' },
};

// Function to generate product name from family and color
export function generateProductName(familyCode: string, color: string): string {
  const family = PRODUCT_FAMILIES[familyCode];
  if (!family) return `${familyCode} - ${color}`;
  return `${family.name} - ${color}`;
}

// Function to generate SKU from family and color
export function generateSku(familyCode: string, color: string): string {
  const family = PRODUCT_FAMILIES[familyCode];
  const colorCode = COLOR_CODES[color] || color.substring(0, 4).toUpperCase();
  const prefix = family?.skuPrefix || familyCode;
  return `${prefix}-${colorCode}`;
}

// Check if a color code already exists
export function isCodeTaken(code: string): boolean {
  return code in CODE_TO_NAME;
}

// Check if a color name already exists
export function isNameTaken(name: string): boolean {
  return name in COLOR_CODES;
}

// ============================================================================
// CSV PARSING
// ============================================================================

function parseCSV<T extends Record<string, string>>(csvText: string): { headers: string[]; rows: T[] } {
  const lines = csvText.trim().split('\n');
  if (lines.length < 1) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const rows: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));

    const row = {} as T;
    headers.forEach((header, idx) => {
      (row as Record<string, string>)[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function validateColumns(headers: string[], required: string[], csvType: string): string[] {
  const errors: string[] = [];
  const headersLower = headers.map(h => h.toLowerCase());

  for (const col of required) {
    if (!headersLower.includes(col.toLowerCase())) {
      errors.push(`Missing required column "${col}" in ${csvType}`);
    }
  }

  return errors;
}

// ============================================================================
// ODOO OPERATIONS
// ============================================================================

interface ImportResult {
  type: string;
  status: 'created' | 'updated' | 'skipped' | 'error';
  name: string;
  message: string;
  id?: number;
}

async function getOrCreateCategory(
  config: ReturnType<typeof getOdooConfig>,
  uid: number,
  categoryPath: string
): Promise<number> {
  // Try to find existing category by complete_name
  const existing = await searchRead<{ id: number }>(
    config, uid, 'product.category',
    [['complete_name', '=', categoryPath]],
    ['id']
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Create category path segments
  const segments = categoryPath.split('/').map(s => s.trim());
  let parentId: number | null = null;

  for (const segment of segments) {
    const domain: unknown[][] = [['name', '=', segment]];
    if (parentId) {
      domain.push(['parent_id', '=', parentId]);
    } else {
      domain.push(['parent_id', '=', false]);
    }

    const found = await searchRead<{ id: number }>(
      config, uid, 'product.category', domain, ['id']
    );

    if (found.length > 0) {
      parentId = found[0].id;
    } else {
      parentId = await create(config, uid, 'product.category', {
        name: segment,
        parent_id: parentId || false,
      });
    }
  }

  return parentId!;
}

async function getOrCreateAttribute(
  config: ReturnType<typeof getOdooConfig>,
  uid: number,
  attributeName: string
): Promise<number> {
  const existing = await searchRead<{ id: number }>(
    config, uid, 'product.attribute',
    [['name', '=', attributeName]],
    ['id']
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  return create(config, uid, 'product.attribute', {
    name: attributeName,
    create_variant: 'always',
  });
}

async function getOrCreateAttributeValue(
  config: ReturnType<typeof getOdooConfig>,
  uid: number,
  attributeId: number,
  valueName: string,
  sequence?: number
): Promise<number> {
  const existing = await searchRead<{ id: number }>(
    config, uid, 'product.attribute.value',
    [['attribute_id', '=', attributeId], ['name', '=', valueName]],
    ['id']
  );

  if (existing.length > 0) {
    return existing[0].id;
  }

  const values: Record<string, unknown> = {
    attribute_id: attributeId,
    name: valueName,
  };

  if (sequence !== undefined) values.sequence = sequence;

  return create(config, uid, 'product.attribute.value', values);
}

// Upload image to attribute value
async function uploadAttributeValueImage(
  config: ReturnType<typeof getOdooConfig>,
  uid: number,
  valueId: number,
  imageBase64: string
): Promise<boolean> {
  return write(config, uid, 'product.attribute.value', [valueId], {
    image: imageBase64,
  });
}

// ============================================================================
// API HANDLERS
// ============================================================================

async function handleColorImageUpload(formData: FormData) {
  const config = getOdooConfig();
  if (!config.apiKey) {
    return NextResponse.json({
      success: false,
      error: 'Odoo API key not configured',
    }, { status: 500 });
  }

  const uid = await authenticate(config);
  const dryRun = formData.get('dryRun') === 'true';

  // Get all files from form data
  const files: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (key === 'images' && value instanceof File) {
      files.push(value);
    }
  }

  if (files.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No image files provided',
    }, { status: 400 });
  }

  // Get the Color attribute ID
  const colorAttr = await searchRead<{ id: number }>(
    config, uid, 'product.attribute',
    [['name', '=', 'Color']],
    ['id']
  );

  if (colorAttr.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'Color attribute not found in Odoo. Please create attribute values first.',
    }, { status: 400 });
  }

  const colorAttrId = colorAttr[0].id;

  const results: { name: string; status: string; message: string }[] = [];
  const errors: { file: string; error: string }[] = [];

  for (const file of files) {
    // Extract color name from filename (remove extension)
    const colorName = file.name.replace(/\.[^.]+$/, '');

    try {
      // Find the attribute value by name
      const attrValue = await searchRead<{ id: number; name: string }>(
        config, uid, 'product.attribute.value',
        [['attribute_id', '=', colorAttrId], ['name', '=', colorName]],
        ['id', 'name']
      );

      if (attrValue.length === 0) {
        errors.push({
          file: file.name,
          error: `Color "${colorName}" not found in Odoo. Create the color first.`,
        });
        continue;
      }

      if (!dryRun) {
        // Convert image to base64
        const arrayBuffer = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');

        // Upload image to attribute value
        await uploadAttributeValueImage(config, uid, attrValue[0].id, base64);

        results.push({
          name: colorName,
          status: 'updated',
          message: `Image uploaded for color "${colorName}"`,
        });
      } else {
        results.push({
          name: colorName,
          status: 'skipped',
          message: `Would upload image for color "${colorName}" (dry run)`,
        });
      }
    } catch (err) {
      errors.push({
        file: file.name,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    uploadType: 'color_images',
    summary: {
      total: files.length,
      updated: results.filter(r => r.status === 'updated').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: errors.length,
    },
    results,
    errors,
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  try {
    const config = getOdooConfig();

    if (!config.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Odoo API key not configured',
      }, { status: 500 });
    }

    const uid = await authenticate(config);

    if (action === 'test') {
      return NextResponse.json({
        success: true,
        message: 'Connected to Odoo successfully',
        userId: uid,
      });
    }

    if (action === 'products') {
      const limit = parseInt(searchParams.get('limit') || '100');
      const offset = parseInt(searchParams.get('offset') || '0');
      const search = searchParams.get('search') || '';

      const domain: unknown[] = [];
      if (search) {
        // Odoo domain format: ['|', [...], [...]] for OR conditions
        domain.push('|', ['name', 'ilike', search], ['default_code', 'ilike', search]);
      }

      const products = await searchRead<OdooProduct>(
        config, uid, 'product.product',
        domain,
        ['id', 'name', 'default_code', 'list_price', 'qty_available', 'categ_id'],
        { limit, offset, order: 'default_code' }
      );

      return NextResponse.json({ success: true, products, count: products.length });
    }

    if (action === 'categories') {
      const categories = await searchRead<{ id: number; name: string; complete_name: string }>(
        config, uid, 'product.category',
        [],
        ['id', 'name', 'complete_name'],
        { order: 'complete_name' }
      );

      return NextResponse.json({ success: true, categories });
    }

    if (action === 'attributes') {
      const attributes = await searchRead<{ id: number; name: string }>(
        config, uid, 'product.attribute',
        [],
        ['id', 'name'],
        { order: 'name' }
      );

      return NextResponse.json({ success: true, attributes });
    }

    if (action === 'templates') {
      // Generate color rows
      const colorRows = Object.entries(COLOR_CODES)
        .map(([name, code], idx) => `Color,${name},${idx + 1}`)
        .join('\n');

      // Generate sample products from families
      const productRows = Object.entries(PRODUCT_FAMILIES)
        .slice(0, 5)
        .map(([code, family]) => `${family.name} Template,product,${family.skuPrefix},${family.category},true,false,14.99,4.00`)
        .join('\n');

      const templates = {
        attribute_values: `attribute,value,sequence\n${colorRows}`,
        products: `name,type,default_code,categ,sale_ok,purchase_ok,list_price,standard_price\n${productRows}`,
        product_attributes: 'product,attribute,values\nGrippie Template,Color,"Black,Red,Blue,Green,Purple,Teal,Pink,Orange,Yellow,White,Gray"\nSpikie Template,Color,"Black,White,Purple,Pink,Teal,Blue"\nGrippie Spin Click Template,Color,"Black,Gray,White,Purple,Pink,Teal"',
      };

      return NextResponse.json({ success: true, templates });
    }

    if (action === 'colors') {
      // Return all color codes
      const colors = Object.entries(COLOR_CODES).map(([name, code]) => ({
        name,
        code,
      }));
      return NextResponse.json({ success: true, colors });
    }

    if (action === 'families') {
      // Return all product families
      const families = Object.entries(PRODUCT_FAMILIES).map(([code, family]) => ({
        code,
        ...family,
      }));
      return NextResponse.json({ success: true, families });
    }

    return NextResponse.json({
      success: true,
      message: 'Odoo API ready',
      endpoints: {
        'GET ?action=test': 'Test connection',
        'GET ?action=products': 'List products',
        'GET ?action=categories': 'List categories',
        'GET ?action=attributes': 'List attributes',
        'GET ?action=templates': 'Get CSV templates',
        'POST': 'Upload CSV files',
      },
    });
  } catch (error) {
    console.error('Odoo API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const uploadType = formData.get('uploadType') as string;

    // Handle color image uploads
    if (uploadType === 'color_images') {
      return handleColorImageUpload(formData);
    }

    // Handle CSV uploads
    const csvType = formData.get('csvType') as string;
    const file = formData.get('file') as File | null;
    const dryRun = formData.get('dryRun') === 'true';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!csvType || !['attribute_values', 'products', 'product_attributes'].includes(csvType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid csvType. Must be: attribute_values, products, or product_attributes' },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const { headers, rows } = parseCSV(csvText);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'CSV file is empty or invalid' },
        { status: 400 }
      );
    }

    // Validate required columns
    const requiredCols = REQUIRED_COLUMNS[csvType as keyof typeof REQUIRED_COLUMNS];
    const columnErrors = validateColumns(headers, requiredCols, csvType);

    if (columnErrors.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'CSV validation failed',
        details: columnErrors,
        expectedColumns: requiredCols,
        receivedColumns: headers,
      }, { status: 400 });
    }

    const config = getOdooConfig();
    if (!config.apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Odoo API key not configured',
      }, { status: 500 });
    }

    const uid = await authenticate(config);
    const results: ImportResult[] = [];
    const errors: { row: number; error: string }[] = [];

    // Process based on CSV type
    if (csvType === 'attribute_values') {
      const typedRows = rows as unknown as AttributeValueRow[];

      // Build set of existing color codes for duplicate checking
      const existingCodes = new Set(Object.values(COLOR_CODES));
      const existingNames = new Set(Object.keys(COLOR_CODES));
      // Track new colors added in this batch
      const batchNames = new Set<string>();
      const batchCodes = new Set<string>();

      for (let i = 0; i < typedRows.length; i++) {
        const row = typedRows[i];

        if (!row.attribute || !row.value) {
          errors.push({ row: i + 2, error: 'Missing attribute or value' });
          continue;
        }

        const isColorAttr = row.attribute.toLowerCase() === 'color';
        let colorCode: string | undefined;

        if (isColorAttr) {
          // Check for duplicate name
          if (existingNames.has(row.value) || batchNames.has(row.value)) {
            // Color already exists - that's OK, we'll just use it
            colorCode = COLOR_CODES[row.value];
            results.push({
              type: 'attribute_value',
              status: 'skipped',
              name: `${row.attribute}: ${row.value}`,
              message: `Color already exists with code ${colorCode}`,
            });
            continue;
          }

          // Generate a unique 4-letter code
          const allCodes = new Set([...existingCodes, ...batchCodes]);
          try {
            colorCode = generateColorCode(row.value, allCodes);
          } catch (err) {
            errors.push({ row: i + 2, error: err instanceof Error ? err.message : 'Could not generate color code' });
            continue;
          }

          // Track this new color
          batchNames.add(row.value);
          batchCodes.add(colorCode);
        }

        try {
          if (!dryRun) {
            const attrId = await getOrCreateAttribute(config, uid, row.attribute);
            const valueId = await getOrCreateAttributeValue(
              config, uid, attrId, row.value,
              row.sequence ? parseInt(row.sequence) : undefined
            );

            results.push({
              type: 'attribute_value',
              status: 'created',
              name: `${row.attribute}: ${row.value}`,
              message: isColorAttr ? `Created with code ${colorCode}` : 'Attribute value created',
              id: valueId,
            });
          } else {
            results.push({
              type: 'attribute_value',
              status: 'created',
              name: `${row.attribute}: ${row.value}`,
              message: isColorAttr ? `Would create with code ${colorCode} (dry run)` : 'Would create (dry run)',
            });
          }
        } catch (err) {
          errors.push({ row: i + 2, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }
    }

    if (csvType === 'products') {
      const typedRows = rows as unknown as ProductRow[];

      for (let i = 0; i < typedRows.length; i++) {
        const row = typedRows[i];

        if (!row.name) {
          errors.push({ row: i + 2, error: 'Missing product name' });
          continue;
        }

        if (!VALID_PRODUCT_TYPES.includes(row.type)) {
          errors.push({ row: i + 2, error: `Invalid type "${row.type}". Must be: ${VALID_PRODUCT_TYPES.join(', ')}` });
          continue;
        }

        try {
          // Check if product exists
          const existing = await searchRead<{ id: number }>(
            config, uid, 'product.template',
            [['name', '=', row.name]],
            ['id']
          );

          const values: Record<string, unknown> = {
            name: row.name,
            type: row.type,
          };

          if (row.default_code) values.default_code = row.default_code;
          if (row.sale_ok) values.sale_ok = row.sale_ok.toLowerCase() === 'true';
          if (row.purchase_ok) values.purchase_ok = row.purchase_ok.toLowerCase() === 'true';
          if (row.list_price) values.list_price = parseFloat(row.list_price);
          if (row.standard_price) values.standard_price = parseFloat(row.standard_price);
          if (row.description) values.description = row.description;

          if (row.categ && !dryRun) {
            values.categ_id = await getOrCreateCategory(config, uid, row.categ);
          }

          if (!dryRun) {
            if (existing.length > 0) {
              await write(config, uid, 'product.template', [existing[0].id], values);
              results.push({
                type: 'product',
                status: 'updated',
                name: row.name,
                message: 'Product updated',
                id: existing[0].id,
              });
            } else {
              const productId = await create(config, uid, 'product.template', values);
              results.push({
                type: 'product',
                status: 'created',
                name: row.name,
                message: 'Product created',
                id: productId,
              });
            }
          } else {
            results.push({
              type: 'product',
              status: existing.length > 0 ? 'updated' : 'created',
              name: row.name,
              message: `Would ${existing.length > 0 ? 'update' : 'create'} product (dry run)`,
            });
          }
        } catch (err) {
          errors.push({ row: i + 2, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }
    }

    if (csvType === 'product_attributes') {
      const typedRows = rows as unknown as ProductAttributeRow[];

      for (let i = 0; i < typedRows.length; i++) {
        const row = typedRows[i];

        if (!row.product || !row.attribute || !row.values) {
          errors.push({ row: i + 2, error: 'Missing product, attribute, or values' });
          continue;
        }

        try {
          // Find product template
          const products = await searchRead<{ id: number }>(
            config, uid, 'product.template',
            [['name', '=', row.product]],
            ['id']
          );

          if (products.length === 0) {
            errors.push({ row: i + 2, error: `Product "${row.product}" not found` });
            continue;
          }

          const productId = products[0].id;

          // Get or create attribute
          const attrId = await getOrCreateAttribute(config, uid, row.attribute);

          // Parse and create attribute values
          const valueNames = row.values.split(',').map(v => v.trim()).filter(v => v);
          const valueIds: number[] = [];

          for (const valueName of valueNames) {
            if (!dryRun) {
              const valueId = await getOrCreateAttributeValue(config, uid, attrId, valueName);
              valueIds.push(valueId);
            }
          }

          if (!dryRun) {
            // Check if attribute line exists
            const existingLines = await searchRead<{ id: number }>(
              config, uid, 'product.template.attribute.line',
              [['product_tmpl_id', '=', productId], ['attribute_id', '=', attrId]],
              ['id']
            );

            if (existingLines.length > 0) {
              // Update existing line
              await write(config, uid, 'product.template.attribute.line', [existingLines[0].id], {
                value_ids: [[6, 0, valueIds]],
              });
              results.push({
                type: 'product_attribute',
                status: 'updated',
                name: `${row.product} - ${row.attribute}`,
                message: `Updated with values: ${valueNames.join(', ')}`,
                id: existingLines[0].id,
              });
            } else {
              // Create new attribute line
              const lineId = await create(config, uid, 'product.template.attribute.line', {
                product_tmpl_id: productId,
                attribute_id: attrId,
                value_ids: [[6, 0, valueIds]],
              });
              results.push({
                type: 'product_attribute',
                status: 'created',
                name: `${row.product} - ${row.attribute}`,
                message: `Created with values: ${valueNames.join(', ')}`,
                id: lineId,
              });
            }
          } else {
            results.push({
              type: 'product_attribute',
              status: 'created',
              name: `${row.product} - ${row.attribute}`,
              message: `Would link values: ${valueNames.join(', ')} (dry run)`,
            });
          }
        } catch (err) {
          errors.push({ row: i + 2, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }
    }

    const summary = {
      total: rows.length,
      created: results.filter(r => r.status === 'created').length,
      updated: results.filter(r => r.status === 'updated').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: errors.length,
    };

    return NextResponse.json({
      success: true,
      dryRun,
      csvType,
      summary,
      results,
      errors: errors.slice(0, 20), // First 20 errors
    });
  } catch (error) {
    console.error('Odoo upload error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

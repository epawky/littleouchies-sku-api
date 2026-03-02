import { NextResponse } from 'next/server';
import { db, colors } from '@/db';
import { eq } from 'drizzle-orm';
import { getOdooConfig, authenticate, searchRead } from '@/lib/odoo';

interface OdooColorValue {
  id: number;
  name: string;
  html_color: string | false;
  x_color_code?: string | false;
}

// Generate a 4-character code from a color name
function generateColorCode(name: string, existingCodes: Set<string>): string {
  // Clean the name
  const clean = name.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Strategy 1: First 4 characters
  let code = clean.substring(0, 4).padEnd(4, '_');
  if (!existingCodes.has(code)) return code;

  // Strategy 2: Consonants
  const consonants = clean.replace(/[AEIOU]/g, '');
  code = consonants.substring(0, 4).padEnd(4, '_');
  if (!existingCodes.has(code)) return code;

  // Strategy 3: First letter + consonants
  if (clean.length > 0) {
    code = clean[0] + consonants.substring(0, 3);
    code = code.padEnd(4, '_');
    if (!existingCodes.has(code)) return code;
  }

  // Strategy 4: Abbreviate words
  const words = name.toUpperCase().split(/[\s-]+/);
  if (words.length >= 2) {
    code = words.map(w => w[0] || '').join('').substring(0, 4).padEnd(4, '_');
    if (!existingCodes.has(code)) return code;
  }

  // Strategy 5: Add numbers
  for (let i = 1; i <= 99; i++) {
    const numSuffix = i.toString().padStart(2, '0');
    code = clean.substring(0, 2) + numSuffix;
    if (!existingCodes.has(code)) return code;
  }

  throw new Error(`Could not generate unique code for: ${name}`);
}

// GET - list all colors from DB or sync from Odoo
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sync = searchParams.get('sync') === 'true';

  try {
    if (sync) {
      // Sync colors from Odoo
      const config = getOdooConfig();
      const uid = await authenticate(config);

      // Get Color attribute ID
      const colorAttrIds = await searchRead<{ id: number }>(
        config, uid, 'product.attribute',
        [['name', '=', 'Color']],
        ['id']
      );

      if (colorAttrIds.length === 0) {
        return NextResponse.json({ error: 'Color attribute not found in Odoo' }, { status: 404 });
      }

      const colorAttrId = colorAttrIds[0].id;

      // Get all color values
      const odooColors = await searchRead<OdooColorValue>(
        config, uid, 'product.attribute.value',
        [['attribute_id', '=', colorAttrId]],
        ['id', 'name', 'html_color', 'x_color_code']
      );

      // Get existing codes to avoid duplicates
      const existingColors = await db.select().from(colors);
      const existingCodes = new Set(existingColors.map(c => c.code));

      // Upsert colors
      const results = { synced: 0, created: 0, updated: 0, errors: [] as string[] };

      for (const oc of odooColors) {
        try {
          // Determine the code
          let code = oc.x_color_code && typeof oc.x_color_code === 'string'
            ? oc.x_color_code.toUpperCase().substring(0, 4)
            : null;

          // Check if color exists by Odoo ID
          const existing = existingColors.find(c => c.odooId === oc.id);

          if (existing) {
            // Update existing
            await db.update(colors)
              .set({
                name: oc.name,
                hexColor: typeof oc.html_color === 'string' ? oc.html_color : null,
                code: code || existing.code, // Keep existing code if no new one
                lastSyncedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(colors.odooId, oc.id));
            results.updated++;
          } else {
            // Generate code if not provided
            if (!code) {
              code = generateColorCode(oc.name, existingCodes);
            }
            existingCodes.add(code);

            // Create new
            await db.insert(colors).values({
              odooId: oc.id,
              name: oc.name,
              code,
              hexColor: typeof oc.html_color === 'string' ? oc.html_color : null,
              lastSyncedAt: new Date(),
            });
            results.created++;
          }
          results.synced++;
        } catch (err) {
          results.errors.push(`${oc.name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      // Get updated list
      const allColors = await db.select().from(colors);

      return NextResponse.json({
        success: true,
        ...results,
        colors: allColors,
      });
    }

    // Just return existing colors
    const allColors = await db.select().from(colors);
    return NextResponse.json({ success: true, colors: allColors });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

// POST - create a new color with auto-generated code
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, hexColor, odooId, category } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Get existing codes
    const existingColors = await db.select().from(colors);
    const existingCodes = new Set(existingColors.map(c => c.code));

    // Check if name already exists
    if (existingColors.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: 'Color with this name already exists' }, { status: 400 });
    }

    // Generate code
    const code = generateColorCode(name, existingCodes);

    // Insert
    const [newColor] = await db.insert(colors).values({
      odooId: odooId || 0,
      name,
      code,
      hexColor: hexColor || null,
      category: category || null,
    }).returning();

    return NextResponse.json({ success: true, color: newColor });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

// PUT - update a color
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, code, hexColor, category, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (code !== undefined) updates.code = code.toUpperCase().substring(0, 4);
    if (hexColor !== undefined) updates.hexColor = hexColor;
    if (category !== undefined) updates.category = category;
    if (isActive !== undefined) updates.isActive = isActive;

    const [updated] = await db.update(colors)
      .set(updates)
      .where(eq(colors.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Color not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, color: updated });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

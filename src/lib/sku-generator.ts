// SKU Generation Logic

interface SkuConfig {
  prefix: string;
  separator: string;
  includeCategory: boolean;
  includeVariantCode: boolean;
}

const defaultConfig: SkuConfig = {
  prefix: 'LO',
  separator: '-',
  includeCategory: true,
  includeVariantCode: true,
};

// Category detection based on product title keywords
const categoryKeywords: Record<string, string[]> = {
  'GRP': ['grippie', 'grip'],
  'GMINI': ['mini grippie', 'mini grip'],
  'GSTICK': ['chapstick', 'lip balm'],
  'CLICK': ['click'],
  'XL': ['xl', 'extra large'],
  'ERGO': ['ergo'],
  'ROLLER': ['roller'],
  'RING': ['ring'],
  'SPIN': ['spin'],
  'CAN': ['coozie', 'can'],
  'BIC': ['bic lighter'],
  'CLIP': ['clipper'],
  'POD': ['pod', 'airpod'],
  'SPIKIE': ['spikie', 'spike'],
  'KEYTAR': ['keytar'],
  'SQUISH': ['squish'],
  'GC': ['gift card'],
  'BOX': ['box', 'bundle'],
};

// Color code mappings
const colorCodes: Record<string, string> = {
  'black': 'BLK',
  'white': 'WHT',
  'gray': 'GRY',
  'grey': 'GRY',
  'red': 'RED',
  'orange': 'ORG',
  'yellow': 'YLW',
  'green': 'GRN',
  'teal': 'TEAL',
  'blue': 'BLU',
  'purple': 'PUR',
  'pink': 'PNK',
  'magenta': 'MAG',
  'brown': 'BRN',
  // Special colors
  'unicorn': 'UNICORN',
  'mermaid': 'MERMAID',
  'pixie dust': 'PIXIEDUST',
  'fairy floss': 'FAIRYFLOSS',
  'dark magic': 'DARKMAGIC',
  'galaxy': 'GALAXY',
  'rainbow': 'RAINBOW',
  'rgb': 'RGB',
};

export function detectCategory(productTitle: string): string | null {
  const titleLower = productTitle.toLowerCase();

  for (const [code, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(k => titleLower.includes(k))) {
      return code;
    }
  }

  return null;
}

export function generateColorCode(variantTitle: string): string {
  const titleLower = variantTitle.toLowerCase();

  for (const [color, code] of Object.entries(colorCodes)) {
    if (titleLower.includes(color)) {
      return code;
    }
  }

  // Generate code from first 3-4 consonants
  const cleaned = variantTitle.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const consonants = cleaned.replace(/[AEIOU]/g, '');

  if (consonants.length >= 3) {
    return consonants.substring(0, 4);
  }

  return cleaned.substring(0, 4);
}

export function generateSku(
  productTitle: string,
  variantTitle: string,
  existingSkus: Set<string> = new Set(),
  config: SkuConfig = defaultConfig
): string {
  const parts: string[] = [];

  // Add category code
  const category = detectCategory(productTitle);
  if (category) {
    parts.push(category);
  }

  // Add variant/color code if not "Default Title"
  if (variantTitle && variantTitle !== 'Default Title') {
    const variantCode = generateColorCode(variantTitle);
    parts.push(variantCode);
  }

  let baseSku = parts.join(config.separator);

  // Ensure uniqueness
  if (!existingSkus.has(baseSku)) {
    return baseSku;
  }

  // Add numeric suffix
  let counter = 1;
  while (existingSkus.has(`${baseSku}${config.separator}${counter}`)) {
    counter++;
  }

  return `${baseSku}${config.separator}${counter}`;
}

// Generate SKUs for products missing them
export interface SkuSuggestion {
  shopifyVariantId: string;
  productTitle: string;
  variantTitle: string;
  currentSku: string | null;
  suggestedSku: string;
}

export function generateSkuSuggestions(
  variants: Array<{
    shopifyId: string;
    productTitle: string;
    variantTitle: string;
    currentSku: string | null;
  }>,
  existingSkus: Set<string>
): SkuSuggestion[] {
  const suggestions: SkuSuggestion[] = [];
  const newSkus = new Set(existingSkus);

  for (const variant of variants) {
    if (!variant.currentSku) {
      const suggestedSku = generateSku(
        variant.productTitle,
        variant.variantTitle,
        newSkus
      );

      newSkus.add(suggestedSku);

      suggestions.push({
        shopifyVariantId: variant.shopifyId,
        productTitle: variant.productTitle,
        variantTitle: variant.variantTitle,
        currentSku: variant.currentSku,
        suggestedSku,
      });
    }
  }

  return suggestions;
}

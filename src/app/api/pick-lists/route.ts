import { NextResponse } from 'next/server';
import { shopifyGraphQL } from '@/lib/shopify';

// Color codes for component mapping
const colorCodes: Record<string, string> = {
  'Black': 'BLCK', 'Blue': 'BLUE', 'Brass': 'BRAS', 'Brown': 'BRWN',
  'Carbon Fiber Black': 'CRBN', 'Chrome': 'CHRM', 'Gray': 'GRAY', 'Green': 'GREN',
  'Lavender': 'LAVR', 'Magenta': 'MGTA', 'Orange': 'ORNG', 'Pink': 'PINK',
  'Purple': 'PRPL', 'Red': 'RED_', 'Teal': 'TEAL', 'White': 'WHTE', 'Yellow': 'YLLW',
  'Fairy Floss': 'FFLS', 'Funfetti': 'FNFT', 'Mermaid': 'MRMD', 'Pixie Dust': 'PXDT', 'Unicorn': 'UNCN',
  'Blood Lust': 'BLST', 'Blood of My Enemies': 'BOME', 'Bloody Valentine': 'BVLN',
  'Dark Magic': 'DKMG', 'Galaxy': 'GLXY', 'Galaxy Black': 'GXBK', 'Lavender Elixir': 'LVEX',
  'Love Potion': 'LVPT', 'Mint': 'MINT', 'Mint Elixir': 'MNEX', 'Monster Mint': 'MNMN',
  'Night Shade': 'NTSH', 'Pale Blue Elixir': 'PBEX', 'Poison Apple': 'PSAP',
  'Poison Apple Green': 'PSGN', 'Red Shadow': 'RDSH', 'Ruby': 'RUBY', 'Ruby Red': 'RBRD',
  'Solar Flare': 'SLFL', 'Vampire Blood': 'VMPB', "Witch's Hex": 'WTHX',
  'Witchcraft': 'WTCF', 'Witches Blue': 'WTBL', 'Witches Brew': 'WTBR',
  'Asexual Pride': 'ASEX', 'Bi Pride': 'BIPR', 'LGBTQ Pride': 'LGBT', 'Lesbian Pride': 'LESB',
  'Non-Binary Pride': 'NBNR', 'Pan Pride': 'PANP', 'Pride Progress Spikie': 'PRGS',
  'Rainbow': 'RNBW', 'Rainbow Glow': 'RBGL', 'Trans Pride': 'TRNS',
  'Be My Valentine': 'BMVL', 'Black Heart': 'BKHT', 'Burnt By Love': 'BBLV',
  'Cherry Kiss': 'CHKS', 'Cotton Candy Kiss': 'CCKS', 'Crimson Curse': 'CRCS',
  'Ghost Glitter': 'GHGL', 'Ghoul Pop': 'GHPP', 'Midnight Kiss': 'MDKS',
  'Phantom Frost': 'PHFR', 'Pumpkin Stripes': 'PKST', 'Pure Love': 'PRLV',
  'ARACHNAE': 'ARCH', 'Army Brown': 'AMBR', 'Army Green': 'AMGR', 'Citrus Rave': 'CTRV',
  'Electric Lime': 'ELIM', 'Enchanted Mist': 'ENMS', 'Green Apple': 'GRAP',
  'Laser Lemon': 'LSLM', 'Midnight Crush': 'MDCR', 'Neon Berry': 'NNBR',
  'Phoenix Color Shift': 'PHCS', 'RGB Color Shift': 'RGBS',
};

interface OrderNode {
  id: string;
  name: string;
  createdAt: string;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  lineItems: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        variantTitle: string | null;
        sku: string | null;
        quantity: number;
        product: { id: string; title: string } | null;
      };
    }>;
  };
}

interface OrdersResponse {
  orders: {
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
    edges: Array<{ node: OrderNode }>;
  };
}

interface ProductTotal {
  sku: string;
  title: string;
  variant: string;
  family: string;
  color: string | null;
  qty: number;
}

interface ComponentTotal {
  sku: string;
  family: string;
  color: string | null;
  qty: number;
}

interface OrderDetail {
  name: string;
  date: string;
  status: string;
  items: Array<{
    title: string;
    variant: string;
    sku: string;
    qty: number;
  }>;
}

const UNFULFILLED_ORDERS_QUERY = `
  query GetUnfulfilledOrders($first: Int!, $after: String, $query: String!) {
    orders(first: $first, after: $after, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                variantTitle
                sku
                quantity
                product {
                  id
                  title
                }
              }
            }
          }
        }
      }
    }
  }
`;

function detectProductFamily(title: string): string {
  const titleLower = title.toLowerCase();

  if (titleLower.includes('mini grippie')) return 'GRP-MINI';
  if (titleLower.includes('grippie xl') || titleLower.includes('xl')) return 'GRP-XL';
  if (titleLower.includes('mini spikie')) return 'SPK-MINI';
  if (titleLower.includes('spin click') && titleLower.includes('spikie')) return 'SSC';
  if (titleLower.includes('spin click')) return 'SC';
  if (titleLower.includes('grippie spins') || titleLower.includes('spin')) return 'SPIN';
  if (titleLower.includes('click keychain')) return 'CLICK-KEY';
  if (titleLower.includes('click')) return 'CLICK';
  if (titleLower.includes('keytar')) return 'KEYTAR';
  if (titleLower.includes('roller')) return 'ROLLER';
  if (titleLower.includes('ergo')) return 'ERGO';
  if (titleLower.includes('ring')) return 'RING';
  if (titleLower.includes('squish')) return 'SQUISH';
  if (titleLower.includes('earring')) return 'EARRING';
  if (titleLower.includes('chapstick') || titleLower.includes('stick')) return 'GSTICK';
  if (titleLower.includes('bic')) return 'BIC';
  if (titleLower.includes('clipper')) return 'CLIP';
  if (titleLower.includes('coozie')) return 'CAN';
  if (titleLower.includes('pod')) return 'POD';
  if (titleLower.includes('journal')) return 'JOURNAL';
  if (titleLower.includes('spikie')) return 'SPK';
  if (titleLower.includes('grippie')) return 'GRP';
  if (titleLower.includes('gift card')) return 'GIFTCARD';
  if (titleLower.includes('keys only')) return 'KEYS';

  return 'OTHER';
}

function extractColor(variantTitle: string | null, productTitle: string): string | null {
  if (!variantTitle || variantTitle === 'Default Title') {
    for (const color of Object.keys(colorCodes)) {
      if (productTitle.toLowerCase().includes(color.toLowerCase())) {
        return color;
      }
    }
    return null;
  }

  for (const color of Object.keys(colorCodes)) {
    if (variantTitle.toLowerCase().includes(color.toLowerCase())) {
      return color;
    }
  }

  const cleanVariant = variantTitle.replace(/^(Ergo|Roller|Ring|Spin|Pod|Can Coozie|BIC Lighter|Clipper)\s+/i, '');

  for (const color of Object.keys(colorCodes)) {
    if (cleanVariant.toLowerCase().includes(color.toLowerCase())) {
      return color;
    }
  }

  return variantTitle;
}

function getComponentSku(family: string, color: string | null): string {
  const colorCode = color ? (colorCodes[color] || color.toUpperCase().substring(0, 4)) : 'UNKN';
  return `CMP-${family}-BODY-${colorCode}`;
}

async function fetchUnfulfilledOrders(): Promise<OrderNode[]> {
  const allOrders: OrderNode[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;
  const queryString = "(fulfillment_status:unfulfilled OR fulfillment_status:partial) AND financial_status:paid";

  while (hasNextPage) {
    const variables: { first: number; after: string | null; query: string } = {
      first: 50,
      after: cursor,
      query: queryString
    };

    const response = await shopifyGraphQL<OrdersResponse>(UNFULFILLED_ORDERS_QUERY, variables);

    const ordersData = response.orders;
    const orders = ordersData.edges.map(e => e.node);
    allOrders.push(...orders);

    hasNextPage = ordersData.pageInfo.hasNextPage;
    cursor = ordersData.pageInfo.endCursor;
  }

  return allOrders;
}

export async function GET() {
  try {
    const orders = await fetchUnfulfilledOrders();

    if (orders.length === 0) {
      return NextResponse.json({
        success: true,
        totalOrders: 0,
        pickList: [],
        components: [],
        orderDetails: []
      });
    }

    const productTotals: Record<string, ProductTotal> = {};
    const componentTotals: Record<string, ComponentTotal> = {};
    const orderDetails: OrderDetail[] = [];

    for (const order of orders) {
      const orderInfo: OrderDetail = {
        name: order.name,
        date: new Date(order.createdAt).toLocaleDateString(),
        status: order.displayFulfillmentStatus,
        items: []
      };

      for (const lineItemEdge of order.lineItems.edges) {
        const item = lineItemEdge.node;
        const productTitle = item.product?.title || item.title;
        const variantTitle = item.variantTitle || 'Default';
        const sku = item.sku || 'NO-SKU';
        const qty = item.quantity;

        // Skip gift cards
        if (productTitle.toLowerCase().includes('gift card')) continue;

        const family = detectProductFamily(productTitle);
        const color = extractColor(variantTitle, productTitle);

        // Full product key
        const productKey = `${sku}|${productTitle}|${variantTitle}`;
        if (!productTotals[productKey]) {
          productTotals[productKey] = {
            sku: sku,
            title: productTitle,
            variant: variantTitle,
            family: family,
            color: color,
            qty: 0
          };
        }
        productTotals[productKey].qty += qty;

        // Component mapping (body parts)
        if (family !== 'GIFTCARD' && family !== 'JOURNAL' && family !== 'KEYS' && family !== 'OTHER') {
          const componentSku = getComponentSku(family, color);
          if (!componentTotals[componentSku]) {
            componentTotals[componentSku] = {
              sku: componentSku,
              family: family,
              color: color,
              qty: 0
            };
          }
          componentTotals[componentSku].qty += qty;
        }

        orderInfo.items.push({
          title: productTitle,
          variant: variantTitle,
          sku: sku,
          qty: qty
        });
      }

      if (orderInfo.items.length > 0) {
        orderDetails.push(orderInfo);
      }
    }

    // Sort products by family then quantity
    const sortedProducts = Object.values(productTotals).sort((a, b) => {
      if (a.family !== b.family) return a.family.localeCompare(b.family);
      return b.qty - a.qty;
    });

    // Sort components by family then quantity
    const sortedComponents = Object.values(componentTotals).sort((a, b) => {
      if (a.family !== b.family) return a.family.localeCompare(b.family);
      return b.qty - a.qty;
    });

    const totalProducts = sortedProducts.reduce((sum, p) => sum + p.qty, 0);
    const totalComponents = sortedComponents.reduce((sum, c) => sum + c.qty, 0);

    return NextResponse.json({
      success: true,
      totalOrders: orders.length,
      totalProducts,
      totalComponents,
      pickList: sortedProducts,
      components: sortedComponents,
      orderDetails: orderDetails
    });
  } catch (error) {
    console.error('Error generating pick lists:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

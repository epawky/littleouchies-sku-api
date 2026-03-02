// Shopify GraphQL client for server-side use

interface ShopifyConfig {
  storeName: string;
  clientId: string;
  clientSecret: string;
  apiVersion: string;
}

export function getShopifyConfig(): ShopifyConfig {
  return {
    storeName: process.env.SHOPIFY_STORE_NAME || 'littleouchies',
    clientId: process.env.SHOPIFY_CLIENT_ID || '',
    clientSecret: process.env.SHOPIFY_CLIENT_SECRET || '',
    apiVersion: process.env.SHOPIFY_API_VERSION || '2024-01',
  };
}

export async function getAccessToken(config: ShopifyConfig): Promise<string> {
  const tokenEndpoint = `https://${config.storeName}.myshopify.com/admin/oauth/access_token`;

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'client_credentials',
    }),
  });

  const data = await response.json();
  return data.access_token;
}

export async function shopifyGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const config = getShopifyConfig();
  const accessToken = await getAccessToken(config);

  const endpoint = `https://${config.storeName}.myshopify.com/admin/api/${config.apiVersion}/graphql.json`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json();

  if (data.errors) {
    throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
  }

  return data.data as T;
}

// GraphQL Queries
export const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          description
          vendor
          productType
          handle
          status
          createdAt
          updatedAt
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                barcode
                price
                compareAtPrice
                inventoryQuantity
                inventoryItem {
                  id
                }
                selectedOptions {
                  name
                  value
                }
                createdAt
                updatedAt
              }
            }
          }
        }
      }
    }
  }
`;

export const ORDERS_QUERY = `
  query GetOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          email
          phone
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          subtotalPriceSet {
            shopMoney {
              amount
            }
          }
          totalTaxSet {
            shopMoney {
              amount
            }
          }
          totalDiscountsSet {
            shopMoney {
              amount
            }
          }
          displayFinancialStatus
          displayFulfillmentStatus
          customer {
            id
            firstName
            lastName
            email
            phone
          }
          shippingAddress {
            firstName
            lastName
            address1
            address2
            city
            province
            provinceCode
            zip
            country
            countryCodeV2
            phone
          }
          billingAddress {
            firstName
            lastName
            address1
            address2
            city
            province
            provinceCode
            zip
            country
            countryCodeV2
          }
          processedAt
          createdAt
          updatedAt
          lineItems(first: 100) {
            edges {
              node {
                id
                title
                variantTitle
                sku
                quantity
                originalUnitPriceSet {
                  shopMoney {
                    amount
                  }
                }
                product {
                  id
                }
                variant {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Helper to extract numeric ID from Shopify GID
export function extractGid(gid: string): string {
  const parts = gid.split('/');
  return parts[parts.length - 1];
}

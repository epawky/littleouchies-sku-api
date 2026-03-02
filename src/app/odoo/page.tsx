'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

type CsvType = 'attribute_values' | 'products' | 'product_attributes';

interface ColorInfo {
  name: string;
  code: string;
}

interface OrderSyncPreview {
  shopifyOrderName: string;
  customerName: string;
  email: string | null;
  totalPrice: string;
  financialStatus: string;
  fulfillmentStatus: string;
  lineItemCount: number;
  existsInOdoo: boolean;
  odooOrderName?: string;
}

interface OrderSyncDetail {
  shopifyOrderName: string;
  odooOrderId?: number;
  status: 'created' | 'skipped' | 'error';
  reason?: string;
}

interface OrderSyncResult {
  success: boolean;
  synced: number;
  skipped: number;
  errors: string[];
  details: OrderSyncDetail[];
}

interface ImageUploadResult {
  name: string;
  status: string;
  message: string;
}

interface ImageUploadResponse {
  success: boolean;
  dryRun: boolean;
  uploadType: string;
  summary: {
    total: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  results: ImageUploadResult[];
  errors: { file: string; error: string }[];
  error?: string;
}

interface FamilyInfo {
  code: string;
  name: string;
  skuPrefix: string;
  category: string;
  description: string;
}

interface ImportResult {
  type: string;
  status: 'created' | 'updated' | 'skipped' | 'error';
  name: string;
  message: string;
  id?: number;
}

interface UploadResponse {
  success: boolean;
  dryRun: boolean;
  csvType: string;
  summary: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  results: ImportResult[];
  errors: { row: number; error: string }[];
  error?: string;
  details?: string[];
  expectedColumns?: string[];
  receivedColumns?: string[];
}

interface OdooProduct {
  id: number;
  name: string;
  default_code: string;
  list_price: number;
  qty_available: number;
  categ_id: [number, string];
}

const CSV_CONFIGS: Record<CsvType, {
  title: string;
  description: string;
  requiredColumns: string[];
  optionalColumns: string[];
  example: string;
}> = {
  attribute_values: {
    title: '1. Attribute Values',
    description: 'Define product attributes (like Color, Size) and their possible values. 4-letter codes auto-generated for colors.',
    requiredColumns: ['attribute', 'value'],
    optionalColumns: ['sequence'],
    example: `attribute,value,sequence
Color,Black,1
Color,Red,2
Color,Mystic Purple,3
Size,Small,1
Size,Medium,2
Size,Large,3`,
  },
  products: {
    title: '2. Products',
    description: 'Define product templates with name, type, SKU, and pricing',
    requiredColumns: ['name', 'type'],
    optionalColumns: ['default_code', 'categ', 'sale_ok', 'purchase_ok', 'list_price', 'standard_price', 'description'],
    example: `name,type,default_code,categ,sale_ok,purchase_ok,list_price,standard_price
Grippie Template,product,GRP,Finished Products / Grippie,true,false,12.99,3.50
Spikie Template,product,SPK,Finished Products / Spikie,true,false,14.99,4.00
Spin Click Template,product,SC,Finished Products / Spin Click,true,false,19.99,6.00`,
  },
  product_attributes: {
    title: '3. Product Attributes',
    description: 'Link attributes to products to create variants (e.g., Grippie in Black, Red, Blue)',
    requiredColumns: ['product', 'attribute', 'values'],
    optionalColumns: [],
    example: `product,attribute,values
Grippie Template,Color,"Black,Red,Blue,Green,Purple,Teal"
Spikie Template,Color,"Black,White,Purple,Pink"
Spin Click Template,Color,"Black,Gray,White"
Spin Click Template,Click Type,"Clicky,Quiet"`,
  },
};

export default function OdooPage() {
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [products, setProducts] = useState<OdooProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedCsvType, setSelectedCsvType] = useState<CsvType>('attribute_values');
  const [dryRun, setDryRun] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [colors, setColors] = useState<ColorInfo[]>([]);
  const [families, setFamilies] = useState<FamilyInfo[]>([]);
  const [showColorRef, setShowColorRef] = useState(false);
  const [showFamilyRef, setShowFamilyRef] = useState(false);
  const [colorSearch, setColorSearch] = useState('');
  const [familySearch, setFamilySearch] = useState('');
  const [imageUploadResult, setImageUploadResult] = useState<ImageUploadResponse | null>(null);
  const [imageUploadDryRun, setImageUploadDryRun] = useState(true);
  const [orderSyncPreview, setOrderSyncPreview] = useState<OrderSyncPreview[]>([]);
  const [orderSyncResult, setOrderSyncResult] = useState<OrderSyncResult | null>(null);
  const [orderSyncLoading, setOrderSyncLoading] = useState(false);
  const [orderQuery, setOrderQuery] = useState('fulfillment_status:unfulfilled');
  const [autoConfirmOrders, setAutoConfirmOrders] = useState(true);

  useEffect(() => {
    // Fetch colors and families on mount
    Promise.all([
      fetch('/api/odoo?action=colors').then(r => r.json()),
      fetch('/api/odoo?action=families').then(r => r.json()),
    ]).then(([colorsData, familiesData]) => {
      if (colorsData.success) setColors(colorsData.colors);
      if (familiesData.success) setFamilies(familiesData.families);
    }).catch(console.error);
  }, []);

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/odoo?action=test');
      const data = await response.json();
      if (data.success) {
        setConnectionStatus('connected');
      } else {
        setConnectionStatus('error');
        setError(data.error);
      }
    } catch (err) {
      setConnectionStatus('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetch(`/api/odoo?action=products&limit=100${searchParam}`);
      const data = await response.json();
      if (data.success) {
        setProducts(data.products);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('csvType', selectedCsvType);
      formData.append('dryRun', String(dryRun));

      const response = await fetch('/api/odoo', {
        method: 'POST',
        body: formData,
      });

      const data: UploadResponse = await response.json();

      if (data.success) {
        setUploadResult(data);
      } else {
        setError(data.error || 'Upload failed');
        if (data.details) {
          setError(`${data.error}\n\n${data.details.join('\n')}\n\nExpected: ${data.expectedColumns?.join(', ')}\nReceived: ${data.receivedColumns?.join(', ')}`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    setError(null);
    setImageUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('uploadType', 'color_images');
      formData.append('dryRun', String(imageUploadDryRun));

      // Append all selected images
      for (let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
      }

      const response = await fetch('/api/odoo', {
        method: 'POST',
        body: formData,
      });

      const data: ImageUploadResponse = await response.json();

      if (data.success) {
        setImageUploadResult(data);
      } else {
        setError(data.error || 'Image upload failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setLoading(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  };

  const downloadTemplate = (csvType: CsvType) => {
    const config = CSV_CONFIGS[csvType];
    const blob = new Blob([config.example], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${csvType}_template.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const previewOrderSync = async () => {
    setOrderSyncLoading(true);
    setError(null);
    setOrderSyncPreview([]);
    try {
      const params = new URLSearchParams({ query: orderQuery, limit: '50' });
      const response = await fetch(`/api/sync/odoo-orders?${params}`);
      const data = await response.json();
      if (data.success) {
        setOrderSyncPreview(data.orders);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview orders');
    } finally {
      setOrderSyncLoading(false);
    }
  };

  const syncOrdersToOdoo = async () => {
    setOrderSyncLoading(true);
    setError(null);
    setOrderSyncResult(null);
    try {
      const params = new URLSearchParams({
        query: orderQuery,
        confirm: String(autoConfirmOrders),
        limit: '50',
      });
      const response = await fetch(`/api/sync/odoo-orders?${params}`, {
        method: 'POST',
      });
      const data = await response.json();
      setOrderSyncResult(data);
      if (!data.success) {
        setError(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync orders');
    } finally {
      setOrderSyncLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'updated': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
      case 'created': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'skipped': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
      case 'error': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      default: return 'text-zinc-600 bg-zinc-50';
    }
  };

  const config = CSV_CONFIGS[selectedCsvType];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <Link
              href="/"
              className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              Odoo Product Sync
            </h1>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400">
            Upload CSV files to create/update products in Odoo. Follow the required format for each CSV type.
          </p>
        </header>

        {/* Connection Test */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Connection Status</h2>
          <div className="flex items-center gap-4">
            <button
              onClick={testConnection}
              disabled={loading}
              className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Testing...' : 'Test Connection'}
            </button>
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-green-500'
                    : connectionStatus === 'error'
                    ? 'bg-red-500'
                    : 'bg-zinc-300'
                }`}
              />
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {connectionStatus === 'connected'
                  ? 'Connected to Odoo'
                  : connectionStatus === 'error'
                  ? 'Connection failed'
                  : 'Not tested'}
              </span>
            </div>
          </div>
        </div>

        {/* Order Sync to Odoo */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Sync Shopify Orders to Odoo</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Create Sales Orders in Odoo from Shopify orders. Orders are matched by SKU.
          </p>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Order Filter
                </label>
                <select
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
                >
                  <option value="fulfillment_status:unfulfilled">Unfulfilled Orders</option>
                  <option value="fulfillment_status:partial">Partially Fulfilled</option>
                  <option value="financial_status:paid">Paid Orders</option>
                  <option value="created_at:>2024-01-01">Orders Since 2024</option>
                  <option value="">All Orders</option>
                </select>
              </div>

              <label className="flex items-center gap-2 self-end pb-2">
                <input
                  type="checkbox"
                  checked={autoConfirmOrders}
                  onChange={(e) => setAutoConfirmOrders(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Auto-confirm orders
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={previewOrderSync}
                disabled={orderSyncLoading}
                className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 disabled:bg-zinc-400 text-white font-medium rounded-lg transition-colors"
              >
                {orderSyncLoading ? 'Loading...' : 'Preview Orders'}
              </button>
              <button
                onClick={syncOrdersToOdoo}
                disabled={orderSyncLoading || orderSyncPreview.length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
              >
                {orderSyncLoading ? 'Syncing...' : 'Sync to Odoo'}
              </button>
            </div>
          </div>

          {/* Order Preview */}
          {orderSyncPreview.length > 0 && !orderSyncResult && (
            <div className="mt-4">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Preview: {orderSyncPreview.length} orders found
              </h3>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-700">
                    <tr className="text-left text-zinc-600 dark:text-zinc-300">
                      <th className="px-3 py-2 font-medium">Order</th>
                      <th className="px-3 py-2 font-medium">Customer</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                      <th className="px-3 py-2 font-medium">Items</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderSyncPreview.map((order) => (
                      <tr key={order.shopifyOrderName} className="border-t border-zinc-200 dark:border-zinc-600">
                        <td className="px-3 py-2 font-mono text-xs">{order.shopifyOrderName}</td>
                        <td className="px-3 py-2">{order.customerName}</td>
                        <td className="px-3 py-2">${parseFloat(order.totalPrice).toFixed(2)}</td>
                        <td className="px-3 py-2">{order.lineItemCount}</td>
                        <td className="px-3 py-2">
                          {order.existsInOdoo ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                              In Odoo: {order.odooOrderName}
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              Ready to sync
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sync Results */}
          {orderSyncResult && (
            <div className="mt-4 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-700/50">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-3">
                Sync Results
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{orderSyncResult.synced}</div>
                  <div className="text-xs text-zinc-500">Synced</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600">{orderSyncResult.skipped}</div>
                  <div className="text-xs text-zinc-500">Skipped</div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{orderSyncResult.errors.length}</div>
                  <div className="text-xs text-zinc-500">Errors</div>
                </div>
              </div>

              {orderSyncResult.errors.length > 0 && (
                <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Errors:</div>
                  {orderSyncResult.errors.slice(0, 10).map((err, idx) => (
                    <div key={idx} className="text-xs text-red-600 dark:text-red-400">{err}</div>
                  ))}
                </div>
              )}

              <div className="max-h-48 overflow-y-auto">
                {orderSyncResult.details.map((detail, idx) => (
                  <div key={idx} className="text-xs py-1.5 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-600 last:border-0">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${
                      detail.status === 'created' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      detail.status === 'skipped' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {detail.status}
                    </span>
                    <span className="font-mono">{detail.shopifyOrderName}</span>
                    {detail.odooOrderId && (
                      <span className="text-zinc-500">→ Odoo #{detail.odooOrderId}</span>
                    )}
                    {detail.reason && (
                      <span className="text-zinc-500 ml-auto">{detail.reason}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CSV Type Selection */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Import Order</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Upload CSVs in this order: Attribute Values → Products → Product Attributes
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.keys(CSV_CONFIGS) as CsvType[]).map((type) => {
              const cfg = CSV_CONFIGS[type];
              const isSelected = selectedCsvType === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedCsvType(type)}
                  className={`p-4 rounded-lg border-2 text-left transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <div className={`font-semibold mb-1 ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-900 dark:text-white'}`}>
                    {cfg.title}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {cfg.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CSV Format Guide */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{config.title} - CSV Format</h2>
            <button
              onClick={() => downloadTemplate(selectedCsvType)}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Template
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Required Columns</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {config.requiredColumns.map((col) => (
                  <span key={col} className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-sm font-mono">
                    {col}
                  </span>
                ))}
              </div>

              {config.optionalColumns.length > 0 && (
                <>
                  <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Optional Columns</h3>
                  <div className="flex flex-wrap gap-2">
                    {config.optionalColumns.map((col) => (
                      <span key={col} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded text-sm font-mono">
                        {col}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div>
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Example</h3>
              <pre className="bg-zinc-900 dark:bg-black text-green-400 text-xs p-4 rounded-lg overflow-x-auto">
                {config.example}
              </pre>
            </div>
          </div>
        </div>

        {/* Color Reference */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 mb-6">
          <button
            onClick={() => setShowColorRef(!showColorRef)}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gradient-to-r from-red-500 via-purple-500 to-blue-500" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Standard Colors ({colors.length} colors)
              </h2>
            </div>
            <svg
              className={`w-5 h-5 text-zinc-500 transition-transform ${showColorRef ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showColorRef && (
            <div className="px-4 pb-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Use these exact color names in your CSV files. The 4-letter code is used for SKU generation.
              </p>

              <input
                type="text"
                value={colorSearch}
                onChange={(e) => setColorSearch(e.target.value)}
                placeholder="Search colors..."
                className="w-full px-3 py-2 mb-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-64 overflow-y-auto">
                {colors
                  .filter(c => c.name.toLowerCase().includes(colorSearch.toLowerCase()) || c.code.toLowerCase().includes(colorSearch.toLowerCase()))
                  .map((color) => (
                    <div
                      key={color.code}
                      className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-zinc-900 dark:text-white truncate">{color.name}</div>
                        <div className="text-xs text-zinc-500 font-mono">{color.code}</div>
                      </div>
                    </div>
                  ))}
              </div>

              {colors.length > 0 && (
                <p className="text-xs text-zinc-500 mt-2">
                  Tip: New colors will get auto-generated 4-letter codes. Existing colors will be skipped.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Product Family Reference */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 mb-6">
          <button
            onClick={() => setShowFamilyRef(!showFamilyRef)}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Product Families ({families.length} families)
              </h2>
            </div>
            <svg
              className={`w-5 h-5 text-zinc-500 transition-transform ${showFamilyRef ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showFamilyRef && (
            <div className="px-4 pb-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                Standard product families with their SKU prefixes and categories. Use the category path in products.csv.
              </p>

              <input
                type="text"
                value={familySearch}
                onChange={(e) => setFamilySearch(e.target.value)}
                placeholder="Search families..."
                className="w-full px-3 py-2 mb-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm"
              />

              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-700">
                    <tr className="text-left text-zinc-600 dark:text-zinc-300">
                      <th className="px-3 py-2 font-medium">Code</th>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">SKU Prefix</th>
                      <th className="px-3 py-2 font-medium">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {families
                      .filter(f =>
                        f.name.toLowerCase().includes(familySearch.toLowerCase()) ||
                        f.code.toLowerCase().includes(familySearch.toLowerCase()) ||
                        f.skuPrefix.toLowerCase().includes(familySearch.toLowerCase())
                      )
                      .map((family) => (
                        <tr key={family.code} className="border-t border-zinc-200 dark:border-zinc-600">
                          <td className="px-3 py-2 font-mono text-xs text-purple-600 dark:text-purple-400">{family.code}</td>
                          <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white">{family.name}</td>
                          <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">{family.skuPrefix}</td>
                          <td className="px-3 py-2 text-xs text-zinc-500">{family.category}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg">
                <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">SKU Format Example:</div>
                <code className="text-xs text-purple-600 dark:text-purple-400">
                  {families.length > 0 && colors.length > 0
                    ? `${families[0].skuPrefix}-${colors[0].code} → ${families[0].name} - ${colors[0].name}`
                    : 'SPIKIE-BLCK → Spikie - Black'}
                </code>
              </div>
            </div>
          )}
        </div>

        {/* Color Image Upload */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Upload Color Images</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Upload images for color swatches. Name each file with the exact color name (e.g., &quot;Mermaid.png&quot;, &quot;Galaxy Black.jpg&quot;).
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={imageUploadDryRun}
                  onChange={(e) => setImageUploadDryRun(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Dry Run (preview without uploading)
                </span>
              </label>
            </div>

            <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg p-8 text-center">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                id="imageUpload"
              />
              <label
                htmlFor="imageUpload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <svg className="w-12 h-12 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {loading ? 'Uploading...' : 'Click to select color images'}
                </span>
                <span className="text-xs text-zinc-500">
                  Select multiple images. Filename = color name.
                </span>
              </label>
            </div>
          </div>

          {/* Image Upload Results */}
          {imageUploadResult && (
            <div className="mt-4 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-700/50">
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
                Upload Results {imageUploadResult.dryRun && <span className="text-yellow-600">(Dry Run)</span>}
              </h3>
              <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                <div className="text-center p-2 bg-white dark:bg-zinc-800 rounded">
                  <div className="text-lg font-bold text-zinc-900 dark:text-white">{imageUploadResult.summary.total}</div>
                  <div className="text-xs text-zinc-500">Total</div>
                </div>
                <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                  <div className="text-lg font-bold text-green-600">{imageUploadResult.summary.updated}</div>
                  <div className="text-xs text-zinc-500">Uploaded</div>
                </div>
                <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  <div className="text-lg font-bold text-red-600">{imageUploadResult.summary.errors}</div>
                  <div className="text-xs text-zinc-500">Errors</div>
                </div>
              </div>

              {imageUploadResult.errors.length > 0 && (
                <div className="mb-3">
                  <div className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Errors:</div>
                  {imageUploadResult.errors.map((err, idx) => (
                    <div key={idx} className="text-xs text-red-600 dark:text-red-400">
                      {err.file}: {err.error}
                    </div>
                  ))}
                </div>
              )}

              {imageUploadResult.results.length > 0 && (
                <div className="max-h-32 overflow-y-auto">
                  {imageUploadResult.results.map((r, idx) => (
                    <div key={idx} className="text-xs py-1 flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded ${r.status === 'updated' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {r.status}
                      </span>
                      <span className="text-zinc-700 dark:text-zinc-300">{r.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CSV Upload */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Upload {config.title}</h2>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Dry Run (preview changes without saving)
                </span>
              </label>
            </div>

            <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csvUpload"
              />
              <label
                htmlFor="csvUpload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <svg className="w-12 h-12 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-zinc-600 dark:text-zinc-400">
                  {loading ? 'Processing...' : `Click to upload ${config.title.toLowerCase()} CSV`}
                </span>
                <span className="text-xs text-zinc-500">
                  Required columns: {config.requiredColumns.join(', ')}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <pre className="text-red-700 dark:text-red-400 whitespace-pre-wrap text-sm">{error}</pre>
          </div>
        )}

        {/* Upload Results */}
        {uploadResult && (
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              Upload Results - {uploadResult.csvType}
              {uploadResult.dryRun && <span className="text-yellow-600 ml-2">(Dry Run)</span>}
            </h2>

            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-zinc-50 dark:bg-zinc-700/50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">{uploadResult.summary.total}</div>
                <div className="text-sm text-zinc-500">Total Rows</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{uploadResult.summary.created}</div>
                <div className="text-sm text-zinc-500">Created</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{uploadResult.summary.updated}</div>
                <div className="text-sm text-zinc-500">Updated</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">{uploadResult.summary.skipped}</div>
                <div className="text-sm text-zinc-500">Skipped</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{uploadResult.summary.errors}</div>
                <div className="text-sm text-zinc-500">Errors</div>
              </div>
            </div>

            {/* Errors */}
            {uploadResult.errors.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium text-red-700 dark:text-red-400 mb-2">Errors (first 20)</h3>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 max-h-40 overflow-y-auto">
                  {uploadResult.errors.map((err, idx) => (
                    <div key={idx} className="text-sm text-red-700 dark:text-red-400">
                      Row {err.row}: {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results Details */}
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-zinc-800">
                  <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Message</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-900 dark:text-zinc-100">
                  {uploadResult.results.map((result, idx) => (
                    <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-700/50">
                      <td className="py-2 pr-4 font-mono text-xs">{result.name}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(result.status)}`}>
                          {result.status}
                        </span>
                      </td>
                      <td className="py-2 text-zinc-600 dark:text-zinc-400">{result.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Product Browser */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Browse Odoo Products</h2>

          <div className="flex gap-4 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by SKU or name..."
              className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
            />
            <button
              onClick={fetchProducts}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : 'Search'}
            </button>
          </div>

          {products.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
                    <th className="pb-2 pr-4 font-medium">SKU</th>
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Price</th>
                    <th className="pb-2 pr-4 font-medium">Qty</th>
                    <th className="pb-2 font-medium">Category</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-900 dark:text-zinc-100">
                  {products.map((product) => (
                    <tr key={product.id} className="border-b border-zinc-100 dark:border-zinc-700/50">
                      <td className="py-2 pr-4 font-mono text-xs">{product.default_code || '-'}</td>
                      <td className="py-2 pr-4">{product.name}</td>
                      <td className="py-2 pr-4">${product.list_price.toFixed(2)}</td>
                      <td className="py-2 pr-4">{product.qty_available}</td>
                      <td className="py-2 text-zinc-500">{product.categ_id?.[1] || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {products.length === 0 && !loading && (
            <p className="text-center text-zinc-500 py-8">
              Click &quot;Search&quot; to load products from Odoo
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

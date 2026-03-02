'use client';

import { useState } from 'react';
import Link from 'next/link';

interface LineItem {
  sku: string;
  title: string;
  variantTitle: string;
  quantity: number;
  imageUrl?: string;
}

interface Order {
  id: string;
  name: string;
  createdAt: string;
  customer: string;
  region: string;
  lineItems: LineItem[];
}

interface ComponentSummary {
  sku: string;
  title: string;
  totalQuantity: number;
  imageUrl?: string;
}

export default function QuickPickPage() {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [components, setComponents] = useState<ComponentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const generateQuickPick = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/pick-lists?region=ALL');
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      setOrders(data.orders || []);

      // Aggregate components
      const componentMap = new Map<string, ComponentSummary>();
      for (const order of (data.orders || [])) {
        for (const item of order.lineItems) {
          const key = item.sku || item.title;
          if (componentMap.has(key)) {
            componentMap.get(key)!.totalQuantity += item.quantity;
          } else {
            componentMap.set(key, {
              sku: item.sku || 'N/A',
              title: item.title,
              totalQuantity: item.quantity,
              imageUrl: item.imageUrl,
            });
          }
        }
      }

      // Sort by quantity descending
      const sortedComponents = Array.from(componentMap.values())
        .sort((a, b) => b.totalQuantity - a.totalQuantity);

      setComponents(sortedComponents);
      setGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    const headers = ['SKU', 'Product', 'Total Quantity'];
    const rows = components.map(c => [c.sku, c.title, c.totalQuantity.toString()]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quick-pick-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printPickList = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Quick Pick List - ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 10px; }
            .meta { text-align: center; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .checkbox { width: 30px; text-align: center; }
            .quantity { text-align: center; font-weight: bold; }
            .image { width: 60px; }
            .image img { width: 50px; height: 50px; object-fit: cover; }
            @media print {
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Quick Pick List</h1>
          <div class="meta">
            Generated: ${new Date().toLocaleString()}<br>
            Total Orders: ${orders.length} | Total Line Items: ${components.length}
          </div>

          <h2>Components Needed</h2>
          <table>
            <thead>
              <tr>
                <th class="checkbox">✓</th>
                <th class="image">Image</th>
                <th>SKU</th>
                <th>Product</th>
                <th class="quantity">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${components.map(c => `
                <tr>
                  <td class="checkbox">☐</td>
                  <td class="image">${c.imageUrl ? `<img src="${c.imageUrl}" alt="" />` : '-'}</td>
                  <td>${c.sku}</td>
                  <td>${c.title}</td>
                  <td class="quantity">${c.totalQuantity}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h2>Orders (${orders.length})</h2>
          <table>
            <thead>
              <tr>
                <th class="checkbox">✓</th>
                <th>Order</th>
                <th>Customer</th>
                <th>Region</th>
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              ${orders.map(o => `
                <tr>
                  <td class="checkbox">☐</td>
                  <td>${o.name}</td>
                  <td>${o.customer}</td>
                  <td>${o.region}</td>
                  <td>${o.lineItems.map(li => `${li.quantity}x ${li.sku || li.title}`).join(', ')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <button class="no-print" onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
            Print This Page
          </button>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-700 text-sm mb-2 inline-block"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              Quick Pick
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 mt-1">
              Generate a pick list for all unfulfilled orders instantly
            </p>
          </div>
        </div>

        {/* Main Action */}
        {!generated && (
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
              Ready to Generate
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">
              Click the button below to fetch all unfulfilled orders and generate a pick list
            </p>
            <button
              onClick={generateQuickPick}
              disabled={loading}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Fetching Orders...
                </span>
              ) : (
                'Generate Quick Pick List'
              )}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Results */}
        {generated && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
                <div className="text-3xl font-bold text-zinc-900 dark:text-white">{orders.length}</div>
                <div className="text-zinc-600 dark:text-zinc-400">Orders</div>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
                <div className="text-3xl font-bold text-zinc-900 dark:text-white">{components.length}</div>
                <div className="text-zinc-600 dark:text-zinc-400">Unique SKUs</div>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
                <div className="text-3xl font-bold text-zinc-900 dark:text-white">
                  {components.reduce((sum, c) => sum + c.totalQuantity, 0)}
                </div>
                <div className="text-zinc-600 dark:text-zinc-400">Total Units</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={printPickList}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Pick List
              </button>
              <button
                onClick={downloadCSV}
                className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download CSV
              </button>
              <button
                onClick={() => { setGenerated(false); setOrders([]); setComponents([]); }}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium rounded-lg transition-colors"
              >
                Reset
              </button>
            </div>

            {/* Components Table */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden mb-6">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Components Needed</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-50 dark:bg-zinc-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Product</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {components.slice(0, 50).map((component, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30">
                        <td className="px-4 py-3 text-sm font-mono text-zinc-900 dark:text-white">{component.sku}</td>
                        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{component.title}</td>
                        <td className="px-4 py-3 text-sm text-center font-bold text-zinc-900 dark:text-white">{component.totalQuantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {components.length > 50 && (
                  <div className="p-4 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                    Showing 50 of {components.length} components. Print or download CSV for full list.
                  </div>
                )}
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Orders ({orders.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-50 dark:bg-zinc-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Order</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Region</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Items</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                    {orders.slice(0, 25).map((order) => (
                      <tr key={order.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30">
                        <td className="px-4 py-3 text-sm font-medium text-zinc-900 dark:text-white">{order.name}</td>
                        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{order.customer}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            order.region === 'US'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                          }`}>
                            {order.region}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                          {order.lineItems.length} item(s)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {orders.length > 25 && (
                  <div className="p-4 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                    Showing 25 of {orders.length} orders. Print for full list.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

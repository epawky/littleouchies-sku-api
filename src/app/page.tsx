'use client';

import { useState } from 'react';
import Link from 'next/link';

interface PickListItem {
  sku: string;
  title: string;
  variant: string;
  family: string;
  color: string | null;
  qty: number;
}

interface ComponentItem {
  sku: string;
  family: string;
  color: string | null;
  qty: number;
}

interface OrderItem {
  title: string;
  variant: string;
  sku: string;
  qty: number;
}

interface OrderDetail {
  name: string;
  date: string;
  status: string;
  items: OrderItem[];
}

interface PickListData {
  success: boolean;
  totalOrders: number;
  totalProducts: number;
  totalComponents: number;
  pickList: PickListItem[];
  components: ComponentItem[];
  orderDetails: OrderDetail[];
  error?: string;
}

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function generatePickListCSV(data: PickListItem[]): string {
  const rows = ['SKU,Product,Variant,Family,Color,Quantity'];
  for (const item of data) {
    rows.push(`"${item.sku}","${item.title}","${item.variant}","${item.family}","${item.color || ''}",${item.qty}`);
  }
  return rows.join('\n');
}

function generateComponentsCSV(data: ComponentItem[]): string {
  const rows = ['Component SKU,Family,Color,Quantity'];
  for (const item of data) {
    rows.push(`"${item.sku}","${item.family}","${item.color || ''}",${item.qty}`);
  }
  return rows.join('\n');
}

function generateOrdersCSV(data: OrderDetail[]): string {
  const rows = ['Order,Date,Status,SKU,Product,Variant,Quantity'];
  for (const order of data) {
    for (const item of order.items) {
      rows.push(`"${order.name}","${order.date}","${order.status}","${item.sku}","${item.title}","${item.variant}",${item.qty}`);
    }
  }
  return rows.join('\n');
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PickListData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pick' | 'components' | 'orders'>('pick');

  const fetchPickLists = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/pick-lists');
      const result = await response.json();
      if (result.success) {
        setData(result);
      } else {
        setError(result.error || 'Failed to fetch pick lists');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pick lists');
    } finally {
      setLoading(false);
    }
  };

  const downloadAllReports = () => {
    if (!data) return;
    const date = new Date().toISOString().split('T')[0];
    downloadCSV(`pick-list-${date}.csv`, generatePickListCSV(data.pickList));
    downloadCSV(`components-needed-${date}.csv`, generateComponentsCSV(data.components));
    downloadCSV(`unfulfilled-orders-${date}.csv`, generateOrdersCSV(data.orderDetails));
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              Little Ouchies Pick List Generator
            </h1>
            <div className="flex gap-3">
              <Link
                href="/pick-lists"
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Pick Lists
              </Link>
              <Link
                href="/odoo"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Odoo Sync
              </Link>
            </div>
          </div>
          <p className="text-zinc-600 dark:text-zinc-400">
            Generate pick lists and component requirements from unfulfilled paid orders
          </p>
        </header>

        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <button
              onClick={fetchPickLists}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Fetching Orders...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Generate Pick Lists
                </>
              )}
            </button>

            {data && (
              <button
                onClick={downloadAllReports}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download All CSVs
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
        </div>

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
                <div className="text-3xl font-bold text-blue-600">{data.totalOrders}</div>
                <div className="text-zinc-600 dark:text-zinc-400">Unfulfilled Orders</div>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
                <div className="text-3xl font-bold text-green-600">{data.totalProducts}</div>
                <div className="text-zinc-600 dark:text-zinc-400">Total Items to Pick</div>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
                <div className="text-3xl font-bold text-purple-600">{data.totalComponents}</div>
                <div className="text-zinc-600 dark:text-zinc-400">Components Needed</div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700">
              <div className="border-b border-zinc-200 dark:border-zinc-700">
                <nav className="flex">
                  <button
                    onClick={() => setActiveTab('pick')}
                    className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                      activeTab === 'pick'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Pick List ({data.pickList.length} SKUs)
                  </button>
                  <button
                    onClick={() => setActiveTab('components')}
                    className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                      activeTab === 'components'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Components ({data.components.length} types)
                  </button>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                      activeTab === 'orders'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Order Details ({data.orderDetails.length} orders)
                  </button>
                </nav>
              </div>

              <div className="p-4 overflow-x-auto">
                {activeTab === 'pick' && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                        <th className="pb-3 pr-4 font-medium">QTY</th>
                        <th className="pb-3 pr-4 font-medium">SKU</th>
                        <th className="pb-3 pr-4 font-medium">Product</th>
                        <th className="pb-3 pr-4 font-medium">Variant</th>
                        <th className="pb-3 font-medium">Family</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-900 dark:text-zinc-100">
                      {data.pickList.map((item, idx) => (
                        <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-700/50">
                          <td className="py-2 pr-4 font-mono font-bold text-blue-600">{item.qty}</td>
                          <td className="py-2 pr-4 font-mono text-xs">{item.sku}</td>
                          <td className="py-2 pr-4 max-w-xs truncate">{item.title}</td>
                          <td className="py-2 pr-4">{item.variant}</td>
                          <td className="py-2">
                            <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-700 rounded text-xs font-medium">
                              {item.family}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'components' && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                        <th className="pb-3 pr-4 font-medium">QTY</th>
                        <th className="pb-3 pr-4 font-medium">Component SKU</th>
                        <th className="pb-3 pr-4 font-medium">Family</th>
                        <th className="pb-3 font-medium">Color</th>
                      </tr>
                    </thead>
                    <tbody className="text-zinc-900 dark:text-zinc-100">
                      {data.components.map((item, idx) => (
                        <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-700/50">
                          <td className="py-2 pr-4 font-mono font-bold text-purple-600">{item.qty}</td>
                          <td className="py-2 pr-4 font-mono text-xs">{item.sku}</td>
                          <td className="py-2 pr-4">
                            <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-700 rounded text-xs font-medium">
                              {item.family}
                            </span>
                          </td>
                          <td className="py-2">{item.color || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeTab === 'orders' && (
                  <div className="space-y-4">
                    {data.orderDetails.slice(0, 50).map((order, idx) => (
                      <div key={idx} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-zinc-900 dark:text-white">{order.name}</span>
                          <span className="text-sm text-zinc-500">{order.date}</span>
                        </div>
                        <div className="space-y-1">
                          {order.items.map((item, itemIdx) => (
                            <div key={itemIdx} className="text-sm flex gap-2">
                              <span className="font-mono text-blue-600 font-bold">{item.qty}x</span>
                              <span className="font-mono text-xs text-zinc-500">{item.sku}</span>
                              <span className="text-zinc-700 dark:text-zinc-300 truncate">{item.title}</span>
                              <span className="text-zinc-500">({item.variant})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {data.orderDetails.length > 50 && (
                      <p className="text-center text-zinc-500 py-4">
                        Showing first 50 orders. Download CSV for full list.
                      </p>
                    )}
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

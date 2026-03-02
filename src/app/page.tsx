'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

interface PickListItem {
  sku: string;
  title: string;
  variant: string;
  family: string;
  color: string | null;
  qty: number;
  imageUrl?: string;
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
  imageUrl?: string;
}

interface OrderDetail {
  shopifyId: string;
  name: string;
  date: string;
  status: string;
  region: string;
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

interface ExistingPickList {
  id: number;
  name: string;
  filterType: string;
  filterRegion: string | null;
  totalOrders: number;
  totalUnits: number;
  status: string;
  createdAt: string;
}

interface DuplicateWarning {
  duplicates: string[];
  existingPickLists: ExistingPickList[];
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
  const rows = ['Order,Date,Status,Region,SKU,Product,Variant,Quantity'];
  for (const order of data) {
    for (const item of order.items) {
      rows.push(`"${order.name}","${order.date}","${order.status}","${order.region}","${item.sku}","${item.title}","${item.variant}",${item.qty}`);
    }
  }
  return rows.join('\n');
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PickListData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pick' | 'components' | 'orders'>('pick');

  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'date' | 'date_range'>('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [region, setRegion] = useState<'ALL' | 'US' | 'INTL'>('ALL');

  // Modal state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [creatingPickList, setCreatingPickList] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const fetchPickLists = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterType === 'date' && dateStart) {
        params.set('dateStart', dateStart);
        params.set('dateEnd', dateStart);
      } else if (filterType === 'date_range') {
        if (dateStart) params.set('dateStart', dateStart);
        if (dateEnd) params.set('dateEnd', dateEnd);
      }
      params.set('region', region);

      const response = await fetch(`/api/pick-lists?${params.toString()}`);
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

  const handleCreatePickList = async (forceCreate = false) => {
    if (!data || data.orderDetails.length === 0) return;

    setCreatingPickList(true);
    try {
      const response = await fetch('/api/pick-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Pick List - ${new Date().toLocaleDateString()} - ${region}`,
          filterType,
          filterDateStart: dateStart || undefined,
          filterDateEnd: dateEnd || undefined,
          filterRegion: region,
          orderDetails: data.orderDetails,
          forceCreate
        })
      });

      const result = await response.json();

      if (result.success) {
        setShowDuplicateModal(false);
        setShowPrintModal(true);
      } else if (result.error === 'duplicate_orders') {
        setDuplicateWarning({
          duplicates: result.duplicates,
          existingPickLists: result.existingPickLists
        });
        setShowDuplicateModal(true);
      } else {
        setError(result.error || 'Failed to create pick list');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pick list');
    } finally {
      setCreatingPickList(false);
    }
  };

  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Pick List - ${new Date().toLocaleDateString()}</title>
            <style>
              body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
              h1 { font-size: 18px; margin-bottom: 10px; }
              .summary { margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background: #f0f0f0; font-weight: bold; }
              .qty { font-weight: bold; text-align: center; width: 50px; }
              .checkbox-cell { width: 80px; text-align: center; }
              .checkbox { width: 18px; height: 18px; border: 2px solid #333; display: inline-block; margin: 0 2px; }
              .image-cell { width: 60px; }
              .image-cell img { max-width: 50px; max-height: 50px; }
              .sku { font-family: monospace; font-size: 10px; }
              .location { width: 80px; }
              @media print {
                body { margin: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            ${printRef.current.innerHTML}
          </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const renderCheckboxes = (qty: number) => {
    const boxes = [];
    for (let i = 0; i < Math.min(qty, 10); i++) {
      boxes.push(<span key={i} className="checkbox"></span>);
    }
    if (qty > 10) {
      boxes.push(<span key="more" style={{ fontSize: '10px' }}>+{qty - 10}</span>);
    }
    return boxes;
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
          <p className="text-zinc-600 dark:text-zinc-400">
            Generate pick lists and component requirements from unfulfilled paid orders
          </p>
        </header>

        {/* Filter Controls */}
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Filter Orders</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Filter Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'date' | 'date_range')}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              >
                <option value="all">All Unfulfilled</option>
                <option value="date">Specific Date</option>
                <option value="date_range">Date Range</option>
              </select>
            </div>

            {(filterType === 'date' || filterType === 'date_range') && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {filterType === 'date' ? 'Date' : 'Start Date'}
                </label>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>
            )}

            {filterType === 'date_range' && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Region
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as 'ALL' | 'US' | 'INTL')}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              >
                <option value="ALL">All Regions</option>
                <option value="US">US Only</option>
                <option value="INTL">International Only</option>
              </select>
            </div>
          </div>

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
                  Fetch Orders
                </>
              )}
            </button>

            {data && data.orderDetails.length > 0 && (
              <>
                <button
                  onClick={() => handleCreatePickList(false)}
                  disabled={creatingPickList}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  {creatingPickList ? 'Creating...' : 'Create & Print Pick List'}
                </button>

                <button
                  onClick={downloadAllReports}
                  className="px-6 py-3 bg-zinc-600 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download CSVs
                </button>
              </>
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
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-zinc-900 dark:text-white">{order.name}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              order.region === 'US' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {order.region}
                            </span>
                          </div>
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

      {/* Duplicate Warning Modal */}
      {showDuplicateModal && duplicateWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Duplicate Orders Detected</h3>
            </div>

            <p className="text-zinc-600 dark:text-zinc-400 mb-4">
              <strong>{duplicateWarning.duplicates.length}</strong> orders are already included in existing pick lists:
            </p>

            <div className="bg-zinc-100 dark:bg-zinc-700 rounded-lg p-3 mb-4 max-h-40 overflow-y-auto">
              {duplicateWarning.existingPickLists.map((list) => (
                <div key={list.id} className="text-sm py-1">
                  <span className="font-medium">{list.name}</span>
                  <span className="text-zinc-500 ml-2">({list.totalOrders} orders)</span>
                </div>
              ))}
            </div>

            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Do you want to create a new pick list anyway? This may result in duplicate picking.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreatePickList(true)}
                disabled={creatingPickList}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium"
              >
                {creatingPickList ? 'Creating...' : 'Create Anyway'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Modal */}
      {showPrintModal && data && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">Pick List Ready to Print</h3>
              <div className="flex gap-3">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 border border-zinc-300 rounded-lg text-zinc-700 hover:bg-zinc-100"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-6 bg-white">
              <div ref={printRef}>
                <h1>Pick List - {new Date().toLocaleDateString()}</h1>
                <div className="summary">
                  <strong>Summary:</strong> {data.totalOrders} orders | {data.pickList.length} unique SKUs | {data.totalProducts} total units
                  {region !== 'ALL' && <span> | Region: {region}</span>}
                </div>

                <table>
                  <thead>
                    <tr>
                      <th className="image-cell">Image</th>
                      <th>SKU</th>
                      <th>Product</th>
                      <th>Variant</th>
                      <th className="location">Location</th>
                      <th className="qty">QTY</th>
                      <th className="checkbox-cell">Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pickList.map((item, idx) => (
                      <tr key={idx}>
                        <td className="image-cell">
                          {item.imageUrl && <img src={item.imageUrl} alt="" />}
                        </td>
                        <td className="sku">{item.sku}</td>
                        <td>{item.title}</td>
                        <td>{item.variant}</td>
                        <td className="location"></td>
                        <td className="qty">{item.qty}</td>
                        <td className="checkbox-cell">
                          {renderCheckboxes(item.qty)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

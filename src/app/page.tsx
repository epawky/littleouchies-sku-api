'use client';

import { useState, useEffect, useRef } from 'react';

// ============ TYPES ============
type TabId = 'dashboard' | 'pick-lists' | 'quick-pick' | 'odoo';

// Pick Lists Types
interface PickListItem {
  sku: string;
  title: string;
  variant: string;
  family: string;
  color: string | null;
  qty: number;
  imageUrl?: string;
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

// Quick Pick Types
interface QuickPickLineItem {
  sku: string;
  title: string;
  variantTitle: string;
  quantity: number;
  imageUrl?: string;
}

interface QuickPickOrder {
  id: string;
  name: string;
  createdAt: string;
  customer: string;
  region: string;
  lineItems: QuickPickLineItem[];
}

interface ComponentSummary {
  sku: string;
  title: string;
  totalQuantity: number;
  imageUrl?: string;
}

// Odoo Types
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
    description: 'Define product attributes (like Color, Size) and their possible values.',
    requiredColumns: ['attribute', 'value'],
    optionalColumns: ['sequence'],
    example: `attribute,value,sequence\nColor,Black,1\nColor,Red,2`,
  },
  products: {
    title: '2. Products',
    description: 'Define product templates with name, type, SKU, and pricing',
    requiredColumns: ['name', 'type'],
    optionalColumns: ['default_code', 'categ', 'sale_ok', 'purchase_ok', 'list_price', 'standard_price', 'description'],
    example: `name,type,default_code,categ,list_price\nGrippie Template,product,GRP,Finished Products / Grippie,12.99`,
  },
  product_attributes: {
    title: '3. Product Attributes',
    description: 'Link attributes to products to create variants',
    requiredColumns: ['product', 'attribute', 'values'],
    optionalColumns: [],
    example: `product,attribute,values\nGrippie Template,Color,"Black,Red,Blue"`,
  },
};

// ============ MAIN COMPONENT ============
export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Tab Navigation */}
      <nav className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            <TabButton
              active={activeTab === 'dashboard'}
              onClick={() => setActiveTab('dashboard')}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              }
            >
              Home
            </TabButton>
            <TabButton
              active={activeTab === 'pick-lists'}
              onClick={() => setActiveTab('pick-lists')}
              color="blue"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              }
            >
              Pick Lists
            </TabButton>
            <TabButton
              active={activeTab === 'quick-pick'}
              onClick={() => setActiveTab('quick-pick')}
              color="green"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
            >
              Quick Pick
            </TabButton>
            <TabButton
              active={activeTab === 'odoo'}
              onClick={() => setActiveTab('odoo')}
              color="purple"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            >
              Odoo Sync
            </TabButton>
          </div>
        </div>
      </nav>

      {/* Tab Content */}
      <div className="p-4 md:p-8">
        {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} />}
        {activeTab === 'pick-lists' && <PickListsView />}
        {activeTab === 'quick-pick' && <QuickPickView />}
        {activeTab === 'odoo' && <OdooView />}
      </div>
    </div>
  );
}

// ============ TAB BUTTON ============
function TabButton({
  children,
  active,
  onClick,
  icon,
  color = 'zinc'
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  color?: 'zinc' | 'blue' | 'green' | 'purple';
}) {
  const colorClasses = {
    zinc: active ? 'border-zinc-500 text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300',
    blue: active ? 'border-blue-500 text-blue-600' : 'border-transparent text-zinc-500 hover:text-blue-600',
    green: active ? 'border-green-500 text-green-600' : 'border-transparent text-zinc-500 hover:text-green-600',
    purple: active ? 'border-purple-500 text-purple-600' : 'border-transparent text-zinc-500 hover:text-purple-600',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${colorClasses[color]}`}
    >
      {icon}
      {children}
    </button>
  );
}

// ============ DASHBOARD VIEW ============
function DashboardView({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
          Little Ouchies SKU Manager
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Manage pick lists, sync with Odoo, and track inventory
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pick Lists Card */}
        <button
          onClick={() => onNavigate('pick-lists')}
          className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all group text-left"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-1">
                Pick Lists
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-3">
                Generate printable pick lists from unfulfilled orders with filters
              </p>
              <ul className="text-xs text-zinc-500 dark:text-zinc-500 space-y-1">
                <li>Filter by date, date range, or all orders</li>
                <li>Filter by US or International</li>
                <li>Duplicate detection & tracking</li>
              </ul>
            </div>
          </div>
        </button>

        {/* Odoo Sync Card */}
        <button
          onClick={() => onNavigate('odoo')}
          className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all group text-left"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-1">
                Odoo Sync
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-3">
                Sync products, orders, and images between Shopify and Odoo
              </p>
              <ul className="text-xs text-zinc-500 dark:text-zinc-500 space-y-1">
                <li>Export products & attributes</li>
                <li>Sync orders to Odoo</li>
                <li>Upload product images</li>
              </ul>
            </div>
          </div>
        </button>

        {/* Quick Pick Card */}
        <button
          onClick={() => onNavigate('quick-pick')}
          className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 hover:shadow-md hover:border-green-300 dark:hover:border-green-600 transition-all group text-left"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-1">
                Quick Pick
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-3">
                Generate a pick list for all unfulfilled orders instantly
              </p>
              <ul className="text-xs text-zinc-500 dark:text-zinc-500 space-y-1">
                <li>One-click generation</li>
                <li>Download CSV reports</li>
                <li>View components needed</li>
              </ul>
            </div>
          </div>
        </button>

        {/* Reports Card - Coming Soon */}
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 opacity-60">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-700 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
                Reports
              </h2>
              <p className="text-zinc-400 dark:text-zinc-500 text-sm mb-3">
                Analytics and inventory reports
              </p>
              <span className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-500 px-2 py-1 rounded">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onNavigate('pick-lists')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Create Pick List
          </button>
          <button
            onClick={() => onNavigate('odoo')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Sync to Odoo
          </button>
          <button
            onClick={() => onNavigate('quick-pick')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Quick Pick All
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ PICK LISTS VIEW ============
function PickListsView() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PickListData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingLists, setExistingLists] = useState<ExistingPickList[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'date' | 'date_range'>('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [region, setRegion] = useState<'ALL' | 'US' | 'INTL'>('ALL');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [creatingPickList, setCreatingPickList] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchExistingLists();
  }, []);

  const fetchExistingLists = async () => {
    try {
      const response = await fetch('/api/pick-lists?action=list');
      const result = await response.json();
      if (result.success) {
        setExistingLists(result.pickLists);
      }
    } catch (err) {
      console.error('Failed to fetch existing lists:', err);
    }
  };

  const fetchOrders = async () => {
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
        setError(result.error || 'Failed to fetch orders');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
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
        fetchExistingLists();
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
              .checkbox-cell { width: 60px; text-align: center; }
              .checkbox { width: 18px; height: 18px; border: 2px solid #333; display: inline-block; margin: 0 2px; }
              .image-cell { width: 60px; }
              .image-cell img { max-width: 50px; max-height: 50px; }
              .sku { font-family: monospace; font-size: 10px; }
              .location { width: 80px; }
              @media print { body { margin: 0; } .no-print { display: none; } }
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

  return (
    <div className="max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Pick List Generator</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Create printable pick lists with duplicate tracking</p>
      </header>

      {/* Filter Controls */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Filter Orders</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Filter Type</label>
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
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">End Date</label>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Region</label>
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

        <div className="flex gap-4">
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Fetching...
              </>
            ) : (
              'Fetch Orders'
            )}
          </button>

          {data && data.orderDetails.length > 0 && (
            <button
              onClick={() => handleCreatePickList(false)}
              disabled={creatingPickList}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
            >
              {creatingPickList ? 'Creating...' : 'Create & Print Pick List'}
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Results Summary */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="text-3xl font-bold text-blue-600">{data.totalOrders}</div>
            <div className="text-zinc-600 dark:text-zinc-400">Orders</div>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="text-3xl font-bold text-green-600">{data.pickList.length}</div>
            <div className="text-zinc-600 dark:text-zinc-400">Unique SKUs</div>
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="text-3xl font-bold text-purple-600">{data.totalProducts}</div>
            <div className="text-zinc-600 dark:text-zinc-400">Total Units</div>
          </div>
        </div>
      )}

      {/* Pick List Preview */}
      {data && data.pickList.length > 0 && (
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Pick List Preview</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                  <th className="pb-3 pr-4 font-medium">Image</th>
                  <th className="pb-3 pr-4 font-medium">SKU</th>
                  <th className="pb-3 pr-4 font-medium">Product</th>
                  <th className="pb-3 pr-4 font-medium">Variant</th>
                  <th className="pb-3 pr-4 font-medium">QTY</th>
                </tr>
              </thead>
              <tbody className="text-zinc-900 dark:text-zinc-100">
                {data.pickList.slice(0, 20).map((item, idx) => (
                  <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-700/50">
                    <td className="py-2 pr-4">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="w-12 h-12 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-12 bg-zinc-200 dark:bg-zinc-700 rounded flex items-center justify-center text-zinc-400">?</div>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{item.sku}</td>
                    <td className="py-2 pr-4 max-w-xs truncate">{item.title}</td>
                    <td className="py-2 pr-4">{item.variant}</td>
                    <td className="py-2 font-mono font-bold text-blue-600">{item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.pickList.length > 20 && (
              <p className="text-center text-zinc-500 py-4">Showing first 20 items. Full list will be shown in print view.</p>
            )}
          </div>
        </div>
      )}

      {/* Existing Pick Lists */}
      {existingLists.length > 0 && (
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Previous Pick Lists</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                  <th className="pb-3 pr-4 font-medium">Name</th>
                  <th className="pb-3 pr-4 font-medium">Type</th>
                  <th className="pb-3 pr-4 font-medium">Region</th>
                  <th className="pb-3 pr-4 font-medium">Orders</th>
                  <th className="pb-3 pr-4 font-medium">Units</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="text-zinc-900 dark:text-zinc-100">
                {existingLists.map((list) => (
                  <tr key={list.id} className="border-b border-zinc-100 dark:border-zinc-700/50">
                    <td className="py-2 pr-4 font-medium">{list.name}</td>
                    <td className="py-2 pr-4">{list.filterType}</td>
                    <td className="py-2 pr-4">{list.filterRegion || 'ALL'}</td>
                    <td className="py-2 pr-4">{list.totalOrders}</td>
                    <td className="py-2 pr-4">{list.totalUnits}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        list.status === 'active' ? 'bg-green-100 text-green-700' :
                        list.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                        'bg-zinc-100 text-zinc-700'
                      }`}>
                        {list.status}
                      </span>
                    </td>
                    <td className="py-2">{new Date(list.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              <strong>{duplicateWarning.duplicates.length}</strong> orders are already included in existing pick lists.
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
                <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print
                </button>
                <button onClick={() => setShowPrintModal(false)} className="px-4 py-2 border border-zinc-300 rounded-lg text-zinc-700 hover:bg-zinc-100">Close</button>
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
                        <td className="image-cell">{item.imageUrl && <img src={item.imageUrl} alt="" />}</td>
                        <td className="sku">{item.sku}</td>
                        <td>{item.title}</td>
                        <td>{item.variant}</td>
                        <td className="location"></td>
                        <td className="qty">{item.qty}</td>
                        <td className="checkbox-cell">{renderCheckboxes(item.qty)}</td>
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

// ============ QUICK PICK VIEW ============
function QuickPickView() {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<QuickPickOrder[]>([]);
  const [components, setComponents] = useState<ComponentSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);

  const generateQuickPick = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/pick-lists?region=ALL');
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      setOrders(data.orders || []);

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

      const sortedComponents = Array.from(componentMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
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
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <h1>Quick Pick List</h1>
          <div class="meta">Generated: ${new Date().toLocaleString()}<br>Total Orders: ${orders.length} | Total Line Items: ${components.length}</div>
          <h2>Components Needed</h2>
          <table>
            <thead><tr><th class="checkbox">Done</th><th>SKU</th><th>Product</th><th class="quantity">Qty</th></tr></thead>
            <tbody>${components.map(c => `<tr><td class="checkbox">[ ]</td><td>${c.sku}</td><td>${c.title}</td><td class="quantity">${c.totalQuantity}</td></tr>`).join('')}</tbody>
          </table>
          <button class="no-print" onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Print This Page</button>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Quick Pick</h1>
        <p className="text-zinc-600 dark:text-zinc-400 mt-1">Generate a pick list for all unfulfilled orders instantly</p>
      </header>

      {!generated && (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">Ready to Generate</h2>
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">Click the button below to fetch all unfulfilled orders</p>
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

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {generated && (
        <>
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
              <div className="text-3xl font-bold text-zinc-900 dark:text-white">{components.reduce((sum, c) => sum + c.totalQuantity, 0)}</div>
              <div className="text-zinc-600 dark:text-zinc-400">Total Units</div>
            </div>
          </div>

          <div className="flex gap-3 mb-6">
            <button onClick={printPickList} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Pick List
            </button>
            <button onClick={downloadCSV} className="px-4 py-2 bg-zinc-600 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download CSV
            </button>
            <button onClick={() => { setGenerated(false); setOrders([]); setComponents([]); }} className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300 font-medium rounded-lg transition-colors">
              Reset
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
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
                <div className="p-4 text-center text-zinc-500 dark:text-zinc-400 text-sm">Showing 50 of {components.length} components.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============ ODOO VIEW ============
function OdooView() {
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
    <div className="max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">Odoo Product Sync</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Upload CSV files to create/update products in Odoo</p>
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
            <span className={`w-3 h-3 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'error' ? 'bg-red-500' : 'bg-zinc-300'}`} />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {connectionStatus === 'connected' ? 'Connected to Odoo' : connectionStatus === 'error' ? 'Connection failed' : 'Not tested'}
            </span>
          </div>
        </div>
      </div>

      {/* Order Sync to Odoo */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Sync Shopify Orders to Odoo</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Create Sales Orders in Odoo from Shopify orders.</p>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Order Filter</label>
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
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Auto-confirm orders</span>
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

        {orderSyncPreview.length > 0 && !orderSyncResult && (
          <div className="mt-4">
            <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Preview: {orderSyncPreview.length} orders found</h3>
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
                          <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">In Odoo</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Ready</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {orderSyncResult && (
          <div className="mt-4 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-700/50">
            <h3 className="font-medium text-zinc-900 dark:text-white mb-3">Sync Results</h3>
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
          </div>
        )}
      </div>

      {/* CSV Type Selection */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Import Order</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(CSV_CONFIGS) as CsvType[]).map((type) => {
            const cfg = CSV_CONFIGS[type];
            const isSelected = selectedCsvType === type;
            return (
              <button
                key={type}
                onClick={() => setSelectedCsvType(type)}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'}`}
              >
                <div className={`font-semibold mb-1 ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-900 dark:text-white'}`}>{cfg.title}</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">{cfg.description}</div>
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
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Download Template
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Required Columns</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {config.requiredColumns.map((col) => (
                <span key={col} className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-sm font-mono">{col}</span>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-medium text-zinc-900 dark:text-white mb-2">Example</h3>
            <pre className="bg-zinc-900 dark:bg-black text-green-400 text-xs p-4 rounded-lg overflow-x-auto">{config.example}</pre>
          </div>
        </div>
      </div>

      {/* Color Reference */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 mb-6">
        <button onClick={() => setShowColorRef(!showColorRef)} className="w-full p-4 flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gradient-to-r from-red-500 via-purple-500 to-blue-500" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Standard Colors ({colors.length})</h2>
          </div>
          <svg className={`w-5 h-5 text-zinc-500 transition-transform ${showColorRef ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showColorRef && (
          <div className="px-4 pb-4">
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
                  <div key={color.code} className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-700/50 rounded-lg text-sm">
                    <div className="min-w-0">
                      <div className="font-medium text-zinc-900 dark:text-white truncate">{color.name}</div>
                      <div className="text-xs text-zinc-500 font-mono">{color.code}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Product Family Reference */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 mb-6">
        <button onClick={() => setShowFamilyRef(!showFamilyRef)} className="w-full p-4 flex items-center justify-between text-left">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Product Families ({families.length})</h2>
          </div>
          <svg className={`w-5 h-5 text-zinc-500 transition-transform ${showFamilyRef ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showFamilyRef && (
          <div className="px-4 pb-4">
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
                    .filter(f => f.name.toLowerCase().includes(familySearch.toLowerCase()) || f.code.toLowerCase().includes(familySearch.toLowerCase()))
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
          </div>
        )}
      </div>

      {/* Color Image Upload */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Upload Color Images</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Name each file with the exact color name (e.g., &quot;Mermaid.png&quot;).</p>

        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={imageUploadDryRun}
              onChange={(e) => setImageUploadDryRun(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">Dry Run (preview without uploading)</span>
          </label>

          <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg p-8 text-center">
            <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" id="imageUpload" />
            <label htmlFor="imageUpload" className="cursor-pointer flex flex-col items-center gap-2">
              <svg className="w-12 h-12 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-zinc-600 dark:text-zinc-400">{loading ? 'Uploading...' : 'Click to select color images'}</span>
            </label>
          </div>
        </div>

        {imageUploadResult && (
          <div className="mt-4 p-4 rounded-lg bg-zinc-50 dark:bg-zinc-700/50">
            <h3 className="font-medium text-zinc-900 dark:text-white mb-2">
              Upload Results {imageUploadResult.dryRun && <span className="text-yellow-600">(Dry Run)</span>}
            </h3>
            <div className="grid grid-cols-3 gap-2 text-sm">
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
          </div>
        )}
      </div>

      {/* CSV Upload */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Upload {config.title}</h2>

        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300">Dry Run (preview changes without saving)</span>
          </label>

          <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg p-8 text-center">
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="csvUpload" />
            <label htmlFor="csvUpload" className="cursor-pointer flex flex-col items-center gap-2">
              <svg className="w-12 h-12 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-zinc-600 dark:text-zinc-400">{loading ? 'Processing...' : `Click to upload ${config.title.toLowerCase()} CSV`}</span>
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <pre className="text-red-700 dark:text-red-400 whitespace-pre-wrap text-sm">{error}</pre>
        </div>
      )}

      {uploadResult && (
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
            Upload Results - {uploadResult.csvType}
            {uploadResult.dryRun && <span className="text-yellow-600 ml-2">(Dry Run)</span>}
          </h2>

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

          {uploadResult.results.length > 0 && (
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
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(result.status)}`}>{result.status}</span>
                      </td>
                      <td className="py-2 text-zinc-600 dark:text-zinc-400">{result.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
          <p className="text-center text-zinc-500 py-8">Click &quot;Search&quot; to load products from Odoo</p>
        )}
      </div>
    </div>
  );
}

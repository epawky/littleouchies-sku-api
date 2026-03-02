'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 p-8">
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
          <Link
            href="/pick-lists"
            className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all group"
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
                  Generate printable pick lists from unfulfilled orders with filters for date and region
                </p>
                <ul className="text-xs text-zinc-500 dark:text-zinc-500 space-y-1">
                  <li>Filter by date, date range, or all orders</li>
                  <li>Filter by US or International</li>
                  <li>Duplicate detection & tracking</li>
                  <li>Printable with photos & checkboxes</li>
                </ul>
              </div>
            </div>
          </Link>

          {/* Odoo Sync Card */}
          <Link
            href="/odoo"
            className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all group"
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
                  <li>Manage color mappings</li>
                </ul>
              </div>
            </div>
          </Link>

          {/* Quick Pick List Card */}
          <Link
            href="/quick-pick"
            className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 hover:shadow-md hover:border-green-300 dark:hover:border-green-600 transition-all group"
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
          </Link>

          {/* Reports Card */}
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

        {/* Quick Stats */}
        <div className="mt-8 bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/pick-lists"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Create Pick List
            </Link>
            <Link
              href="/odoo"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Sync to Odoo
            </Link>
            <Link
              href="/quick-pick"
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Quick Pick All
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

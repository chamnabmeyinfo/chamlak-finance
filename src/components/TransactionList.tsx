import React, { useState, useMemo, useRef } from 'react';
import { Transaction, TRANSACTION_STATUSES, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { motion, AnimatePresence } from 'motion/react';
import { CurrencyCode, formatAmount } from '../utils/currency';
import { TransactionCalendar } from './TransactionCalendar';
import { exportTransactionPDF } from '../utils/pdfExport';
import { parseWorksheetCSV } from '../utils/worksheetUtils';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (tx: Transaction) => void;
  onExport: () => void;
  onImportCSV?: (imported: Omit<Transaction, 'id'>[]) => void;
  currency: CurrencyCode;
  companyName?: string;
  tagline?: string;
}

export const TransactionList: React.FC<TransactionListProps> = React.memo(({
  transactions,
  onDelete,
  onEdit,
  onExport,
  onImportCSV,
  currency,
  companyName = 'CHAMLAK MEDIA',
  tagline = 'Finance Hub',
}) => {
  const [ledgerView, setLedgerView] = useState<'table' | 'list' | 'calendar'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewingAttachment, setViewingAttachment] = useState<{ url: string; title: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImageFile = (url: string, title?: string) => {
    if (url.startsWith('data:image/')) return true;
    if (title) {
      const ext = title.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext || '')) return true;
    }
    return false;
  };

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    transactions.forEach((tx) => cats.add(tx.category));
    return Array.from(cats);
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        const vendorText = tx.vendor || '';
        const payUnderText = tx.payUnder || '';
        const matchesSearch =
          tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tx.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vendorText.toLowerCase().includes(searchTerm.toLowerCase()) ||
          payUnderText.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (tx.tags && tx.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));
        
        const matchesType = typeFilter === 'all' || tx.type === typeFilter;
        const matchesCategory = categoryFilter === 'all' || tx.category === categoryFilter;
        const matchesStatus = statusFilter === 'all' || (tx.status || 'Paid') === statusFilter;

        return matchesSearch && matchesType && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        const timeB = new Date(b.date).getTime();
        const timeA = new Date(a.date).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
  }, [transactions, searchTerm, typeFilter, categoryFilter, statusFilter]);

  const getCategoryConfig = (tx: Transaction) => {
    if (tx.type === 'income') {
      return INCOME_CATEGORIES[tx.category] || { name: tx.category, color: 'bg-slate-50 text-slate-700', borderColor: 'border-slate-200', textColor: 'text-slate-700', icon: 'HelpCircle' };
    }
    return EXPENSE_CATEGORIES[tx.category] || { name: tx.category, color: 'bg-slate-50 text-slate-700', borderColor: 'border-slate-200', textColor: 'text-slate-700', icon: 'HelpCircle' };
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
      const parts = dateStr.split('-').map(Number);
      if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString(undefined, options);
        }
      }
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toLocaleDateString(undefined, options);
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const handleFileUploadCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text && onImportCSV) {
        try {
          const parsed = parseWorksheetCSV(text);
          if (parsed.length > 0) {
            onImportCSV(parsed);
          } else {
            alert('No valid worksheet records found in the uploaded file.');
          }
        } catch (err: any) {
          alert('Error parsing CSV file: ' + (err.message || 'Invalid format'));
        }
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col transition-colors duration-300" id="transaction-list-card">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <CategoryIcon name="Table" size={18} className="text-indigo-600 dark:text-indigo-400" />
            Expense Worksheet Ledger
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Adapted to your 16-column accounting worksheet structure
          </p>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* View Toggles */}
          <div className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-150 dark:border-slate-800">
            <button
              onClick={() => setLedgerView('table')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                ledgerView === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-3xs border border-slate-100 dark:border-slate-800'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <CategoryIcon name="Table" size={12} />
              Worksheet
            </button>
            <button
              onClick={() => setLedgerView('list')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                ledgerView === 'list'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-3xs border border-slate-100 dark:border-slate-800'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <CategoryIcon name="List" size={12} />
              Cards
            </button>
            <button
              onClick={() => setLedgerView('calendar')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                ledgerView === 'calendar'
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-3xs border border-slate-100 dark:border-slate-800'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <CategoryIcon name="Calendar" size={12} />
              Calendar
            </button>
          </div>

          {/* Import Worksheet Button */}
          {onImportCSV && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleFileUploadCSV}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition shadow-2xs"
                title="Upload old expense worksheet CSV file"
              >
                <CategoryIcon name="Upload" size={13} className="text-indigo-600" />
                Import Worksheet
              </button>
            </>
          )}

          {/* Export CSV Button */}
          {transactions.length > 0 && (
            <button
              onClick={onExport}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition shadow-2xs"
              title="Export all 16 worksheet columns as CSV"
            >
              <CategoryIcon name="Download" size={13} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {ledgerView !== 'calendar' && (
        <div className="space-y-4 mb-4">
          {/* Search Bar */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <CategoryIcon name="Search" className="text-slate-400 dark:text-slate-500" size={14} />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vendor, description, category, pay under, or tags..."
              className="block w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 pl-9 pr-3 text-xs font-semibold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:border-indigo-500 outline-none transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
              >
                <CategoryIcon name="X" size={14} />
              </button>
            )}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap justify-between gap-3 items-center">
            <div className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-150 dark:border-slate-800">
              {(['all', 'income', 'expense'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => {
                    setTypeFilter(filter);
                    setCategoryFilter('all');
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition capitalize cursor-pointer ${
                    typeFilter === filter
                      ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-3xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Category Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-bold">Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl px-2.5 py-1 focus:border-indigo-500 outline-none"
                >
                  <option value="all">All Categories</option>
                  {availableCategories.map((catKey) => (
                    <option key={catKey} value={catKey}>
                      {INCOME_CATEGORIES[catKey]?.name || EXPENSE_CATEGORIES[catKey]?.name || catKey}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400 font-bold">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl px-2.5 py-1 focus:border-indigo-500 outline-none"
                >
                  <option value="all">All Statuses</option>
                  {TRANSACTION_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: Table View (16 Worksheet Columns) */}
      {ledgerView === 'table' && (
        <div className="flex-1 overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl max-h-[460px] min-h-[220px]">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-sm font-bold">No worksheet records found</p>
              <p className="text-xs mt-1">Try adding a new transaction or importing your old CSV file.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">Date</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">Vendor</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">Category</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap min-w-[160px]">Description</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">Pay Method</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">Curr</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap text-right">Net</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap text-right">Tax / VAT</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap text-right">Total</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap text-right">Total (USD)</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap text-right">Total (KHR)</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">Status</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">Pay Under</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">Attachment</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">Week</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap text-right">Rate</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-200">
                {filteredTransactions.map((tx) => {
                  const catConfig = getCategoryConfig(tx);
                  const isExpense = tx.type === 'expense';
                  const txStatus = tx.status || 'Paid';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition">
                      {/* 1. Date */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 whitespace-nowrap font-mono font-bold">
                        {tx.date}
                      </td>
                      {/* 2. Vendor */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 font-semibold whitespace-nowrap">
                        {tx.vendor || '—'}
                      </td>
                      {/* 3. Category */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${catConfig.color}`}>
                          {catConfig.name}
                        </span>
                      </td>
                      {/* 4. Description */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 max-w-[200px] truncate" title={tx.description}>
                        {tx.description}
                      </td>
                      {/* 5. Payment Method */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 whitespace-nowrap font-mono text-[11px]">
                        {tx.paymentMethod}
                      </td>
                      {/* 6. Currency */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 whitespace-nowrap font-bold">
                        {tx.currency || 'USD'}
                      </td>
                      {/* 7. Amount (Net) */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 text-right font-mono">
                        {formatAmount(tx.netAmount ?? (tx.amount - (tx.taxAmount || 0)), tx.currency || 'USD')}
                      </td>
                      {/* 8. Tax / VAT */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 text-right font-mono text-slate-400">
                        {formatAmount(tx.taxAmount || 0, tx.currency || 'USD')}
                      </td>
                      {/* 9. Total */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 text-right font-mono font-bold">
                        <span className={isExpense ? 'text-slate-800 dark:text-slate-100' : 'text-emerald-600'}>
                          {formatAmount(tx.amount, tx.currency || 'USD')}
                        </span>
                      </td>
                      {/* 10. Total (USD) */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 text-right font-mono font-bold text-slate-700 dark:text-slate-200">
                        {formatAmount(tx.totalUSD ?? tx.amount, 'USD')}
                      </td>
                      {/* 11. Total (KHR) */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                        {formatAmount(tx.totalKHR ?? Math.round(tx.amount * (tx.exchangeRate || 4000)), 'KHR')}
                      </td>
                      {/* 12. Status */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] ${
                            txStatus === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : txStatus === 'Pending'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                              : txStatus === 'Cleared'
                              ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400'
                              : txStatus === 'Reimbursed'
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                          }`}
                        >
                          {txStatus}
                        </span>
                      </td>
                      {/* 13. Pay Under */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 whitespace-nowrap font-semibold">
                        {tx.payUnder || 'Company Account'}
                      </td>
                      {/* 14. Attachment */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                        {tx.imageAttachment ? (
                          <button
                            onClick={() =>
                              setViewingAttachment({
                                url: tx.imageAttachment!,
                                title: tx.imageAttachmentName || 'Receipt Attachment',
                              })
                            }
                            className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                          >
                            <CategoryIcon name="Paperclip" size={11} />
                            Proof
                          </button>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">None</span>
                        )}
                      </td>
                      {/* 15. Week of Month */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 whitespace-nowrap font-bold text-slate-500">
                        {tx.weekOfMonth || 'Week 1'}
                      </td>
                      {/* 16. Exchange Rate */}
                      <td className="py-2 px-3 border-r border-slate-100 dark:border-slate-800/60 text-right font-mono text-slate-400">
                        {tx.exchangeRate || 4000}
                      </td>
                      {/* Actions */}
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => exportTransactionPDF(tx, currency, companyName, tagline)}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                            title="PDF Report"
                          >
                            <CategoryIcon name="Download" size={13} />
                          </button>
                          <button
                            onClick={() => onEdit(tx)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                            title="Edit Record"
                          >
                            <CategoryIcon name="Edit2" size={13} />
                          </button>
                          <button
                            onClick={() => onDelete(tx.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Delete Record"
                          >
                            <CategoryIcon name="Trash2" size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* VIEW: Cards View */}
      {ledgerView === 'list' && (
        <div className="flex-1 overflow-y-auto max-h-[420px] min-h-[200px] pr-1 space-y-2.5">
          {filteredTransactions.map((tx) => {
            const catConfig = getCategoryConfig(tx);
            const isExpense = tx.type === 'expense';

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-slate-200 transition"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${catConfig.color}`}>
                    <CategoryIcon name={catConfig.icon} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {tx.description}
                      </span>
                      {tx.vendor && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-1.5 py-0.2 rounded">
                          {tx.vendor}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>{formatDate(tx.date)}</span>
                      <span>•</span>
                      <span>{tx.payUnder || 'Company Account'}</span>
                      <span>•</span>
                      <span>{tx.paymentMethod}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={`text-sm font-bold font-mono ${isExpense ? 'text-slate-800 dark:text-slate-100' : 'text-emerald-600'}`}>
                      {isExpense ? '-' : '+'}{formatAmount(tx.amount, tx.currency || 'USD')}
                    </span>
                    {tx.currency !== 'KHR' && (
                      <span className="block text-[9px] text-slate-400 font-mono">
                        {formatAmount(tx.totalKHR ?? Math.round(tx.amount * (tx.exchangeRate || 4000)), 'KHR')}
                      </span>
                    )}
                    {tx.currency !== 'USD' && (
                      <span className="block text-[9px] text-slate-400 font-mono">
                        {formatAmount(tx.totalUSD ?? (tx.amount / (tx.exchangeRate || 4000)), 'USD')}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-1">
                    <button onClick={() => onEdit(tx)} className="p-1 text-slate-400 hover:text-slate-700">
                      <CategoryIcon name="Edit2" size={13} />
                    </button>
                    <button onClick={() => onDelete(tx.id)} className="p-1 text-slate-400 hover:text-rose-600">
                      <CategoryIcon name="Trash2" size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW: Calendar View */}
      {ledgerView === 'calendar' && (
        <TransactionCalendar
          transactions={transactions}
          currency={currency}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {/* Footer Counter */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between text-[11px] text-slate-400 font-bold">
        <span>Showing {filteredTransactions.length} of {transactions.length} total worksheet records</span>
      </div>

      {/* Attachment Modal */}
      {viewingAttachment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-4 space-y-4 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{viewingAttachment.title}</span>
              <button onClick={() => setViewingAttachment(null)} className="text-slate-400 hover:text-slate-600">
                <CategoryIcon name="X" size={16} />
              </button>
            </div>
            <div className="flex justify-center bg-slate-100 dark:bg-slate-950 p-4 rounded-xl">
              {isImageFile(viewingAttachment.url, viewingAttachment.title) ? (
                <img src={viewingAttachment.url} alt="Attachment" className="max-h-[60vh] object-contain rounded-lg" />
              ) : (
                <div className="text-center space-y-2">
                  <CategoryIcon name="FileText" size={32} className="mx-auto text-indigo-600" />
                  <a href={viewingAttachment.url} download className="text-xs font-bold text-indigo-600 underline">
                    Download File
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
TransactionList.displayName = 'TransactionList';

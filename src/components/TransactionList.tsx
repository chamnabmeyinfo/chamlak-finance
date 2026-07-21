import React, { useState, useMemo } from 'react';
import { Transaction, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../types';
import { CategoryIcon } from './CategoryIcon';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (tx: Transaction) => void;
  onExport: () => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onDelete,
  onEdit,
  onExport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Gather unique categories available in the current transaction list
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    transactions.forEach((tx) => cats.add(tx.category));
    return Array.from(cats);
  }, [transactions]);

  // Filter and search computation
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        const matchesSearch =
          tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tx.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || tx.type === typeFilter;
        const matchesCategory = categoryFilter === 'all' || tx.category === categoryFilter;

        return matchesSearch && matchesType && matchesCategory;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort newest first
  }, [transactions, searchTerm, typeFilter, categoryFilter]);

  // Helper to retrieve category visual config
  const getCategoryConfig = (tx: Transaction) => {
    if (tx.type === 'income') {
      return INCOME_CATEGORIES[tx.category] || { name: tx.category, color: 'bg-slate-50 text-slate-700', borderColor: 'border-slate-200', textColor: 'text-slate-700', icon: 'HelpCircle' };
    }
    return EXPENSE_CATEGORIES[tx.category] || { name: tx.category, color: 'bg-slate-50 text-slate-700', borderColor: 'border-slate-200', textColor: 'text-slate-700', icon: 'HelpCircle' };
  };

  const formatDate = (dateStr: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
      // Standard local date rendering without UTC timezone shifting issues
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString(undefined, options);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col" id="transaction-list-card">
      {/* List Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 tracking-tight">Ledger & History</h2>
          <p className="text-xs text-slate-400">Manage and explore your recorded logs</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {transactions.length > 0 && (
            <button
              onClick={onExport}
              className="flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold cursor-pointer transition w-full sm:w-auto"
              title="Export ledger as CSV file"
              id="btn-export-csv"
            >
              <CategoryIcon name="Download" size={13} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar layout */}
      <div className="space-y-4 mb-4">
        {/* Search */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <CategoryIcon name="Search" className="text-slate-400" size={14} />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search transactions by description or tags..."
            className="block w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs placeholder:text-slate-400 focus:border-indigo-400 outline-none transition"
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

        {/* Toggles & Category Filter Dropdown */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 items-stretch sm:items-center">
          {/* Segmented Filter */}
          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 self-start">
            {(['all', 'income', 'expense'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setTypeFilter(filter);
                  setCategoryFilter('all'); // Reset category when switching type to avoid empty combinations
                }}
                className={`px-3.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all capitalize ${
                  typeFilter === filter
                    ? 'bg-white text-slate-800 shadow-3xs border border-slate-100'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5 self-stretch sm:self-auto">
            <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white border border-slate-200 text-xs text-slate-600 rounded-xl px-2.5 py-1.5 focus:border-indigo-400 outline-none transition w-full sm:w-auto"
            >
              <option value="all">All Categories</option>
              {availableCategories.map((catKey) => {
                // Find label
                const label = INCOME_CATEGORIES[catKey]?.name || EXPENSE_CATEGORIES[catKey]?.name || catKey;
                return (
                  <option key={catKey} value={catKey}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Ledger Table / List */}
      <div className="flex-1 overflow-y-auto max-h-[380px] min-h-[180px] pr-1 scrollbar-thin">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center justify-center text-slate-300">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-3 border border-slate-100">
              <CategoryIcon name="Filter" size={18} />
            </div>
            <p className="text-sm font-medium">No records found</p>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Try adjusting your search keywords, active filters, or record your first transaction.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredTransactions.map((tx) => {
              const catConfig = getCategoryConfig(tx);
              const isExpense = tx.type === 'expense';

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3.5 bg-white border border-slate-100 rounded-xl hover:border-slate-200 hover:shadow-3xs transition-all duration-200 group"
                >
                  {/* Left Side: Category Icon and Description */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${catConfig.color}`}>
                      <CategoryIcon name={catConfig.icon} size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5 min-w-0">
                        <span className="text-sm font-semibold text-slate-700 truncate flex-1">
                          {tx.description}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold border shrink-0 ${catConfig.color} ${catConfig.borderColor}`}>
                          {catConfig.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 text-[10px] text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <CategoryIcon name="Calendar" size={10} />
                          {formatDate(tx.date)}
                        </span>
                        <span>•</span>
                        <span className="bg-slate-50 border border-slate-100 text-slate-500 px-1.5 py-0.2 rounded-sm text-[9px] font-mono">
                          {tx.paymentMethod}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Amount and Quick Actions */}
                  <div className="flex items-center gap-4 ml-3">
                    <div className="text-right">
                      <span className={`text-sm font-bold font-mono ${isExpense ? 'text-slate-600' : 'text-emerald-600'}`}>
                        {isExpense ? '-' : '+'}${tx.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    {/* Action hover-popover buttons */}
                    <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={() => onEdit(tx)}
                        className="w-7 h-7 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition cursor-pointer"
                        title="Edit log entry"
                        id={`btn-edit-${tx.id}`}
                      >
                        <CategoryIcon name="Edit2" size={12} />
                      </button>
                      <button
                        onClick={() => onDelete(tx.id)}
                        className="w-7 h-7 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100 text-slate-400 hover:text-red-600 flex items-center justify-center transition cursor-pointer"
                        title="Delete log entry"
                        id={`btn-delete-${tx.id}`}
                      >
                        <CategoryIcon name="Trash2" size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats Counter Footer */}
      <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-[11px] text-slate-400 font-medium">
        <span>Showing {filteredTransactions.length} of {transactions.length} transactions</span>
        {searchTerm || typeFilter !== 'all' || categoryFilter !== 'all' ? (
          <button
            onClick={() => {
              setSearchTerm('');
              setTypeFilter('all');
              setCategoryFilter('all');
            }}
            className="text-indigo-500 hover:text-indigo-600 font-semibold cursor-pointer"
          >
            Clear filters
          </button>
        ) : null}
      </div>
    </div>
  );
};

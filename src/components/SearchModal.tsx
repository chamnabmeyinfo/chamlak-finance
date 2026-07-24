import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Transaction } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { CurrencyCode, formatAmount } from '../utils/currency';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  currency: CurrencyCode;
  onSelectPage: (tabId: string) => void;
  onSelectTransaction: (tx: Transaction) => void;
}

interface SearchItem {
  type: 'nav' | 'tx';
  id: string;
  label: string;
  subtitle: string;
  icon: string;
  badge?: string;
  amount?: number;
  isExpense?: boolean;
  tx?: Transaction;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  transactions,
  currency,
  onSelectPage,
  onSelectTransaction,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      // Short delay to ensure transition completes and DOM is ready
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Define static navigation pages
  const navItems = useMemo<SearchItem[]>(() => [
    { type: 'nav', id: 'dashboard', label: 'Dashboard Overview', subtitle: 'View income vs expenses, insights, and dynamic charts', icon: 'LayoutDashboard', badge: 'Page' },
    { type: 'nav', id: 'record', label: 'Add Record / AI Receipt Scanner', subtitle: 'Log transactions manually or scan receipt attachments with AI', icon: 'PlusCircle', badge: 'Page' },
    { type: 'nav', id: 'ledger', label: 'Ledger History', icon: 'History', subtitle: 'Browse all recorded items, apply advanced filters, and export PDF/CSV', badge: 'Page' },
    { type: 'nav', id: 'budgets', label: 'Budgets Planner', icon: 'PiggyBank', subtitle: 'Set and monitor category limits to stay on budget', badge: 'Page' },
    { type: 'nav', id: 'settings', label: 'System Settings', icon: 'Settings', subtitle: 'Configure currency, profile info, and manage local database', badge: 'Page' },
  ], []);

  // Compute filtered items
  const filteredItems = useMemo<SearchItem[]>(() => {
    const cleanQuery = query.toLowerCase().trim();

    // 1. Match pages
    const matchedNavs = navItems.filter((item) =>
      item.label.toLowerCase().includes(cleanQuery) ||
      item.subtitle.toLowerCase().includes(cleanQuery)
    );

    // 2. Match transactions
    const matchedTxs: SearchItem[] = transactions
      .filter((tx) =>
        tx.description.toLowerCase().includes(cleanQuery) ||
        tx.category.toLowerCase().includes(cleanQuery) ||
        (tx.paymentMethod && tx.paymentMethod.toLowerCase().includes(cleanQuery)) ||
        tx.amount.toString().includes(cleanQuery) ||
        tx.date.includes(cleanQuery)
      )
      .map((tx) => ({
        type: 'tx',
        id: tx.id,
        label: tx.description,
        subtitle: `${tx.category} • ${tx.date} • via ${tx.paymentMethod || 'Cash'}`,
        icon: tx.type === 'income' ? 'ArrowUpRight' : 'ArrowDownRight',
        amount: tx.amount,
        isExpense: tx.type === 'expense',
        tx,
      }));

    if (cleanQuery === '') {
      // Default state: Show pages and first 5 recent transactions
      const recentTxs = matchedTxs.slice(0, 5);
      return [...matchedNavs, ...recentTxs];
    }

    return [...matchedNavs, ...matchedTxs];
  }, [query, transactions, navItems]);

  // Reset activeIndex when results list length changes
  useEffect(() => {
    setActiveIndex(0);
  }, [filteredItems.length]);

  // Handle keyboard events inside the modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems.length > 0 && filteredItems[activeIndex]) {
          handleItemSelection(filteredItems[activeIndex]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, activeIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (!listContainerRef.current) return;
    const activeEl = listContainerRef.current.querySelector('[data-active="true"]');
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleItemSelection = (item: SearchItem) => {
    if (item.type === 'nav') {
      onSelectPage(item.id);
    } else if (item.type === 'tx' && item.tx) {
      onSelectTransaction(item.tx);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
      id="search-command-palette-backdrop"
    >
      <div 
        className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden max-h-[480px] animate-slide-down"
        onClick={(e) => e.stopPropagation()}
        id="search-command-palette-card"
      >
        {/* Search Input block */}
        <div className="flex items-center gap-3 px-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 shrink-0">
          <CategoryIcon name="Search" size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-none text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden py-4 text-xs font-semibold"
            placeholder="Search pages or find transactions by name, category, amount..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg shrink-0 cursor-pointer"
            >
              <CategoryIcon name="X" size={14} />
            </button>
          )}
          <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg select-none shrink-0 border border-slate-200/20">
            ESC
          </span>
        </div>

        {/* Results list area */}
        <div 
          ref={listContainerRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 select-none"
          id="search-results-list"
        >
          {filteredItems.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <CategoryIcon name="SearchCode" size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold">No results match "{query}"</p>
              <p className="text-[11px] text-slate-400 mt-1">Try another search keyword</p>
            </div>
          ) : (
            <>
              {/* Categorize results visually */}
              {filteredItems.map((item, index) => {
                const isSelected = index === activeIndex;
                const isPage = item.type === 'nav';

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    data-active={isSelected}
                    onClick={() => handleItemSelection(item)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/70 border-indigo-100/50 dark:bg-indigo-950/20 dark:border-indigo-900/30'
                        : 'bg-white dark:bg-slate-900 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:border-indigo-900 dark:text-indigo-400'
                          : isPage
                          ? 'bg-slate-50 border-slate-100 text-slate-400 dark:bg-slate-800/40 dark:border-slate-800'
                          : item.isExpense
                          ? 'bg-rose-50 border-rose-100 text-rose-500 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400'
                          : 'bg-emerald-50 border-emerald-100 text-emerald-500 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400'
                      }`}>
                        <CategoryIcon name={item.icon} size={15} />
                      </div>
                      <div className="min-w-0">
                        <span className={`text-xs font-bold block truncate ${
                          isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          {item.label}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 block truncate font-medium">
                          {item.subtitle}
                        </span>
                      </div>
                    </div>

                    {/* Meta info badge or Transaction amount */}
                    <div className="shrink-0 text-right pl-2 font-mono">
                      {isPage ? (
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                          isSelected
                            ? 'bg-indigo-50/80 border-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-400'
                            : 'bg-slate-100/60 dark:bg-slate-800/60 border-slate-200/20 text-slate-400 dark:text-slate-500'
                        }`}>
                          Jump To
                        </span>
                      ) : (
                        <span className={`text-xs font-extrabold ${
                          item.isExpense ? 'text-slate-700 dark:text-slate-300' : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {item.isExpense ? '-' : '+'}{formatAmount(item.amount || 0, currency)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-550 shrink-0 font-medium">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200/20 font-bold">↑↓</span> Move
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200/20 font-bold">↵</span> Select
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200/20 font-bold">ESC</span> Close
            </span>
          </div>
          <div>
            <span>Matching: {filteredItems.length} items</span>
          </div>
        </div>
      </div>
    </div>
  );
};

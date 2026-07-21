import React, { useState, useMemo } from 'react';
import { Transaction, Budget, EXPENSE_CATEGORIES } from '../types';
import { CategoryIcon } from './CategoryIcon';

interface BudgetOverviewProps {
  transactions: Transaction[];
  budgets: Budget[];
  onUpdateBudget: (category: string, limit: number) => void;
}

export const BudgetOverview: React.FC<BudgetOverviewProps> = ({
  transactions,
  budgets,
  onUpdateBudget,
}) => {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newLimit, setNewLimit] = useState<string>('');

  // Calculate spent amounts for each expense category
  const categorySpending = useMemo(() => {
    const spending: Record<string, number> = {};
    
    // Default 0 for each budgeted category
    budgets.forEach((b) => {
      spending[b.category] = 0;
    });

    // Sum transactions for the current month/year
    const currentYearMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"

    transactions.forEach((tx) => {
      if (tx.type === 'expense' && tx.date.startsWith(currentYearMonth)) {
        spending[tx.category] = (spending[tx.category] || 0) + tx.amount;
      }
    });

    return spending;
  }, [transactions, budgets]);

  const handleEdit = (category: string, currentLimit: number) => {
    setEditingCategory(category);
    setNewLimit(currentLimit.toString());
  };

  const handleSave = (category: string) => {
    const limitNum = parseFloat(newLimit);
    if (!isNaN(limitNum) && limitNum >= 0) {
      onUpdateBudget(category, limitNum);
    }
    setEditingCategory(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col" id="budget-overview-card">
      <div className="mb-5 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 tracking-tight">Category Budgets</h2>
          <p className="text-xs text-slate-400">Monthly allowances vs current spending</p>
        </div>
        <span className="text-[10px] bg-slate-50 border border-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-lg">
          {new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' })}
        </span>
      </div>

      <div className="space-y-4 flex-1">
        {budgets.map((b) => {
          const config = EXPENSE_CATEGORIES[b.category] || { name: b.category, color: 'bg-slate-50 text-slate-700', icon: 'HelpCircle' };
          const spent = categorySpending[b.category] || 0;
          const percentage = b.limit > 0 ? (spent / b.limit) * 100 : 0;
          const isOverBudget = spent > b.limit;
          const isEditing = editingCategory === b.category;

          return (
            <div key={b.category} className="space-y-1.5 p-2 rounded-xl hover:bg-slate-50 transition duration-150">
              {/* Category Name & Action */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${config.color}`}>
                    <CategoryIcon name={config.icon} size={13} />
                  </div>
                  <span className="font-semibold text-slate-700">{config.name}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-mono text-[10px]">$</span>
                      <input
                        type="number"
                        value={newLimit}
                        onChange={(e) => setNewLimit(e.target.value)}
                        className="w-16 border border-slate-300 rounded px-1 py-0.5 text-[11px] font-semibold font-mono text-slate-800 focus:outline-none"
                        min="0"
                        step="10"
                        required
                        autoFocus
                      />
                      <button
                        onClick={() => handleSave(b.category)}
                        className="text-emerald-600 hover:text-emerald-700 font-bold px-1"
                        title="Save Limit"
                      >
                        ✓
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-slate-500 font-medium">
                        <span className="font-bold text-slate-700 font-mono">${spent.toFixed(0)}</span>
                        <span className="mx-1 text-slate-300">/</span>
                        <span className="font-semibold text-slate-400 font-mono">${b.limit.toFixed(0)}</span>
                      </span>
                      <button
                        onClick={() => handleEdit(b.category, b.limit)}
                        className="text-slate-400 hover:text-indigo-600 p-0.5 transition"
                        title="Adjust Budget Target"
                        id={`btn-edit-budget-${b.category}`}
                      >
                        <CategoryIcon name="Edit2" size={10} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Progress Bar visual indicator */}
              <div className="relative">
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOverBudget
                        ? 'bg-rose-500'
                        : percentage > 85
                        ? 'bg-amber-400'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
                {percentage > 100 && (
                  <span className="absolute right-0 -top-4 text-[9px] font-bold text-rose-500 animate-pulse bg-rose-50 px-1 rounded border border-rose-100">
                    Over Budget!
                  </span>
                )}
              </div>

              {/* Detail indicator under progress bar */}
              <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                <span>{percentage.toFixed(0)}% Utilized</span>
                <span>
                  {isOverBudget
                    ? `+$${(spent - b.limit).toFixed(0)} Exceeded`
                    : `$${(b.limit - spent).toFixed(0)} Remaining`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Transaction, Budget, EXPENSE_CATEGORIES } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { CurrencyCode, getCurrencySymbol, formatAmountNoCents } from '../utils/currency';

interface BudgetOverviewProps {
  transactions: Transaction[];
  budgets: Budget[];
  onUpdateBudget: (category: string, limit: number) => void;
  currency: CurrencyCode;
  triggerToast: (msg: string) => void;
}

export const BudgetOverview: React.FC<BudgetOverviewProps> = ({
  transactions,
  budgets,
  onUpdateBudget,
  currency,
  triggerToast,
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

  // Projection calculations
  const { currentDay, totalDays, overallProjected, totalBudgetLimit, isOverallExceeded } = useMemo(() => {
    const today = new Date();
    const currentDayVal = Math.max(1, today.getDate());
    const totalDaysVal = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    let limitSum = 0;
    let spentSum = 0;
    
    budgets.forEach((b) => {
      limitSum += b.limit;
      spentSum += categorySpending[b.category] || 0;
    });
    
    const projectedSum = spentSum * (totalDaysVal / currentDayVal);
    
    return {
      currentDay: currentDayVal,
      totalDays: totalDaysVal,
      overallProjected: projectedSum,
      totalBudgetLimit: limitSum,
      isOverallExceeded: projectedSum > limitSum && limitSum > 0,
    };
  }, [budgets, categorySpending]);

  // Real-time alert trigger
  const alertedRef = useRef<Record<string, { reached80: boolean; reached100: boolean }>>({});

  useEffect(() => {
    budgets.forEach((b) => {
      const spent = categorySpending[b.category] || 0;
      if (b.limit <= 0) return;
      
      const percentage = (spent / b.limit) * 100;
      const reached80 = percentage >= 80;
      const reached100 = percentage >= 100;
      
      if (!alertedRef.current[b.category]) {
        alertedRef.current[b.category] = { reached80: false, reached100: false };
      }
      
      const current = alertedRef.current[b.category];
      const categoryName = EXPENSE_CATEGORIES[b.category]?.name || b.category;
      
      if (reached100 && !current.reached100) {
        current.reached100 = true;
        current.reached80 = true; // Implied
        triggerToast(`⚠️ Budget Alert: You have hit 100% of your budget for ${categoryName}!`);
      } else if (reached80 && !reached100 && !current.reached80) {
        current.reached80 = true;
        triggerToast(`⚠️ Budget Warning: You have utilized 80% of your budget for ${categoryName}.`);
      } else if (!reached80) {
        // Reset if we go below 80%
        current.reached80 = false;
        current.reached100 = false;
      } else if (reached80 && !reached100 && current.reached100) {
        // Reset 100% alert but keep 80% if it dropped back
        current.reached100 = false;
      }
    });
  }, [categorySpending, budgets, triggerToast]);

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
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col transition-colors duration-300" id="budget-overview-card">
      <div className="mb-5 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 tracking-tight">Category Budgets</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">Monthly allowances vs current spending</p>
        </div>
        <span className="text-[10px] bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold px-2 py-0.5 rounded-lg">
          {new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' })}
        </span>
      </div>

      {/* High-level Projected Spending Indicator */}
      {totalBudgetLimit > 0 && (
        <div className={`mb-6 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition duration-200 ${
          isOverallExceeded 
            ? 'bg-rose-50/50 dark:bg-rose-950/25 border-rose-100 dark:border-rose-900/40 text-rose-850 dark:text-rose-300' 
            : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-850 dark:text-emerald-400'
        }`}>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-wider">
              <CategoryIcon name={isOverallExceeded ? "AlertTriangle" : "CheckCircle2"} size={13} className={isOverallExceeded ? "text-rose-500" : "text-emerald-500"} />
              <span>Projected Spending Indicator</span>
            </div>
            <p className="text-xs opacity-90 leading-normal font-medium">
              Based on the first <span className="font-bold">{currentDay}</span> of <span className="font-bold">{totalDays}</span> days this month, you are paced to spend about <span className="font-bold font-mono">{formatAmountNoCents(overallProjected, currency)}</span>.
            </p>
            <p className="text-[11px] opacity-80">
              {isOverallExceeded 
                ? `⚠️ Pacing exceeds your total budget of ${formatAmountNoCents(totalBudgetLimit, currency)} by ${formatAmountNoCents(overallProjected - totalBudgetLimit, currency)}.`
                : `✅ Pacing is well within your total monthly budget of ${formatAmountNoCents(totalBudgetLimit, currency)}.`}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-start sm:items-end font-mono">
            <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest leading-none mb-1">Projected Total</span>
            <span className={`text-lg font-black leading-none ${isOverallExceeded ? 'text-rose-600 dark:text-rose-450' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {formatAmountNoCents(overallProjected, currency)}
            </span>
            <span className="text-[9px] opacity-75 font-semibold mt-1">
              ({((overallProjected / totalBudgetLimit) * 100).toFixed(0)}% of limit)
            </span>
          </div>
        </div>
      )}

      <div className="space-y-4 flex-1">
        {budgets.map((b) => {
          const config = EXPENSE_CATEGORIES[b.category] || { name: b.category, color: 'bg-slate-50 text-slate-700', icon: 'HelpCircle' };
          const spent = categorySpending[b.category] || 0;
          const percentage = b.limit > 0 ? (spent / b.limit) * 100 : 0;
          const isOverBudget = spent > b.limit;
          const isEditing = editingCategory === b.category;

          return (
            <div key={b.category} className="space-y-1.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-950/40 transition duration-150">
              {/* Category Name & Action */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${config.color}`}>
                    <CategoryIcon name={config.icon} size={13} />
                  </div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{config.name}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-mono text-[10px]">{getCurrencySymbol(currency)}</span>
                      <input
                        type="number"
                        value={newLimit}
                        onChange={(e) => setNewLimit(e.target.value)}
                        className="w-16 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded px-1 py-0.5 text-[11px] font-semibold font-mono text-slate-800 dark:text-slate-100 focus:outline-none"
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
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">{formatAmountNoCents(spent, currency)}</span>
                        <span className="mx-1 text-slate-300 dark:text-slate-600">/</span>
                        <span className="font-semibold text-slate-400 dark:text-slate-500 font-mono">{formatAmountNoCents(b.limit, currency)}</span>
                      </span>
                      <button
                        onClick={() => handleEdit(b.category, b.limit)}
                        className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-0.5 transition"
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
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
                  <span className="absolute right-0 -top-4 text-[9px] font-bold text-rose-500 animate-pulse bg-rose-50 dark:bg-rose-950 px-1 rounded border border-rose-100 dark:border-rose-900">
                    Over Budget!
                  </span>
                )}
              </div>

              {/* Detail indicator under progress bar */}
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                <span>{percentage.toFixed(0)}% Utilized</span>
                <span>
                  {isOverBudget
                    ? `+${formatAmountNoCents(spent - b.limit, currency)} Exceeded`
                    : `${formatAmountNoCents(b.limit - spent, currency)} Remaining`}
                </span>
              </div>

              {/* Per-category month-end pacing projection */}
              {b.limit > 0 && spent > 0 && (
                <div className="flex items-center justify-between text-[10px] pt-1.5 mt-1 border-t border-dashed border-slate-100 dark:border-slate-800/80">
                  <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <CategoryIcon name="TrendingUp" size={10} className="text-slate-400" />
                    Month-end projection:
                  </span>
                  <span className={`font-mono font-bold ${spent * (totalDays / currentDay) > b.limit ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-650 dark:text-emerald-400'}`}>
                    {formatAmountNoCents(spent * (totalDays / currentDay), currency)}
                    <span className="text-[9px] font-semibold font-sans ml-1">
                      ({spent * (totalDays / currentDay) > b.limit ? 'Over limit' : 'Safe pacing'})
                    </span>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

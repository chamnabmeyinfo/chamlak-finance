import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { CurrencyCode, formatAmount } from '../utils/currency';

interface MonthlyFinancialReportProps {
  transactions: Transaction[];
  currency: CurrencyCode;
}

export const MonthlyFinancialReport: React.FC<MonthlyFinancialReportProps> = React.memo(({ transactions, currency }) => {
  // Get current real-world date to default to July 2026 as per our session context
  const today = new Date();
  const defaultYear = 2026;
  const defaultMonth = 6; // July is index 6 (0-indexed)

  // Extract all unique months/years from transactions
  const availableMonths = useMemo(() => {
    const monthsMap = new Map<string, { year: number; month: number; label: string }>();

    // Always ensure the current calendar month/year (July 2026) is included
    const currentKey = `${defaultYear}-${String(defaultMonth + 1).padStart(2, '0')}`;
    const currentLabel = new Date(defaultYear, defaultMonth).toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
    monthsMap.set(currentKey, { year: defaultYear, month: defaultMonth, label: currentLabel });

    // Extract months from transactions
    transactions.forEach((tx) => {
      if (!tx.date) return;
      const parts = tx.date.split('-');
      if (parts.length >= 2) {
        const yr = parseInt(parts[0], 10);
        const mo = parseInt(parts[1], 10) - 1; // Convert to 0-indexed month
        if (isNaN(yr) || isNaN(mo) || mo < 0 || mo > 11) return;

        const dateObj = new Date(yr, mo, 1);
        if (isNaN(dateObj.getTime())) return;

        const key = `${yr}-${String(mo + 1).padStart(2, '0')}`;
        const label = dateObj.toLocaleString('default', {
          month: 'long',
          year: 'numeric',
        });
        monthsMap.set(key, { year: yr, month: mo, label });
      }
    });

    // Sort by chronological order (newest first)
    return Array.from(monthsMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, value]) => ({ key, ...value }));
  }, [transactions]);

  // Set default selected month to July 2026
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    const julyKey = `${defaultYear}-${String(defaultMonth + 1).padStart(2, '0')}`;
    return availableMonths.some((m) => m.key === julyKey) ? julyKey : availableMonths[0]?.key || julyKey;
  });

  // Extract selected month info
  const selectedMonthInfo = useMemo(() => {
    return availableMonths.find((m) => m.key === selectedMonthKey) || {
      year: defaultYear,
      month: defaultMonth,
      label: 'July 2026',
    };
  }, [availableMonths, selectedMonthKey]);

  // Compute metrics for the selected month
  const reportMetrics = useMemo(() => {
    const { year, month } = selectedMonthInfo;
    let income = 0;
    let expenses = 0;
    const categoryTotals: { [cat: string]: number } = {};

    transactions.forEach((tx) => {
      if (!tx.date) return;
      const parts = tx.date.split('-');
      if (parts.length >= 2) {
        const txYear = parseInt(parts[0], 10);
        const txMonth = parseInt(parts[1], 10) - 1;

        if (txYear === year && txMonth === month) {
          let val = tx.amount;
          if (currency === 'USD') {
            val = tx.totalUSD ?? (tx.currency === 'KHR' ? tx.amount / (tx.exchangeRate || 4000) : tx.amount);
          } else if (currency === 'KHR') {
            val = tx.totalKHR ?? (tx.currency === 'USD' ? tx.amount * (tx.exchangeRate || 4000) : tx.amount);
          }

          if (tx.type === 'income') {
            income += val;
          } else {
            expenses += val;
            categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + val;
          }
        }
      }
    });

    const netSavings = income - expenses;
    const savingsRate = income > 0 ? (netSavings / income) * 100 : 0;
    const spentPercentage = income > 0 ? (expenses / income) * 100 : expenses > 0 ? 100 : 0;

    const sortedCategories = Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      income,
      expenses,
      netSavings,
      savingsRate,
      spentPercentage,
      sortedCategories,
    };
  }, [transactions, selectedMonthInfo]);

  // Category Configuration Mapping for elegant styling
  const getCategoryConfig = (category: string) => {
    const lower = category.toLowerCase();
    if (lower.includes('food') || lower.includes('dine')) {
      return { icon: 'Utensils', color: 'bg-amber-50 text-amber-600 border-amber-100' };
    }
    if (lower.includes('housing') || lower.includes('rent')) {
      return { icon: 'Home', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' };
    }
    if (lower.includes('transport') || lower.includes('car') || lower.includes('gas')) {
      return { icon: 'Car', color: 'bg-blue-50 text-blue-600 border-blue-100' };
    }
    if (lower.includes('utility') || lower.includes('bill') || lower.includes('power')) {
      return { icon: 'Zap', color: 'bg-purple-50 text-purple-600 border-purple-100' };
    }
    if (lower.includes('shop') || lower.includes('buy') || lower.includes('cloth')) {
      return { icon: 'ShoppingBag', color: 'bg-pink-50 text-pink-600 border-pink-100' };
    }
    if (lower.includes('health') || lower.includes('med')) {
      return { icon: 'Activity', color: 'bg-rose-50 text-rose-600 border-rose-100' };
    }
    if (lower.includes('fun') || lower.includes('play') || lower.includes('entertain') || lower.includes('movie')) {
      return { icon: 'Film', color: 'bg-sky-50 text-sky-600 border-sky-100' };
    }
    if (lower.includes('salary') || lower.includes('paycheck')) {
      return { icon: 'Briefcase', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    }
    return { icon: 'DollarSign', color: 'bg-slate-50 text-slate-600 border-slate-100' };
  };

  // Generate automated smart analysis insight
  const insightText = useMemo(() => {
    const { income, expenses, netSavings, savingsRate, sortedCategories } = reportMetrics;

    if (income === 0 && expenses === 0) {
      return "No transaction records found for this month yet. Use the Record Tab to input your income or snap a picture of your receipts!";
    }

    const topExpense = sortedCategories[0];
    const topExpenseStr = topExpense
      ? `Your largest expenditure is in **${topExpense.category}** (${formatAmount(topExpense.amount, currency)}).`
      : "";

    if (netSavings < 0) {
      return `⚠️ **Deficit Warning**: You have spent **${formatAmount(Math.abs(netSavings), currency)}** more than you earned this month. ${topExpenseStr} We suggest reviewing your budget limits in the Budgets Tab to curb non-essential expenses.`;
    }

    if (savingsRate >= 30) {
      return `🎉 **Spectacular Savings!**: You saved **${savingsRate.toFixed(1)}%** of your total monthly income. ${topExpenseStr} Your balance grew by **${formatAmount(netSavings, currency)}**—this is a solid cushion to allocate towards investments or high-yield savings goals!`;
    }

    if (savingsRate > 0) {
      return `👍 **Healthy Balance**: You successfully retained a **${savingsRate.toFixed(1)}%** savings rate (${formatAmount(netSavings, currency)} surplus). ${topExpenseStr} Maintain this budget control to build consistent wealth.`;
    }

    return `📊 **Balanced Budget**: Income exactly matches outflow this month. Consider checking your monthly utility bills and retail shopping lists to carve out a savings cushion next month.`;
  }, [reportMetrics]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs p-6 space-y-6 transition-colors duration-300" id="monthly-financial-report">
      {/* Component Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <CategoryIcon name="Calendar" className="text-indigo-600 dark:text-indigo-400" size={16} />
            Monthly Financial Report
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Summarized monthly diagnostics and budget ratios</p>
        </div>

        {/* Dropdown Month Selector */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Statement:</span>
          <select
            value={selectedMonthKey}
            onChange={(e) => setSelectedMonthKey(e.target.value)}
            className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition cursor-pointer"
          >
            {availableMonths.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Stats Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Month Income */}
        <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 transition duration-200 hover:shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/40 shrink-0 flex items-center justify-center">
            <CategoryIcon name="ArrowUpRight" size={18} />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Monthly Income</span>
            <span className="block text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono leading-tight mt-0.5">
              +{formatAmount(reportMetrics.income, currency)}
            </span>
          </div>
        </div>

        {/* Total Month Expense */}
        <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 transition duration-200 hover:shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-100/50 dark:border-rose-900/40 shrink-0 flex items-center justify-center">
            <CategoryIcon name="ArrowDownRight" size={18} />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Monthly Expense</span>
            <span className="block text-lg font-bold text-slate-700 dark:text-slate-300 font-mono leading-tight mt-0.5">
              -{formatAmount(reportMetrics.expenses, currency)}
            </span>
          </div>
        </div>

        {/* Net Savings */}
        <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3.5 transition duration-200 hover:shadow-2xs">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
            reportMetrics.netSavings >= 0 
              ? 'bg-indigo-50 text-indigo-600 border-indigo-100/50 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/40' 
              : 'bg-amber-50 text-amber-600 border-amber-100/50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40'
          }`}>
            <CategoryIcon name={reportMetrics.netSavings >= 0 ? 'Wallet' : 'AlertCircle'} size={18} />
          </div>
          <div className="min-w-0">
            <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Net Savings</span>
            <span className={`block text-lg font-bold font-mono leading-tight mt-0.5 ${
              reportMetrics.netSavings >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500 dark:text-rose-400'
            }`}>
              {formatAmount(reportMetrics.netSavings, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Progress Ratio of Income Spent */}
      {reportMetrics.income > 0 && (
        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <CategoryIcon name="PieChart" size={12} className="text-indigo-500 dark:text-indigo-400" />
              Budget Absorption Ratio
            </span>
            <span>
              {reportMetrics.spentPercentage.toFixed(1)}% of Income Spent
            </span>
          </div>
          {/* Custom progress bar */}
          <div className="w-full bg-slate-200/70 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden flex">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                reportMetrics.spentPercentage > 100
                  ? 'bg-gradient-to-r from-rose-500 to-red-600'
                  : reportMetrics.spentPercentage > 80
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                  : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-teal-400'
              }`}
              style={{ width: `${Math.min(reportMetrics.spentPercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-slate-500 font-medium">
            <span>0% (Empty Outflow)</span>
            <span>80% (Warning Threshold)</span>
            <span>100% (Income Limit)</span>
          </div>
        </div>
      )}

      {/* Health diagnostics statement block */}
      <div className={`p-4 rounded-2xl border flex gap-3 text-xs leading-relaxed ${
        reportMetrics.income === 0 && reportMetrics.expenses === 0
          ? 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-150 dark:border-slate-800'
          : reportMetrics.netSavings >= 0
          ? 'bg-indigo-50/40 dark:bg-indigo-950/20 text-slate-700 dark:text-slate-300 border-indigo-100/60 dark:border-indigo-900/50'
          : 'bg-rose-50/30 dark:bg-rose-950/10 text-rose-900 dark:text-rose-350 border-rose-100/60 dark:border-rose-900/50'
      }`}>
        <div className="mt-0.5 shrink-0">
          <CategoryIcon
            name={reportMetrics.income === 0 && reportMetrics.expenses === 0 ? 'Info' : reportMetrics.netSavings >= 0 ? 'Award' : 'AlertTriangle'}
            className={reportMetrics.income === 0 && reportMetrics.expenses === 0 ? 'text-slate-500 dark:text-slate-400' : reportMetrics.netSavings >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}
            size={16}
          />
        </div>
        <div>
          <span className="block font-bold text-slate-800 dark:text-slate-200 uppercase text-[9px] tracking-wider mb-0.5">
            CHAMLAK AI Diagnostics
          </span>
          <p dangerouslySetInnerHTML={{
            __html: insightText
              .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-slate-100">$1</strong>')
          }} />
        </div>
      </div>

      {/* Category Spending Details list */}
      {reportMetrics.sortedCategories.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <CategoryIcon name="TrendingDown" size={12} className="text-rose-500" />
            Monthly Category Breakdown
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {reportMetrics.sortedCategories.map(({ category, amount }) => {
              const config = getCategoryConfig(category);
              const percentOfExpenses = (amount / reportMetrics.expenses) * 100;
              return (
                <div
                  key={category}
                  className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 hover:border-slate-200 dark:hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${config.color} dark:border-transparent`}>
                      <CategoryIcon name={config.icon} size={14} />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{category}</span>
                      <span className="block text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                        {percentOfExpenses.toFixed(1)}% of monthly outflow
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono shrink-0">
                    {formatAmount(amount, currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});
MonthlyFinancialReport.displayName = 'MonthlyFinancialReport';

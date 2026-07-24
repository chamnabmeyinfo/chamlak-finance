import React from 'react';
import { Transaction } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { CurrencyCode, formatAmount } from '../utils/currency';

interface StatsGridProps {
  transactions: Transaction[];
  currency: CurrencyCode;
}

export const StatsGrid: React.FC<StatsGridProps> = React.memo(({ transactions, currency }) => {
  // Compute totals
  const stats = React.useMemo(() => {
    let income = 0;
    let expenses = 0;

    transactions.forEach((tx) => {
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
      }
    });

    const balance = income - expenses;
    const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

    return {
      balance,
      income,
      expenses,
      savingsRate,
    };
  }, [transactions]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" id="stats-grid">
      {/* Net Balance Card */}
      <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-900/60 rounded-2xl border border-slate-100/80 dark:border-slate-800/80 p-6 shadow-[var(--shadow-premium)] hover:shadow-[var(--shadow-premium-hover)] dark:hover:shadow-[var(--shadow-premium-dark-hover)] hover:border-indigo-150 dark:hover:border-indigo-950 transition-all duration-300 flex items-center justify-between group">
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest block">Net Balance</span>
          <span className={`text-2xl font-extrabold font-display tracking-tight ${stats.balance >= 0 ? 'text-slate-800 dark:text-slate-100' : 'text-rose-650 dark:text-rose-400'}`}>
            {formatAmount(stats.balance, currency)}
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
              stats.balance >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100/20' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-500 dark:text-rose-400 border border-rose-100/20'
            }`}>
              {stats.balance >= 0 ? 'Healthy Position' : 'Deficit'}
            </span>
          </div>
        </div>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 border ${
          stats.balance >= 0 
            ? 'bg-indigo-50/50 text-indigo-600 border-indigo-100/40 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/40' 
            : 'bg-rose-50/50 text-rose-500 border-rose-100/40 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40'
        }`}>
          <CategoryIcon name="Wallet" size={20} />
        </div>
      </div>

      {/* Total Income Card */}
      <div className="bg-gradient-to-br from-white to-emerald-50/10 dark:from-slate-900 dark:to-emerald-950/5 rounded-2xl border border-slate-100/80 dark:border-slate-800/80 p-6 shadow-[var(--shadow-premium)] hover:shadow-[var(--shadow-premium-hover)] dark:hover:shadow-[var(--shadow-premium-dark-hover)] hover:border-emerald-150 dark:hover:border-emerald-950 transition-all duration-300 flex items-center justify-between group">
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest block">Total Income</span>
          <span className="text-2xl font-extrabold text-emerald-650 dark:text-emerald-400 font-display tracking-tight">
            +{formatAmount(stats.income, currency)}
          </span>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
            <CategoryIcon name="TrendingUp" size={11} className="text-emerald-500 shrink-0" />
            <span className="truncate">All incoming receipts</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-50/50 text-emerald-600 border border-emerald-100/40 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
          <CategoryIcon name="ArrowUpRight" size={20} />
        </div>
      </div>

      {/* Total Expenses Card */}
      <div className="bg-gradient-to-br from-white to-rose-50/10 dark:from-slate-900 dark:to-rose-950/5 rounded-2xl border border-slate-100/80 dark:border-slate-800/80 p-6 shadow-[var(--shadow-premium)] hover:shadow-[var(--shadow-premium-hover)] dark:hover:shadow-[var(--shadow-premium-dark-hover)] hover:border-rose-150 dark:hover:border-rose-950 transition-all duration-300 flex items-center justify-between group">
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest block">Total Outflow</span>
          <span className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 font-display tracking-tight">
            -{formatAmount(stats.expenses, currency)}
          </span>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
            <CategoryIcon name="TrendingDown" size={11} className="text-rose-450" />
            <span className="truncate">All recorded payments</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-rose-50/50 text-rose-600 border border-rose-100/40 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
          <CategoryIcon name="ArrowDownRight" size={20} />
        </div>
      </div>

      {/* Savings Rate Card */}
      <div className="bg-gradient-to-br from-white to-indigo-50/10 dark:from-slate-900 dark:to-indigo-950/5 rounded-2xl border border-slate-100/80 dark:border-slate-800/80 p-6 shadow-[var(--shadow-premium)] hover:shadow-[var(--shadow-premium-hover)] dark:hover:shadow-[var(--shadow-premium-dark-hover)] hover:border-indigo-150 dark:hover:border-indigo-950 transition-all duration-300 flex items-center justify-between group">
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-widest block">Savings Margin</span>
          <span className={`text-2xl font-extrabold font-display tracking-tight ${stats.savingsRate >= 15 ? 'text-indigo-600 dark:text-indigo-400' : stats.savingsRate >= 0 ? 'text-amber-550 dark:text-amber-400' : 'text-rose-500'}`}>
            {stats.savingsRate.toFixed(1)}%
          </span>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 dark:text-slate-550 font-semibold">
            <CategoryIcon name="Percent" size={10} className="text-indigo-500 shrink-0" />
            <span className="truncate">
              {stats.savingsRate >= 30 ? 'Elite Savings tier' : stats.savingsRate >= 15 ? 'Solid budget cushion' : 'Tight budget ratio'}
            </span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-indigo-50/50 text-indigo-600 border border-indigo-100/40 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/40 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110">
          <CategoryIcon name="Percent" size={20} />
        </div>
      </div>
    </div>
  );
});
StatsGrid.displayName = 'StatsGrid';

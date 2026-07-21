import React from 'react';
import { Transaction } from '../types';
import { CategoryIcon } from './CategoryIcon';

interface StatsGridProps {
  transactions: Transaction[];
}

export const StatsGrid: React.FC<StatsGridProps> = ({ transactions }) => {
  // Compute totals
  const stats = React.useMemo(() => {
    let income = 0;
    let expenses = 0;

    transactions.forEach((tx) => {
      if (tx.type === 'income') {
        income += tx.amount;
      } else {
        expenses += tx.amount;
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-grid">
      {/* Net Balance Card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between transition hover:shadow-md duration-200">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Net Balance</span>
          <span className={`text-2xl font-bold font-mono tracking-tight ${stats.balance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>
            ${stats.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="flex items-center gap-1 mt-1">
            <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${
              stats.balance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
            }`}>
              {stats.balance >= 0 ? 'Healthy Position' : 'Deficit'}
            </span>
          </div>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
          stats.balance >= 0 ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-rose-50 text-rose-500 border border-rose-100'
        }`}>
          <CategoryIcon name="Wallet" size={20} />
        </div>
      </div>

      {/* Total Income Card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between transition hover:shadow-md duration-200">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Income</span>
          <span className="text-2xl font-bold text-emerald-600 font-mono tracking-tight">
            +${stats.income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 font-medium">
            <CategoryIcon name="TrendingUp" size={12} className="text-emerald-500" />
            <span>All incoming receipts</span>
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
          <CategoryIcon name="ArrowUpRight" size={20} />
        </div>
      </div>

      {/* Total Expenses Card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between transition hover:shadow-md duration-200">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Outflow</span>
          <span className="text-2xl font-bold text-slate-700 font-mono tracking-tight">
            -${stats.expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 font-medium">
            <CategoryIcon name="TrendingDown" size={12} className="text-rose-400" />
            <span>All recorded payments</span>
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
          <CategoryIcon name="ArrowDownRight" size={20} />
        </div>
      </div>

      {/* Savings Rate Card */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between transition hover:shadow-md duration-200">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Savings Margin</span>
          <span className={`text-2xl font-bold font-mono tracking-tight ${stats.savingsRate >= 15 ? 'text-indigo-600' : stats.savingsRate >= 0 ? 'text-amber-500' : 'text-rose-500'}`}>
            {stats.savingsRate.toFixed(1)}%
          </span>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-400 font-medium">
            <CategoryIcon name="Percent" size={11} className="text-indigo-500" />
            <span>
              {stats.savingsRate >= 30 ? 'Elite Savings tier' : stats.savingsRate >= 15 ? 'Solid budget cushion' : 'Tight budget ratio'}
            </span>
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
          <CategoryIcon name="Percent" size={20} />
        </div>
      </div>
    </div>
  );
};

import React, { useMemo } from 'react';
import { Transaction, Budget, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { CurrencyCode, formatAmount, formatAmountNoCents } from '../utils/currency';

interface DashboardInsightsProps {
  transactions: Transaction[];
  budgets: Budget[];
  currency: CurrencyCode;
}

export const DashboardInsights: React.FC<DashboardInsightsProps> = React.memo(({ transactions, budgets, currency }) => {
  // 0. Calculate Daily Budget Allowance & Alert Status
  const dailyBudgetData = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const currentMonthStr = today.toISOString().substring(0, 7); // "YYYY-MM"
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const currentDay = Math.max(1, today.getDate());
    const remainingDays = Math.max(1, totalDays - currentDay + 1);

    // Helper to get converted transaction value
    const getTxVal = (tx: Transaction) => {
      if (currency === 'USD') {
        return tx.totalUSD ?? (tx.currency === 'KHR' ? tx.amount / (tx.exchangeRate || 4000) : tx.amount);
      } else {
        return tx.totalKHR ?? (tx.currency === 'USD' ? tx.amount * (tx.exchangeRate || 4000) : tx.amount);
      }
    };

    // Determine target month (current month or latest month with data)
    let activeMonthStr = currentMonthStr;
    const hasDataInCurrentMonth = transactions.some(tx => tx.date.startsWith(currentMonthStr));
    if (!hasDataInCurrentMonth && transactions.length > 0) {
      const dates = transactions.map(t => t.date).sort().reverse();
      if (dates[0]) {
        activeMonthStr = dates[0].substring(0, 7);
      }
    }

    // Sum up overall budget limit
    const totalMonthlyBudget = budgets.reduce((sum, b) => {
      if (currency === 'KHR') return sum + (b.limit * 4000);
      return sum + b.limit;
    }, 0);

    // Sum up expenses in active month
    const totalSpentThisMonth = transactions
      .filter((tx) => tx.type === 'expense' && tx.date.startsWith(activeMonthStr))
      .reduce((sum, tx) => sum + getTxVal(tx), 0);

    const recommendedDailyAllowance = totalMonthlyBudget > 0 ? totalMonthlyBudget / totalDays : 0;
    const currentAverageDailySpend = totalSpentThisMonth / currentDay;
    
    const remainingBudget = Math.max(0, totalMonthlyBudget - totalSpentThisMonth);
    const remainingDailyAllowance = totalMonthlyBudget > 0 ? remainingBudget / remainingDays : 0;

    const isOverDailyAllowance = currentAverageDailySpend > recommendedDailyAllowance && recommendedDailyAllowance > 0;
    const isOverMonthlyLimit = totalSpentThisMonth > totalMonthlyBudget && totalMonthlyBudget > 0;

    return {
      totalMonthlyBudget,
      totalSpentThisMonth,
      totalDays,
      currentDay,
      remainingDays,
      recommendedDailyAllowance,
      currentAverageDailySpend,
      remainingDailyAllowance,
      isOverDailyAllowance,
      isOverMonthlyLimit,
      remainingBudget,
    };
  }, [transactions, budgets]);

  // 1. Calculate top spending categories and compare to previous month
  const topCategories = useMemo(() => {
    const today = new Date();
    const currentMonthStr = today.toISOString().substring(0, 7); // "YYYY-MM"
    
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthStr = prevMonthDate.toISOString().substring(0, 7); // "YYYY-MM"

    const currentSpending: Record<string, number> = {};
    const prevSpending: Record<string, number> = {};

    const getTxVal = (tx: Transaction) => {
      if (currency === 'USD') {
        return tx.totalUSD ?? (tx.currency === 'KHR' ? tx.amount / (tx.exchangeRate || 4000) : tx.amount);
      } else {
        return tx.totalKHR ?? (tx.currency === 'USD' ? tx.amount * (tx.exchangeRate || 4000) : tx.amount);
      }
    };

    transactions.forEach((tx) => {
      if (tx.type === 'expense') {
        const val = getTxVal(tx);
        if (tx.date.startsWith(currentMonthStr)) {
          currentSpending[tx.category] = (currentSpending[tx.category] || 0) + val;
        } else if (tx.date.startsWith(prevMonthStr)) {
          prevSpending[tx.category] = (prevSpending[tx.category] || 0) + val;
        } else {
          // If no current/prev month match, still capture in currentSpending to show insights if dates differ
          currentSpending[tx.category] = (currentSpending[tx.category] || 0) + val;
        }
      }
    });

    // Sort categories descending by current month spending
    const sortedCategories = Object.keys(currentSpending)
      .map((cat) => {
        const currentVal = currentSpending[cat];
        const prevVal = prevSpending[cat] || 0;
        
        let percentChange = 0;
        let changeType: 'increase' | 'decrease' | 'new' = 'new';

        if (prevVal > 0) {
          percentChange = ((currentVal - prevVal) / prevVal) * 100;
          changeType = percentChange >= 0 ? 'increase' : 'decrease';
        }

        return {
          category: cat,
          current: currentVal,
          previous: prevVal,
          percentChange: Math.abs(percentChange),
          changeType,
        };
      })
      .sort((a, b) => b.current - a.current)
      .slice(0, 3); // Top 3

    return sortedCategories;
  }, [transactions, currency]);

  // 3. Calculate Pay Under (Payer) Breakdown - Who Paid the Most
  const payerBreakdown = useMemo(() => {
    const payerMap: Record<string, { total: number; count: number }> = {};
    let grandTotal = 0;

    const getTxVal = (tx: Transaction) => {
      if (currency === 'USD') {
        return tx.totalUSD ?? (tx.currency === 'KHR' ? tx.amount / (tx.exchangeRate || 4000) : tx.amount);
      } else {
        return tx.totalKHR ?? (tx.currency === 'USD' ? tx.amount * (tx.exchangeRate || 4000) : tx.amount);
      }
    };

    transactions.forEach((tx) => {
      if (tx.type === 'expense') {
        const val = getTxVal(tx);
        const payer = (tx.payUnder || 'Company Account').trim();
        if (!payerMap[payer]) {
          payerMap[payer] = { total: 0, count: 0 };
        }
        payerMap[payer].total += val;
        payerMap[payer].count += 1;
        grandTotal += val;
      }
    });

    const sortedPayers = Object.entries(payerMap)
      .map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
        percentage: grandTotal > 0 ? (data.total / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      payers: sortedPayers.slice(0, 4),
      topPayer: sortedPayers[0] || null,
      totalPayers: sortedPayers.length,
      grandTotal,
    };
  }, [transactions, currency]);

  // 2. Calculate next 3 upcoming recurring transactions
  const upcomingRecurring = useMemo(() => {
    const recurringTxs = transactions.filter((t) => t.isRecurring && t.recurringInterval);
    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date(todayStr);

    const upcomingList: Array<{
      tx: Transaction;
      nextDateStr: string;
      daysLeft: number;
    }> = [];

    recurringTxs.forEach((tx) => {
      let refDateStr = tx.lastGeneratedDate || tx.date;
      let nextDate = new Date(refDateStr);
      const interval = tx.recurringInterval;

      // Find the first future occurrence date
      let safetyCounter = 0;
      while (safetyCounter < 100) {
        safetyCounter++;
        if (interval === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else if (interval === 'monthly') {
          nextDate.setMonth(nextDate.getMonth() + 1);
        } else {
          break;
        }
        
        const nextDateStr = nextDate.toISOString().split('T')[0];
        if (nextDateStr > todayStr) {
          const timeDiff = nextDate.getTime() - today.getTime();
          const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
          
          upcomingList.push({
            tx,
            nextDateStr,
            daysLeft,
          });
          break;
        }
      }
    });

    // Sort ascending by upcoming date
    upcomingList.sort((a, b) => a.nextDateStr.localeCompare(b.nextDateStr));
    return upcomingList.slice(0, 3);
  }, [transactions]);

  const formatDate = (dateStr: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString(undefined, options);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="dashboard-insights-grid">
      {/* 0. Daily Spending Allowance / Budget Alert Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between transition-colors duration-300">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">Daily Spending Allowance</h3>
              <p className="text-[11px] text-slate-450 dark:text-slate-500">Pacing-aware daily budgeting guidelines</p>
            </div>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
              dailyBudgetData.isOverDailyAllowance || dailyBudgetData.isOverMonthlyLimit
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-450'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400'
            }`}>
              <CategoryIcon name={dailyBudgetData.isOverDailyAllowance || dailyBudgetData.isOverMonthlyLimit ? "AlertTriangle" : "Compass"} size={15} />
            </div>
          </div>

          {dailyBudgetData.totalMonthlyBudget === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
              <CategoryIcon name="PiggyBank" size={24} className="mx-auto text-slate-300 mb-2" />
              No monthly budget limit established.
              <p className="text-[10px] text-slate-400 dark:text-slate-650 mt-1">Configure limits in "Budgets Planner" tab</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Daily Alert Banner */}
              <div className={`p-2.5 rounded-xl border text-xs font-medium flex items-start gap-2 ${
                dailyBudgetData.isOverDailyAllowance || dailyBudgetData.isOverMonthlyLimit
                  ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-100/60 dark:border-rose-900/30 text-rose-800 dark:text-rose-300'
                  : 'bg-emerald-50/50 dark:bg-emerald-950/15 border-emerald-100/60 dark:border-emerald-900/20 text-emerald-850 dark:text-emerald-300'
              }`}>
                <CategoryIcon 
                  name={dailyBudgetData.isOverDailyAllowance || dailyBudgetData.isOverMonthlyLimit ? "Flame" : "Sparkles"} 
                  size={14} 
                  className={`mt-0.5 shrink-0 ${dailyBudgetData.isOverDailyAllowance || dailyBudgetData.isOverMonthlyLimit ? 'text-rose-500' : 'text-emerald-550'}`} 
                />
                <div className="leading-normal">
                  {dailyBudgetData.isOverMonthlyLimit ? (
                    <span><strong>Exceeded!</strong> You've already spent your full monthly budget limit.</span>
                  ) : dailyBudgetData.isOverDailyAllowance ? (
                    <span><strong>Warning!</strong> Your daily spend average of <strong>{formatAmount(dailyBudgetData.currentAverageDailySpend, currency)}</strong> is over the recommended rate.</span>
                  ) : (
                    <span><strong>On Track!</strong> Your daily spend average is safely below the recommended rate.</span>
                  )}
                </div>
              </div>

              {/* Grid of allowance states */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-50/50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100/60 dark:border-slate-800/60">
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider mb-0.5">Recommended</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200 font-mono">
                    {formatAmount(dailyBudgetData.recommendedDailyAllowance, currency)}
                    <span className="text-[10px] font-semibold text-slate-400 font-sans ml-0.5">/day</span>
                  </span>
                </div>

                <div className="bg-slate-50/50 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-100/60 dark:border-slate-800/60">
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider mb-0.5">Current Average</span>
                  <span className={`text-sm font-extrabold font-mono ${
                    dailyBudgetData.isOverDailyAllowance ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'
                  }`}>
                    {formatAmount(dailyBudgetData.currentAverageDailySpend, currency)}
                    <span className="text-[10px] font-semibold text-slate-400 font-sans ml-0.5">/day</span>
                  </span>
                </div>
              </div>

              {/* Remaining Daily Spend Allowance Slider Indicator */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Remaining Allowance</span>
                  <span className={`font-mono font-bold ${dailyBudgetData.remainingDailyAllowance <= 0 ? 'text-rose-500' : 'text-emerald-650 dark:text-emerald-400'}`}>
                    {formatAmount(dailyBudgetData.remainingDailyAllowance, currency)}/day
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${
                      dailyBudgetData.remainingDailyAllowance <= 0 
                        ? 'bg-rose-500 w-full' 
                        : dailyBudgetData.remainingDailyAllowance < dailyBudgetData.recommendedDailyAllowance * 0.5 
                          ? 'bg-amber-500' 
                          : 'bg-emerald-500'
                    }`}
                    style={{ 
                      width: `${dailyBudgetData.totalMonthlyBudget > 0 
                        ? Math.min((dailyBudgetData.remainingBudget / dailyBudgetData.totalMonthlyBudget) * 100, 100) 
                        : 0}%` 
                    }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-450 dark:text-slate-500 font-medium">
                  <span>{dailyBudgetData.remainingDays} days left</span>
                  <span>{formatAmountNoCents(dailyBudgetData.remainingBudget, currency)} left in budget</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 1. Top Spending Categories Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between transition-colors duration-300">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">Top Spending Categories</h3>
              <p className="text-[11px] text-slate-450 dark:text-slate-500">Highest expenditures this month vs previous month</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CategoryIcon name="PieChart" size={15} />
            </div>
          </div>

          {topCategories.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
              <CategoryIcon name="TrendingDown" size={24} className="mx-auto text-slate-300 mb-2" />
              No expenditure logged in current month.
            </div>
          ) : (
            <div className="space-y-4">
              {topCategories.map((item) => {
                const config = EXPENSE_CATEGORIES[item.category] || {
                  name: item.category,
                  color: 'bg-slate-50 text-slate-700',
                  icon: 'HelpCircle',
                };
                
                return (
                  <div key={item.category} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${config.color}`}>
                          <CategoryIcon name={config.icon} size={14} />
                        </div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{config.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                          {formatAmount(item.current, currency)}
                        </span>
                        
                        {/* Percentage Change Badge */}
                        {item.changeType === 'new' ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                            New Category
                          </span>
                        ) : item.changeType === 'increase' ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-500 dark:text-rose-450 flex items-center gap-0.5" title={`Spent ${formatAmount(item.previous, currency)} last month`}>
                            <CategoryIcon name="TrendingUp" size={8} />
                            +{item.percentChange.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5" title={`Spent ${formatAmount(item.previous, currency)} last month`}>
                            <CategoryIcon name="TrendingDown" size={8} />
                            -{item.percentChange.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Simple spending horizontal representation */}
                    <div className="w-full h-1.5 bg-slate-55 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full" 
                        style={{ width: `${Math.min((item.current / Math.max(...topCategories.map(t => t.current))) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Upcoming Recurring Transactions Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between transition-colors duration-300">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">Upcoming Payments</h3>
              <p className="text-[11px] text-slate-450 dark:text-slate-500">Next 3 scheduled recurring transactions</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <CategoryIcon name="CalendarRange" size={15} />
            </div>
          </div>

          {upcomingRecurring.length === 0 ? (
            <div className="text-center py-8 text-slate-450 dark:text-slate-500 text-xs">
              <CategoryIcon name="RefreshCw" size={24} className="mx-auto text-slate-350 mb-2 animate-spin-slow" />
              No active recurring schedules recorded.
              <p className="text-[10px] text-slate-400 dark:text-slate-650 mt-1">Enable "Recurring" when adding a new record</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingRecurring.map(({ tx, nextDateStr, daysLeft }) => {
                const isExpense = tx.type === 'expense';
                const config = isExpense 
                  ? EXPENSE_CATEGORIES[tx.category] || { name: tx.category, color: 'bg-slate-50 text-slate-700', icon: 'HelpCircle' }
                  : INCOME_CATEGORIES[tx.category] || { name: tx.category, color: 'bg-slate-50 text-slate-700', icon: 'HelpCircle' };
                
                return (
                  <div 
                    key={tx.id} 
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-950/30 transition duration-150"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.color}`}>
                        <CategoryIcon name={config.icon} size={14} />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                          {tx.description}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 dark:text-slate-550 uppercase flex items-center gap-1 mt-0.5">
                          <CategoryIcon name="Repeat" size={8} />
                          {tx.recurringInterval} ({config.name})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 text-right shrink-0">
                      <div>
                        <span className={`block text-xs font-bold font-mono ${isExpense ? 'text-slate-650 dark:text-slate-300' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {isExpense ? '-' : '+'}{formatAmountNoCents(tx.amount, currency)}
                        </span>
                        <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 block mt-0.5">
                          Due {formatDate(nextDateStr)}
                        </span>
                      </div>

                      {/* Days Left Badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md min-w-14 text-center ${
                        daysLeft <= 3 
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' 
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-550 dark:text-slate-400'
                      }`}>
                        {daysLeft === 1 ? 'Tomorrow' : `In ${daysLeft} days`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Top Payers (Who Paid the Most - Pay Under Breakdown) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between transition-colors duration-300">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">Top Payers (Pay Under)</h3>
              <p className="text-[11px] text-slate-450 dark:text-slate-500">Expenses grouped by payer account</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <CategoryIcon name="UserCheck" size={15} />
            </div>
          </div>

          {payerBreakdown.payers.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
              <CategoryIcon name="Users" size={24} className="mx-auto text-slate-300 mb-2" />
              No payer records logged.
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Top Payer Crown Banner */}
              {payerBreakdown.topPayer && (
                <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <CategoryIcon name="Crown" size={13} />
                    </div>
                    <div className="min-w-0">
                      <span className="block font-bold text-amber-950 dark:text-amber-200 truncate">
                        {payerBreakdown.topPayer.name}
                      </span>
                      <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-medium">
                        Top Payer ({payerBreakdown.topPayer.count} txs)
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block font-mono font-extrabold text-amber-900 dark:text-amber-300">
                      {formatAmount(payerBreakdown.topPayer.total, currency)}
                    </span>
                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                      {payerBreakdown.topPayer.percentage.toFixed(1)}% share
                    </span>
                  </div>
                </div>
              )}

              {/* Payers Breakdown Rows */}
              <div className="space-y-2.5 pt-0.5">
                {payerBreakdown.payers.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-32" title={item.name}>
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({item.count} txs)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {formatAmount(item.total, currency)}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">
                          {item.percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(item.percentage, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
DashboardInsights.displayName = 'DashboardInsights';

import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { CurrencyCode, formatAmount } from '../utils/currency';

interface TransactionCalendarProps {
  transactions: Transaction[];
  currency: CurrencyCode;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
}

export const TransactionCalendar: React.FC<TransactionCalendarProps> = ({
  transactions,
  currency,
  onEdit,
  onDelete,
}) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(2026); // Default to our target session context year
  const [currentMonth, setCurrentMonth] = useState<number>(6); // July is 6 (0-indexed)

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Handle month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  // State to track selected day in the calendar to show details
  const [selectedDayString, setSelectedDayString] = useState<string | null>(null);

  // Generate calendar days
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const cells: {
      day: number;
      dateString: string;
      isCurrentMonth: boolean;
      transactions: Transaction[];
      dailyIncome: number;
      dailyExpense: number;
    }[] = [];

    // Prev month padding cells
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const day = totalDaysInPrevMonth - i;
      const prevMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYearIdx = currentMonth === 0 ? currentYear - 1 : currentYear;
      const dateString = `${prevYearIdx}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      cells.push({
        day,
        dateString,
        isCurrentMonth: false,
        transactions: [],
        dailyIncome: 0,
        dailyExpense: 0,
      });
    }

    // Current month cells
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Filter transactions for this day
      const dayTxs = transactions.filter((t) => t.date === dateString);
      
      let dailyIncome = 0;
      let dailyExpense = 0;
      dayTxs.forEach((t) => {
        const val = currency === 'USD' 
          ? (t.totalUSD ?? (t.currency === 'KHR' ? t.amount / (t.exchangeRate || 4000) : t.amount))
          : (t.totalKHR ?? (t.currency === 'USD' ? t.amount * (t.exchangeRate || 4000) : t.amount));
        if (t.type === 'income') {
          dailyIncome += val;
        } else {
          dailyExpense += val;
        }
      });

      cells.push({
        day,
        dateString,
        isCurrentMonth: true,
        transactions: dayTxs,
        dailyIncome,
        dailyExpense,
      });
    }

    // Next month padding cells to complete 6 rows (42 cells)
    const remainingCellsCount = 42 - cells.length;
    for (let day = 1; day <= remainingCellsCount; day++) {
      const nextMonthIdx = currentMonth === 11 ? 0 : currentMonth + 1;
      const nextYearIdx = currentMonth === 11 ? currentYear + 1 : currentYear;
      const dateString = `${nextYearIdx}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      cells.push({
        day,
        dateString,
        isCurrentMonth: false,
        transactions: [],
        dailyIncome: 0,
        dailyExpense: 0,
      });
    }

    return cells;
  }, [currentYear, currentMonth, transactions]);

  // Selected day's transactions details
  const selectedDayData = useMemo(() => {
    if (!selectedDayString) return null;
    return calendarGrid.find((cell) => cell.dateString === selectedDayString) || null;
  }, [selectedDayString, calendarGrid]);

  return (
    <div className="space-y-6" id="transaction-calendar-container">
      {/* Calendar Controller Header */}
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <CategoryIcon name="Calendar" size={16} className="text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {MONTHS[currentMonth]} {currentYear}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer transition shadow-3xs hover:shadow-2xs"
            title="Previous Month"
          >
            <CategoryIcon name="ChevronLeft" size={14} />
          </button>
          <button
            onClick={() => {
              setCurrentYear(today.getFullYear());
              setCurrentMonth(today.getMonth());
            }}
            className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer transition shadow-3xs"
          >
            Today
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer transition shadow-3xs hover:shadow-2xs"
            title="Next Month"
          >
            <CategoryIcon name="ChevronRight" size={14} />
          </button>
        </div>
      </div>

      {/* Calendar Grid Display */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-850 overflow-hidden shadow-sm">
        {/* Days of week labels */}
        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/40 py-2.5 text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Days grid cells */}
        <div className="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-slate-100 dark:divide-slate-850">
          {calendarGrid.map((cell, index) => {
            const isSelected = selectedDayString === cell.dateString;
            const hasTransactions = cell.transactions.length > 0;
            const isToday = cell.dateString === today.toISOString().split('T')[0];

            return (
              <div
                key={`${cell.dateString}-${index}`}
                onClick={() => cell.isCurrentMonth && setSelectedDayString(cell.dateString)}
                className={`min-h-[75px] sm:min-h-[85px] p-2 flex flex-col justify-between transition relative ${
                  cell.isCurrentMonth 
                    ? 'bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-950/40 cursor-pointer' 
                    : 'bg-slate-50/40 dark:bg-slate-950/20 text-slate-350 dark:text-slate-700 pointer-events-none'
                } ${isSelected ? 'ring-2 ring-indigo-500/35 ring-inset bg-indigo-50/10 dark:bg-indigo-950/10' : ''}`}
              >
                {/* Day Header */}
                <div className="flex justify-between items-center">
                  <span className={`text-[11px] font-bold ${
                    isToday 
                      ? 'bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center font-mono' 
                      : cell.isCurrentMonth 
                      ? 'text-slate-600 dark:text-slate-400 font-mono' 
                      : 'text-slate-350 dark:text-slate-700 font-mono'
                  }`}>
                    {cell.day}
                  </span>
                  {hasTransactions && (
                    <span className="w-1.5 h-1.5 bg-indigo-500 dark:bg-indigo-400 rounded-full" />
                  )}
                </div>

                {/* Daily Sum Indicators */}
                {cell.isCurrentMonth && (
                  <div className="space-y-0.5 mt-1 select-none">
                    {cell.dailyIncome > 0 && (
                      <div className="text-[9px] font-extrabold font-mono text-emerald-600 dark:text-emerald-400 truncate bg-emerald-50/40 dark:bg-emerald-950/20 px-1 rounded border border-emerald-100/20">
                        +{formatAmount(cell.dailyIncome, currency).split('.')[0]}
                      </div>
                    )}
                    {cell.dailyExpense > 0 && (
                      <div className="text-[9px] font-extrabold font-mono text-rose-500 dark:text-rose-400 truncate bg-rose-50/40 dark:bg-rose-950/20 px-1 rounded border border-rose-100/20">
                        -{formatAmount(cell.dailyExpense, currency).split('.')[0]}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Transaction Detail View */}
      {selectedDayData && selectedDayData.transactions.length > 0 ? (
        <div className="bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-150 dark:border-slate-800 p-5 space-y-4 animate-fade-in">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Transactions on {selectedDayData.dateString}
              </h4>
              <p className="text-[10px] text-slate-400 dark:text-slate-550 font-medium">
                {selectedDayData.transactions.length} records mapped
              </p>
            </div>
            <button
              onClick={() => setSelectedDayString(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition text-[10px] font-bold cursor-pointer"
            >
              Close Details
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 space-y-2">
            {selectedDayData.transactions.map((tx) => {
              const isExpense = tx.type === 'expense';
              return (
                <div key={tx.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate block">
                      {tx.description}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 px-1.5 py-0.2 rounded-sm uppercase tracking-wide">
                      {tx.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className={`text-xs font-bold font-mono ${isExpense ? 'text-slate-600 dark:text-slate-350' : 'text-emerald-600 dark:text-emerald-400'} block`}>
                        {isExpense ? '-' : '+'}{formatAmount(tx.amount, tx.currency || 'USD')}
                      </span>
                      {tx.currency !== currency && (
                        <span className="text-[9px] text-slate-400 font-mono block">
                          ≈ {formatAmount(currency === 'USD' ? (tx.totalUSD ?? (tx.amount / (tx.exchangeRate || 4000))) : (tx.totalKHR ?? (tx.amount * (tx.exchangeRate || 4000))), currency)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEdit(tx)}
                        className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 rounded transition cursor-pointer"
                        title="Edit entry"
                      >
                        <CategoryIcon name="Edit" size={11} />
                      </button>
                      <button
                        onClick={() => onDelete(tx.id)}
                        className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-1 rounded transition cursor-pointer"
                        title="Delete entry"
                      >
                        <CategoryIcon name="Trash" size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : selectedDayString ? (
        <div className="bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-150 dark:border-slate-800 p-5 text-center text-xs text-slate-400 dark:text-slate-550 flex flex-col items-center justify-center py-8">
          <CategoryIcon name="PlusCircle" className="text-slate-350 dark:text-slate-600 mb-2" size={20} />
          <p className="font-semibold">No recorded logs for {selectedDayString}</p>
          <p className="text-[10px] text-slate-400 mt-1">Navigate to 'Add Record' or select another date in the calendar.</p>
        </div>
      ) : null}
    </div>
  );
};

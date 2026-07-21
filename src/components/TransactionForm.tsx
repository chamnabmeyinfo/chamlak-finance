import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { SmartAIScanner } from './SmartAIScanner';

interface TransactionFormProps {
  onSubmit: (tx: Omit<Transaction, 'id'>) => void;
  initialTransaction?: Transaction | null;
  onCancelEdit?: () => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  onSubmit,
  initialTransaction,
  onCancelEdit,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [date, setDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [description, setDescription] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Card');
  const [error, setError] = useState<string>('');
  const [entryMode, setEntryMode] = useState<'manual' | 'ai'>('manual');

  // Handle setting fields when initialTransaction is passed (Editing mode)
  useEffect(() => {
    if (initialTransaction) {
      setType(initialTransaction.type);
      setAmount(initialTransaction.amount.toString());
      setCategory(initialTransaction.category);
      setDate(initialTransaction.date);
      setDescription(initialTransaction.description);
      setPaymentMethod(initialTransaction.paymentMethod);
      setEntryMode('manual');
    } else {
      // Clear form except date
      setAmount('');
      setDescription('');
      // Set default category for selected type
      const defaultCat = type === 'expense' ? 'Food' : 'Salary';
      setCategory(defaultCat);
    }
  }, [initialTransaction]);

  // Adjust default category when type toggles
  useEffect(() => {
    if (!initialTransaction) {
      const defaultCat = type === 'expense' ? 'Food' : 'Salary';
      setCategory(defaultCat);
    }
  }, [type, initialTransaction]);

  const handleSetFormFields = (fields: Partial<Omit<Transaction, 'id'>>) => {
    if (fields.type) setType(fields.type);
    if (fields.amount) setAmount(fields.amount.toString());
    if (fields.category) setCategory(fields.category);
    if (fields.date) setDate(fields.date);
    if (fields.description) setDescription(fields.description);
    if (fields.paymentMethod) setPaymentMethod(fields.paymentMethod);
    setEntryMode('manual');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than $0.');
      return;
    }

    if (!category) {
      setError('Please select a category.');
      return;
    }

    if (!date) {
      setError('Please choose a valid date.');
      return;
    }

    onSubmit({
      type,
      amount: parsedAmount,
      category,
      date,
      description: description.trim() || `${category} Transaction`,
      paymentMethod,
    });

    // Reset inputs if not editing
    if (!initialTransaction) {
      setAmount('');
      setDescription('');
    }
  };

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col" id="transaction-form-card">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800 tracking-tight">
          {initialTransaction ? 'Edit Transaction' : 'Record Transaction'}
        </h2>
        <p className="text-xs text-slate-400">
          {initialTransaction ? 'Update the details of your transaction record' : 'Keep your finances up to date'}
        </p>
      </div>

      {/* Tabs Selector */}
      {!initialTransaction && (
        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 mb-4" id="entry-tabs">
          <button
            type="button"
            onClick={() => setEntryMode('manual')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              entryMode === 'manual'
                ? 'bg-white text-slate-800 shadow-2xs border border-slate-100'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            id="tab-manual-entry"
          >
            Manual Entry
          </button>
          <button
            type="button"
            onClick={() => setEntryMode('ai')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              entryMode === 'ai'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            id="tab-ai-scan"
          >
            <CategoryIcon name="Sparkles" size={12} />
            Smart AI Scan
          </button>
        </div>
      )}

      {entryMode === 'ai' && !initialTransaction ? (
        <SmartAIScanner
          onApplyTransaction={onSubmit}
          currentType={type}
          onSetFormFields={handleSetFormFields}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-4">
          {/* Income vs Expense Toggle */}
          <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100 relative">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all duration-300 relative z-10 ${
                type === 'expense'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              id="btn-toggle-expense"
            >
              <CategoryIcon name="ArrowDownRight" size={14} />
              Expense
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all duration-300 relative z-10 ${
                type === 'income'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              id="btn-toggle-income"
            >
              <CategoryIcon name="ArrowUpRight" size={14} />
              Income
            </button>
          </div>

          {/* Amount input */}
          <div>
            <label htmlFor="amount" className="block text-xs font-medium text-slate-500 mb-1">
              Amount ($)
            </label>
            <div className="relative rounded-xl shadow-2xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <span className="text-slate-400 font-medium text-sm">$</span>
              </div>
              <input
                type="number"
                name="amount"
                id="amount"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="block w-full rounded-xl border border-slate-200 py-2.5 pl-8 pr-3 text-sm font-semibold font-mono text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none transition-all"
              />
            </div>
          </div>

          {/* Interactive Category Grid/Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Category
            </label>
            <div className="grid grid-cols-4 gap-2 max-h-[160px] overflow-y-auto pr-1">
              {Object.entries(categories).map(([key, config]) => {
                const isSelected = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                      isSelected
                        ? `${config.color} ${config.borderColor} shadow-xs font-medium ring-1 ring-slate-100`
                        : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    }`}
                    title={config.name}
                  >
                    <CategoryIcon name={config.icon} size={16} className="mb-1" />
                    <span className="text-[9px] text-center line-clamp-1 w-full font-medium">
                      {config.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label htmlFor="date" className="block text-xs font-medium text-slate-500 mb-1">
              Transaction Date
            </label>
            <div className="relative">
              <input
                type="date"
                id="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="block w-full rounded-xl border border-slate-200 py-2.5 px-3.5 text-xs text-slate-700 focus:border-indigo-400 outline-none transition-all"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label htmlFor="paymentMethod" className="block text-xs font-medium text-slate-500 mb-1">
              Payment Method
            </label>
            <select
              id="paymentMethod"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="block w-full rounded-xl border border-slate-200 py-2.5 px-3 text-xs text-slate-700 bg-white focus:border-indigo-400 outline-none transition-all"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          {/* Description input */}
          <div>
            <label htmlFor="description" className="block text-xs font-medium text-slate-500 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Weekly Groceries, Gas, Salary Bonus"
              maxLength={40}
              className="block w-full rounded-xl border border-slate-200 py-2.5 px-3.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 outline-none transition-all"
            />
          </div>

          {/* Error Message banner */}
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium border border-red-100 flex items-center gap-1.5 animate-pulse">
              <CategoryIcon name="Info" size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Form Action Buttons */}
        <div className="pt-4 flex gap-2">
          {initialTransaction && onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="flex-1 py-2.5 px-4 text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              id="btn-form-cancel"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className={`flex-1 py-2.5 px-4 text-xs font-semibold text-white rounded-xl shadow-xs transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
              type === 'expense'
                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
            }`}
            id="btn-form-submit"
          >
            <CategoryIcon name={initialTransaction ? 'Check' : 'Plus'} size={14} />
            {initialTransaction ? 'Update Entry' : 'Add Entry'}
          </button>
        </div>
      </form>
      )}
    </div>
  );
};

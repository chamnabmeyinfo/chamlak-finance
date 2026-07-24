import React, { useState, useMemo } from 'react';
import { 
  Transaction, 
  TransactionType, 
  INCOME_CATEGORIES, 
  EXPENSE_CATEGORIES, 
  PAYMENT_METHODS,
  CategoryConfig
} from '../types';
import { CategoryIcon } from './CategoryIcon';
import { CurrencyCode, formatAmount } from '../utils/currency';
import { SmartAIScanner } from './SmartAIScanner';

interface QuickAddWidgetProps {
  onSubmit: (tx: Omit<Transaction, 'id'>) => void;
  currency: CurrencyCode;
}

export const QuickAddWidget: React.FC<QuickAddWidgetProps> = ({ onSubmit, currency }) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Card');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSuccessEffect, setIsSuccessEffect] = useState<boolean>(false);
  const [entryMode, setEntryMode] = useState<'manual' | 'ai'>('manual');

  const handleSetFormFields = (fields: Partial<Omit<Transaction, 'id'>>) => {
    if (fields.type) setType(fields.type);
    if (fields.amount) setAmount(fields.amount.toString());
    if (fields.category) setSelectedCategory(fields.category);
    if (fields.description) setDescription(fields.description);
    if (fields.paymentMethod) setPaymentMethod(fields.paymentMethod);
    setEntryMode('manual');
  };

  // Categories list based on selected transaction type
  const activeCategories = useMemo(() => {
    return type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  }, [type]);

  // Reset category selection when switching type
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setSelectedCategory('');
    setErrorMessage('');
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please enter a valid amount greater than 0.');
      return;
    }

    if (!selectedCategory) {
      setErrorMessage('Please select a category.');
      return;
    }

    // Default description to category name if left empty
    const catLabel = activeCategories[selectedCategory]?.name || selectedCategory;
    const finalDescription = description.trim() || `Quick ${catLabel}`;

    onSubmit({
      type,
      amount: parsedAmount,
      category: selectedCategory,
      date: new Date().toISOString().split('T')[0], // Current local/UTC date
      description: finalDescription,
      paymentMethod,
    });

    // Run custom micro-success animation
    setIsSuccessEffect(true);
    setTimeout(() => {
      setIsSuccessEffect(false);
    }, 1500);

    // Reset fields
    setAmount('');
    setSelectedCategory('');
    setDescription('');
  };

  return (
    <div 
      className={`bg-gradient-to-br from-white to-slate-50/40 dark:from-slate-900 dark:to-slate-900/60 rounded-3xl border transition-all duration-300 p-6 shadow-[var(--shadow-premium)] hover:shadow-[var(--shadow-premium-hover)] dark:hover:shadow-[var(--shadow-premium-dark-hover)] relative overflow-hidden ${
        isSuccessEffect 
          ? 'border-emerald-500 dark:border-emerald-600 ring-4 ring-emerald-500/10' 
          : 'border-slate-100/85 dark:border-slate-800/80'
      }`}
      id="quick-add-widget-card"
    >
      {/* Visual background ripple on success */}
      {isSuccessEffect && (
        <div className="absolute inset-0 bg-emerald-500/5 dark:bg-emerald-500/5 pointer-events-none animate-fade-in" />
      )}

      {/* Header section (Zap icon, title, expense/income toggle) */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100/60 dark:border-slate-800/60" id="quick-add-header">
        <div>
          <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight font-display flex items-center gap-1.5">
            <CategoryIcon name="Zap" size={14} className="text-amber-500 animate-pulse" />
            Quick Add Transaction
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Log standard records instantly</p>
        </div>
        
        {/* Expense/Income Toggle pills */}
        <div className="flex p-0.5 bg-slate-100/80 dark:bg-slate-950 rounded-xl border border-slate-150/70 dark:border-slate-850">
          <button
            type="button"
            onClick={() => handleTypeChange('expense')}
            className={`px-3 py-1 text-[10px] font-extrabold rounded-lg cursor-pointer transition-all duration-150 ${
              type === 'expense'
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xs border border-slate-200/50 dark:border-slate-800'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-650'
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('income')}
            className={`px-3 py-1 text-[10px] font-extrabold rounded-lg cursor-pointer transition-all duration-150 ${
              type === 'income'
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xs border border-slate-200/50 dark:border-slate-800'
                : 'text-slate-400 dark:text-slate-500 hover:text-slate-650'
            }`}
          >
            Income
          </button>
        </div>
      </div>

      {/* Entry Mode Tabs */}
      <div className="flex bg-slate-100/60 dark:bg-slate-950 p-1 rounded-xl border border-slate-150/70 dark:border-slate-850 mb-4" id="quick-add-entry-tabs">
        <button
          type="button"
          onClick={() => setEntryMode('manual')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            entryMode === 'manual'
              ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xs border border-slate-100 dark:border-slate-800'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          Manual Form
        </button>
        <button
          type="button"
          onClick={() => setEntryMode('ai')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            entryMode === 'ai'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <CategoryIcon name="Sparkles" size={12} />
          Smart AI Scanner
        </button>
      </div>

      {entryMode === 'ai' ? (
        <div className="animate-fade-in">
          <SmartAIScanner
            onApplyTransaction={onSubmit}
            currentType={type}
            onSetFormFields={handleSetFormFields}
          />
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 items-stretch animate-fade-in">
          
          {/* Left column: Type & Numeric input */}
          <div className="flex-1 flex flex-col justify-between space-y-4">
            <div>
              {/* Form Container */}
              <form onSubmit={handleQuickAddSubmit} className="space-y-4 mt-1">
                {/* Amount input */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Amount
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <span className="text-slate-400 dark:text-slate-500 text-xs font-bold font-mono">
                        {currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '¥'}
                      </span>
                    </div>
                    <input
                      type="number"
                      step="any"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        if (errorMessage && e.target.value) setErrorMessage('');
                      }}
                      placeholder="0.00"
                      className="block w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400/20 outline-none font-bold font-mono transition-all"
                    />
                  </div>
                </div>

                {/* Description Input */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Description <span className="text-[9px] font-medium text-slate-350 dark:text-slate-600">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={`e.g. ${type === 'expense' ? 'Lunch, Uber, Coffee' : 'Bonus, Project, Interest'}`}
                    className="block w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:border-indigo-400 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400/20 outline-none font-medium transition-all"
                  />
                </div>

                {/* Error label */}
                {errorMessage && (
                  <div className="p-2 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                    {errorMessage}
                  </div>
                )}
              </form>
            </div>

            {/* Payment selector pills */}
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Payment Method
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PAYMENT_METHODS.map((method) => {
                  // Pick icon based on method name
                  let iconName = 'CreditCard';
                  if (method === 'Cash') iconName = 'Coins';
                  else if (method === 'Bank Transfer') iconName = 'ArrowLeftRight';
                  else if (method === 'Mobile Pay') iconName = 'Smartphone';

                  const isSelected = paymentMethod === method;

                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900'
                      }`}
                    >
                      <CategoryIcon name={iconName} size={11} />
                      {method}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right column: Category selection & submit button */}
          <div className="flex-1 flex flex-col justify-between space-y-4 lg:border-l lg:border-slate-100 lg:dark:border-slate-800 lg:pl-6">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Select Category
              </span>
              
              {/* Category selection grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
                {Object.entries(activeCategories).map(([catKey, rawConfig]) => {
                  const config = rawConfig as CategoryConfig;
                  const isSelected = selectedCategory === catKey;
                  
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(catKey);
                        if (errorMessage) setErrorMessage('');
                      }}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? `${config.color} ${config.borderColor} border shadow-xs ring-1 ring-slate-150 dark:ring-slate-800 font-bold scale-[1.02]`
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-150 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 font-semibold'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center border shrink-0 ${
                        isSelected ? 'bg-white/90 dark:bg-slate-900/80' : 'bg-white dark:bg-slate-900'
                      }`}>
                        <CategoryIcon name={config.icon} size={11} className={config.textColor} />
                      </div>
                      <span className="text-[11px] truncate">{config.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Submit action */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleQuickAddSubmit}
                className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-tr transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-100 dark:shadow-none hover:shadow-md ${
                  type === 'expense'
                    ? 'from-indigo-600 to-indigo-500 hover:from-indigo-650 hover:to-indigo-550 border border-indigo-400/20'
                    : 'from-emerald-600 to-emerald-500 hover:from-emerald-650 hover:to-emerald-550 border border-emerald-400/20'
                }`}
              >
                <CategoryIcon name={isSuccessEffect ? "CheckCircle2" : "Sparkles"} size={13} className={isSuccessEffect ? "animate-bounce" : ""} />
                {isSuccessEffect 
                  ? 'Transaction Recorded!' 
                  : `Quick Add ${type === 'expense' ? 'Expense' : 'Income'}`
                }
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

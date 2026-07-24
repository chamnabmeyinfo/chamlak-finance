import React, { useState, useEffect } from 'react';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  CurrencyType,
  AppSettings,
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  TRANSACTION_STATUSES,
} from '../types';
import { CategoryIcon } from './CategoryIcon';
import { SmartAIScanner } from './SmartAIScanner';
import { calculateWeekOfMonth, DEFAULT_EXCHANGE_RATE, normalizeWorksheetTransaction } from '../utils/worksheetUtils';

interface TransactionFormProps {
  onSubmit: (tx: Omit<Transaction, 'id'>) => void;
  initialTransaction?: Transaction | null;
  onCancelEdit?: () => void;
  defaultEntryMode?: 'manual' | 'ai';
  settings?: AppSettings;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
  onSubmit,
  initialTransaction,
  onCancelEdit,
  defaultEntryMode,
  settings,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [vendor, setVendor] = useState<string>('');
  const [currency, setCurrency] = useState<CurrencyType>('USD');
  const [netAmountInput, setNetAmountInput] = useState<string>('');
  const [taxAmountInput, setTaxAmountInput] = useState<string>('0');
  const [amountInput, setAmountInput] = useState<string>('');
  const [exchangeRateInput, setExchangeRateInput] = useState<string>(DEFAULT_EXCHANGE_RATE.toString());
  const [status, setStatus] = useState<TransactionStatus>('Paid');
  const [payUnder, setPayUnder] = useState<string>('Company Account');
  const [category, setCategory] = useState<string>('Food');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Card');
  const [imageAttachment, setImageAttachment] = useState<string>('');
  const [imageAttachmentName, setImageAttachmentName] = useState<string>('');
  const [additionalEvidence, setAdditionalEvidence] = useState<string>('');
  const [additionalEvidenceName, setAdditionalEvidenceName] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringInterval, setRecurringInterval] = useState<'weekly' | 'monthly'>('monthly');
  const [notes, setNotes] = useState<string>('');
  const [tagsInput, setTagsInput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [entryMode, setEntryMode] = useState<'manual' | 'ai'>('manual');

  const defaultAllowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx'];
  const allowedExts = settings?.allowedFileTypes && settings.allowedFileTypes.length > 0
    ? settings.allowedFileTypes
    : defaultAllowedExts;

  const validateAndReadFile = (file: File, onSuccess: (dataUrl: string, name: string) => void) => {
    const fileName = file.name;
    const ext = '.' + fileName.split('.').pop()?.toLowerCase();
    
    const isAllowedExt = allowedExts.some(
      (e) => e.toLowerCase() === ext || (e === 'image/*' && file.type.startsWith('image/'))
    );

    if (!isAllowedExt) {
      setError(`File extension "${ext}" is not allowed. Permitted formats: ${allowedExts.join(', ')}`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(`File size exceeds 10MB limit.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setError('');
        onSuccess(event.target.result as string, fileName);
      }
    };
    reader.readAsDataURL(file);
  };

  const isImageFile = (url: string, name?: string) => {
    if (url.startsWith('data:image/')) return true;
    if (name) {
      const ext = name.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext || '')) return true;
    }
    return false;
  };

  // Sync default entry mode
  useEffect(() => {
    if (defaultEntryMode) {
      setEntryMode(defaultEntryMode);
    }
  }, [defaultEntryMode]);

  // Set values when initialTransaction changes (Edit Mode)
  useEffect(() => {
    if (initialTransaction) {
      setType(initialTransaction.type);
      setVendor(initialTransaction.vendor || '');
      setCurrency(initialTransaction.currency || 'USD');
      setExchangeRateInput((initialTransaction.exchangeRate || DEFAULT_EXCHANGE_RATE).toString());
      setStatus(initialTransaction.status || 'Paid');
      setPayUnder(initialTransaction.payUnder || 'Company Account');
      
      const net = initialTransaction.netAmount !== undefined ? initialTransaction.netAmount : initialTransaction.amount;
      const tax = initialTransaction.taxAmount !== undefined ? initialTransaction.taxAmount : 0;
      setNetAmountInput(net > 0 ? net.toString() : '');
      setTaxAmountInput(tax.toString());
      setAmountInput(initialTransaction.amount.toString());

      setCategory(initialTransaction.category);
      setDate(initialTransaction.date);
      setDescription(initialTransaction.description);
      setPaymentMethod(initialTransaction.paymentMethod);
      setImageAttachment(initialTransaction.imageAttachment || '');
      setImageAttachmentName(initialTransaction.imageAttachmentName || '');
      setAdditionalEvidence(initialTransaction.additionalEvidence || '');
      setAdditionalEvidenceName(initialTransaction.additionalEvidenceName || '');
      setIsRecurring(initialTransaction.isRecurring || false);
      setRecurringInterval(initialTransaction.recurringInterval || 'monthly');
      setNotes(initialTransaction.notes || '');
      setTagsInput(initialTransaction.tags ? initialTransaction.tags.join(', ') : '');
      setEntryMode('manual');
    } else {
      setVendor('');
      setCurrency('USD');
      setNetAmountInput('');
      setTaxAmountInput('0');
      setAmountInput('');
      setExchangeRateInput(DEFAULT_EXCHANGE_RATE.toString());
      setStatus('Paid');
      setPayUnder('Company Account');
      setDescription('');
      setImageAttachment('');
      setImageAttachmentName('');
      setAdditionalEvidence('');
      setAdditionalEvidenceName('');
      setIsRecurring(false);
      setRecurringInterval('monthly');
      setNotes('');
      setTagsInput('');
      setCategory(type === 'expense' ? 'Food' : 'Salary');
    }
  }, [initialTransaction]);

  // Auto-calculate Total Amount when Net or Tax inputs change
  const handleNetOrTaxChange = (netVal: string, taxVal: string) => {
    setNetAmountInput(netVal);
    setTaxAmountInput(taxVal);
    const numNet = parseFloat(netVal) || 0;
    const numTax = parseFloat(taxVal) || 0;
    if (numNet > 0 || numTax > 0) {
      setAmountInput((numNet + numTax).toFixed(2));
    }
  };

  const handleTotalAmountChange = (totalVal: string) => {
    setAmountInput(totalVal);
    const numTotal = parseFloat(totalVal) || 0;
    const numTax = parseFloat(taxAmountInput) || 0;
    if (numTotal >= numTax) {
      setNetAmountInput((numTotal - numTax).toFixed(2));
    }
  };

  const computedWeekOfMonth = calculateWeekOfMonth(date);

  // Compute live totals preview
  const numTotal = parseFloat(amountInput) || 0;
  const numRate = parseFloat(exchangeRateInput) || DEFAULT_EXCHANGE_RATE;
  const computedUSD = currency === 'KHR' ? Number((numTotal / numRate).toFixed(2)) : numTotal;
  const computedKHR = currency === 'USD' ? Math.round(numTotal * numRate) : Math.round(numTotal);

  const handleSetFormFields = (fields: Partial<Omit<Transaction, 'id'>>) => {
    if (fields.type) setType(fields.type);
    if (fields.vendor) setVendor(fields.vendor);
    if (fields.currency) setCurrency(fields.currency);
    if (fields.amount) handleTotalAmountChange(fields.amount.toString());
    if (fields.netAmount) setNetAmountInput(fields.netAmount.toString());
    if (fields.taxAmount) setTaxAmountInput(fields.taxAmount.toString());
    if (fields.status) setStatus(fields.status);
    if (fields.payUnder) setPayUnder(fields.payUnder);
    if (fields.category) setCategory(fields.category);
    if (fields.date) setDate(fields.date);
    if (fields.description) setDescription(fields.description);
    if (fields.paymentMethod) setPaymentMethod(fields.paymentMethod);
    if (fields.imageAttachment) setImageAttachment(fields.imageAttachment);
    if (fields.additionalEvidence) setAdditionalEvidence(fields.additionalEvidence);
    if (fields.notes) setNotes(fields.notes);
    if (fields.tags) setTagsInput(fields.tags.join(', '));
    setEntryMode('manual');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedTotal = parseFloat(amountInput);
    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      setError('Please enter a valid Total Amount greater than 0.');
      return;
    }

    if (!category) {
      setError('Please select a category.');
      return;
    }

    if (!date) {
      setError('Please select a valid transaction date.');
      return;
    }

    const parsedTags = tagsInput
      .split(/[,\s]+/)
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
      .map(tag => tag.startsWith('#') ? tag : `#${tag}`);

    const parsedNet = parseFloat(netAmountInput) || (parsedTotal - (parseFloat(taxAmountInput) || 0));
    const parsedTax = parseFloat(taxAmountInput) || 0;
    const parsedRate = parseFloat(exchangeRateInput) || DEFAULT_EXCHANGE_RATE;

    const normalizedData = normalizeWorksheetTransaction({
      type,
      date,
      vendor: vendor.trim() || undefined,
      category,
      description: description.trim() || vendor.trim() || `${category} Transaction`,
      paymentMethod,
      currency,
      netAmount: Math.max(0, parsedNet),
      taxAmount: Math.max(0, parsedTax),
      amount: parsedTotal,
      status,
      payUnder: payUnder.trim() || 'Company Account',
      imageAttachment: imageAttachment || undefined,
      imageAttachmentName: imageAttachment ? (imageAttachmentName || 'Receipt') : undefined,
      additionalEvidence: additionalEvidence || undefined,
      additionalEvidenceName: additionalEvidence ? (additionalEvidenceName || 'Evidence') : undefined,
      weekOfMonth: computedWeekOfMonth,
      exchangeRate: parsedRate,
      isRecurring,
      recurringInterval: isRecurring ? recurringInterval : undefined,
      notes: notes.trim() || undefined,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
    });

    onSubmit(normalizedData);

    // Reset fields if adding new
    if (!initialTransaction) {
      setVendor('');
      setNetAmountInput('');
      setTaxAmountInput('0');
      setAmountInput('');
      setDescription('');
      setImageAttachment('');
      setImageAttachmentName('');
      setAdditionalEvidence('');
      setAdditionalEvidenceName('');
      setIsRecurring(false);
      setNotes('');
      setTagsInput('');
    }
  };

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col" id="transaction-form-card">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <CategoryIcon name="FileSpreadsheet" size={18} className="text-indigo-600 dark:text-indigo-400" />
          {initialTransaction ? 'Edit Worksheet Entry' : 'New Expense / Income Record'}
        </h2>
        <p className="text-xs text-slate-400">
          Adapted to your custom accounting worksheet (all 16 columns supported)
        </p>
      </div>

      {/* Type Toggle */}
      <div className="mb-4" id="segment-selector">
        <div className="flex bg-slate-50 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-150 dark:border-slate-800 relative">
          <button
            type="button"
            onClick={() => setType('expense')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
              type === 'expense'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <CategoryIcon name="ArrowDownRight" size={14} />
            Expense Record
          </button>
          <button
            type="button"
            onClick={() => setType('income')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
              type === 'income'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <CategoryIcon name="ArrowUpRight" size={14} />
            Income Record
          </button>
        </div>
      </div>

      {/* Entry Mode Tabs */}
      {!initialTransaction && (
        <div className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-150 dark:border-slate-800 mb-4" id="entry-tabs">
          <button
            type="button"
            onClick={() => setEntryMode('manual')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
              entryMode === 'manual'
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xs border border-slate-100 dark:border-slate-800'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Manual Form
          </button>
          <button
            type="button"
            onClick={() => setEntryMode('ai')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              entryMode === 'ai'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <CategoryIcon name="Sparkles" size={12} />
            Smart AI Scanner
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
            {/* 1. Date & Week of Month */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  1. Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  15. Week of Month
                </label>
                <div className="w-full rounded-xl border border-indigo-100 dark:border-indigo-950/60 bg-indigo-50/50 dark:bg-indigo-950/20 py-2 px-3 text-xs font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <CategoryIcon name="Calendar" size={13} />
                  {computedWeekOfMonth}
                </div>
              </div>
            </div>

            {/* 2. Vendor & Pay Under */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  2. Vendor / Supplier
                </label>
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="e.g. Starbucks, Amazon, ABA, Supermarket"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  13. Pay Under (Account / Project)
                </label>
                <input
                  type="text"
                  value={payUnder}
                  onChange={(e) => setPayUnder(e.target.value)}
                  placeholder="e.g. Company Account, Personal, Marketing"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* 3. Category & 5. Payment Method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  3. Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-indigo-500 outline-none"
                >
                  {Object.entries(categories).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                  5. Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:border-indigo-500 outline-none"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. Description */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                4. Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Client lunch meeting, Software renewal"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2 px-3 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:border-indigo-500 outline-none"
              />
            </div>

            {/* 6. Currency, 16. Exchange Rate */}
            <div className="p-3 bg-slate-50/70 dark:bg-slate-950/60 rounded-xl border border-slate-150 dark:border-slate-800/80 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                    6. Currency
                  </label>
                  <div className="flex bg-white dark:bg-slate-900 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCurrency('USD')}
                      className={`flex-1 py-1 text-xs font-bold rounded-md transition ${
                        currency === 'USD'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      }`}
                    >
                      USD ($)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency('KHR')}
                      className={`flex-1 py-1 text-xs font-bold rounded-md transition ${
                        currency === 'KHR'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      }`}
                    >
                      KHR (៛)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                    16. Exchange Rate (KHR/USD)
                  </label>
                  <input
                    type="number"
                    value={exchangeRateInput}
                    onChange={(e) => setExchangeRateInput(e.target.value)}
                    placeholder="4000"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1 px-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* 7. Net, 8. Tax, 9. Total */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                    7. Amount (Net)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={netAmountInput}
                    onChange={(e) => handleNetOrTaxChange(e.target.value, taxAmountInput)}
                    placeholder="Net"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 px-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                    8. Tax / VAT
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={taxAmountInput}
                    onChange={(e) => handleNetOrTaxChange(netAmountInput, e.target.value)}
                    placeholder="Tax"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-1.5 px-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:border-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 mb-1 uppercase tracking-wider">
                    9. Total *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amountInput}
                    onChange={(e) => handleTotalAmountChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-900 py-1.5 px-2 text-xs font-mono font-extrabold text-indigo-600 dark:text-indigo-400 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* 10. Total (USD) & 11. Total (KHR) Live Calculated Preview */}
              <div className="flex justify-between items-center bg-white/80 dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800 text-[11px] font-mono">
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-sans font-bold">10. Total (USD):</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-100">${computedUSD.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-sans font-bold">11. Total (KHR):</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{computedKHR.toLocaleString()} ៛</span>
                </div>
              </div>
            </div>

            {/* 12. Status */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">
                12. Status
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TRANSACTION_STATUSES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                      status === st
                        ? st === 'Paid'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : st === 'Pending'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : st === 'Cleared'
                          ? 'bg-teal-600 text-white border-teal-600'
                          : st === 'Reimbursed'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-rose-600 text-white border-rose-600'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* 14. Attachment Upload Zone */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">
                14. Attachment (Receipt / Proof)
              </label>
              {imageAttachment ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 truncate">
                    {isImageFile(imageAttachment, imageAttachmentName) ? (
                      <img
                        src={imageAttachment}
                        alt="Attachment"
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 object-cover rounded-lg border border-slate-200"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
                        <CategoryIcon name="FileText" size={16} />
                      </div>
                    )}
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                      {imageAttachmentName || 'Attached File'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setImageAttachment('');
                      setImageAttachmentName('');
                    }}
                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <CategoryIcon name="Trash2" size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 rounded-xl p-2.5 cursor-pointer bg-slate-50/50 dark:bg-slate-950/50 text-slate-500 hover:text-indigo-600 text-xs font-bold transition">
                  <CategoryIcon name="Paperclip" size={14} />
                  Upload Receipt, Image, or Document
                  <input
                    type="file"
                    accept={allowedExts.join(',')}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        validateAndReadFile(file, (dataUrl, name) => {
                          setImageAttachment(dataUrl);
                          setImageAttachmentName(name);
                        });
                      }
                    }}
                  />
                </label>
              )}
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold border border-red-100 dark:border-red-900 flex items-center gap-1.5">
                <CategoryIcon name="Info" size={14} />
                {error}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex gap-2">
            {initialTransaction && onCancelEdit && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="flex-1 py-2.5 px-4 text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 transition"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className={`flex-1 py-2.5 px-4 text-xs font-extrabold text-white rounded-xl shadow-xs transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                type === 'expense'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <CategoryIcon name={initialTransaction ? 'Check' : 'Plus'} size={14} />
              {initialTransaction ? 'Update Entry' : 'Save Record'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

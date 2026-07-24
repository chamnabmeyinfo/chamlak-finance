import React, { useState, useRef, useEffect } from 'react';
import { Transaction, TransactionType, INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { getStoredAIConfig, AI_PROVIDERS } from '../lib/aiProviderConfig';
import { getAuthHeader } from '../lib/firebase';
import { formatAmount } from '../utils/currency';

interface SmartAIScannerProps {
  onApplyTransaction: (tx: Omit<Transaction, 'id'>) => void;
  currentType: TransactionType;
  onSetFormFields: (fields: Partial<Omit<Transaction, 'id'>>) => void;
}

const ROTATING_MESSAGES = [
  'Deploying Gemini 3.5 Flash vision parser...',
  'Reading image coordinates and structures...',
  'Analyzing merchant detail & items lists...',
  'Determining transaction category and flows...',
  'Extracting total amount and taxes...',
  'Mapping standard payment methods...',
];

export const SmartAIScanner: React.FC<SmartAIScannerProps> = ({
  onApplyTransaction,
  currentType,
  onSetFormFields,
}) => {
  const [textPrompt, setTextPrompt] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const [evidenceName, setEvidenceName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<Omit<Transaction, 'id'> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const evidenceInputRef = useRef<HTMLInputElement>(null);

  // Rotating loading messages
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % ROTATING_MESSAGES.length);
      }, 2500);
    } else {
      setLoadingMsgIdx(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const processFile = (file: File, slot: 'primary' | 'secondary' = 'primary') => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('Image file is too large. Please select an image under 8MB.');
      return;
    }

    setError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      if (slot === 'primary') {
        setImageName(file.name);
        setImagePreview(reader.result as string);
      } else {
        setEvidenceName(file.name);
        setEvidencePreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Clipboard Paste Support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            // Create a clean user-friendly filename for pasted image
            const timeString = new Date().toLocaleTimeString().replace(/:/g, '-');
            const pastedFile = new File([file], `pasted_evidence_${timeString}.png`, { type: file.type });
            const slot = !imagePreview ? 'primary' : 'secondary';
            processFile(pastedFile, slot);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [imagePreview]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0], 'primary');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0], 'primary');
    }
  };

  const handleEvidenceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0], 'secondary');
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearEvidence = () => {
    setEvidencePreview(null);
    setEvidenceName(null);
    if (evidenceInputRef.current) {
      evidenceInputRef.current.value = '';
    }
  };

  const handleScan = async () => {
    if (!textPrompt.trim() && !imagePreview && !evidencePreview) {
      setError('Please provide a free-text sentence or upload an evidence photo first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setParsedResult(null);

    const aiConfig = getStoredAIConfig();

    try {
      const response = await fetch('/api/ai/parse-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({
          text: textPrompt.trim() || undefined,
          image: imagePreview || undefined,
          additionalEvidence: evidencePreview || undefined,
          currentDate: new Date().toISOString().split('T')[0],
          forcedType: currentType,
          aiConfig,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to scan transaction');
      }

      const data = await response.json();

      // Basic structure validation
      if (!data.amount || isNaN(Number(data.amount))) {
        throw new Error('AI could not confidently extract a valid transaction amount. Try a clearer text description or receipt upload.');
      }

      const rawAmount = Number(data.amount);
      const rawNet = data.netAmount ? Number(data.netAmount) : rawAmount;
      const rawTax = data.taxAmount ? Number(data.taxAmount) : 0;

      setParsedResult({
        type: data.type || 'expense',
        vendor: data.vendor || '',
        category: data.category || (data.type === 'income' ? 'Salary' : 'Food'),
        description: data.description || 'AI Extracted Entry',
        paymentMethod: data.paymentMethod || 'Card',
        currency: (data.currency === 'KHR' ? 'KHR' : 'USD'),
        netAmount: rawNet,
        taxAmount: rawTax,
        amount: rawAmount,
        date: data.date || new Date().toISOString().split('T')[0],
        status: (data.status || 'Paid'),
        payUnder: data.payUnder || 'Company Account',
        exchangeRate: 4000,
      });
    } catch (err: any) {
      setError(err.message || 'Something went wrong while contacting Gemini server. Check your API key.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyToForm = () => {
    if (parsedResult) {
      onSetFormFields({
        ...parsedResult,
        imageAttachment: imagePreview || undefined,
        additionalEvidence: evidencePreview || undefined,
      });
      // Trigger user feedback
      setParsedResult(null);
      setTextPrompt('');
      clearImage();
      clearEvidence();
    }
  };

  const handleInstantRecord = () => {
    if (parsedResult) {
      onApplyTransaction({
        ...parsedResult,
        imageAttachment: imagePreview || undefined,
        additionalEvidence: evidencePreview || undefined,
      });
      setParsedResult(null);
      setTextPrompt('');
      clearImage();
      clearEvidence();
    }
  };

  // Pre-configured suggestions to help users discover features
  const EXPENSE_SUGGESTIONS = [
    'Bought groceries at Target for $64.20 using Card yesterday',
    'Monthly subscription cost $14.99 for Netflix on Card last Friday',
    'Paid $45.00 for fuel at Shell station with Cash',
  ];

  const INCOME_SUGGESTIONS = [
    'Received $120.00 freelance writing payment via PayPal today',
    'Monthly salary paycheck of $3,500.00 deposited directly',
    'Sold an old bicycle on Marketplace for $80 cash',
  ];

  const SUGGESTIONS = currentType === 'income' ? INCOME_SUGGESTIONS : EXPENSE_SUGGESTIONS;

  const getCategoryName = (type: TransactionType, key: string) => {
    const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    return list[key]?.name || key;
  };

  const currentAiConfig = getStoredAIConfig();
  const currentProviderDetails = AI_PROVIDERS[currentAiConfig.provider] || AI_PROVIDERS.gemini;

  return (
    <div className="space-y-4">
      {/* Active AI Provider Status Indicator */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs text-slate-600 dark:text-slate-300">
        <span className="font-medium">AI Parsing Engine:</span>
        <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md text-[11px] border ${currentProviderDetails.badgeColor}`}>
          ⚡ {currentProviderDetails.name} ({currentAiConfig.model})
        </span>
      </div>

      {/* Input Stage */}
      {!parsedResult && (
        <div className="space-y-4">
          {/* Dual File Upload Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Slot 1: Primary Receipt */}
            <div
              onDragOver={handleDragOver}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  processFile(e.dataTransfer.files[0], 'primary');
                }
              }}
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                imagePreview
                  ? 'border-indigo-200 bg-indigo-50/10'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              {imagePreview ? (
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Receipt Photo
                  </span>
                  <div className="relative inline-block mt-1">
                    <img
                      src={imagePreview}
                      alt="Receipt preview"
                      referrerPolicy="no-referrer"
                      className="max-h-20 mx-auto rounded-lg border border-slate-100 shadow-3xs object-cover"
                    />
                    <button
                      onClick={clearImage}
                      type="button"
                      className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] hover:bg-rose-600 shadow-md transition"
                      title="Remove Receipt"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium truncate max-w-[150px] mx-auto">
                    {imageName}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="mx-auto w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-3xs">
                    <CategoryIcon name="Camera" size={14} className="text-indigo-500" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 block">
                      Receipt Photo
                    </span>
                    <span className="text-[9px] text-slate-400">Drag/paste or Click</span>
                  </div>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>

            {/* Slot 2: Secondary Evidence */}
            <div
              onDragOver={handleDragOver}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  processFile(e.dataTransfer.files[0], 'secondary');
                }
              }}
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                evidencePreview
                  ? 'border-teal-200 bg-teal-50/10'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              {evidencePreview ? (
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Secondary Evidence
                  </span>
                  <div className="relative inline-block mt-1">
                    <img
                      src={evidencePreview}
                      alt="Evidence preview"
                      referrerPolicy="no-referrer"
                      className="max-h-20 mx-auto rounded-lg border border-slate-100 shadow-3xs object-cover"
                    />
                    <button
                      onClick={clearEvidence}
                      type="button"
                      className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] hover:bg-rose-600 shadow-md transition"
                      title="Remove Evidence"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium truncate max-w-[150px] mx-auto">
                    {evidenceName}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 cursor-pointer" onClick={() => evidenceInputRef.current?.click()}>
                  <div className="mx-auto w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-3xs">
                    <CategoryIcon name="Image" size={14} className="text-teal-500" />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 block">
                      Evidence / Product
                    </span>
                    <span className="text-[9px] text-slate-400">Drag/paste or Click</span>
                  </div>
                </div>
              )}
              <input
                type="file"
                ref={evidenceInputRef}
                onChange={handleEvidenceFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>

          {/* Text input area */}
          <div>
            <label htmlFor="ai-text" className="block text-xs font-medium text-slate-500 mb-1">
              Natural Language description ({currentType === 'income' ? 'Income' : 'Expense'})
            </label>
            <textarea
              id="ai-text"
              rows={3}
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              placeholder={
                currentType === 'income'
                  ? 'e.g. Received $1500 freelance design cash payment last Tuesday...'
                  : 'e.g. Spent $32.50 on lunch with friends at Chipotle using Card yesterday...'
              }
              className="block w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 outline-none transition resize-none"
            />
          </div>

          {/* Prompt Suggestions */}
          {!textPrompt && !imagePreview && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                Quick {currentType === 'income' ? 'Income' : 'Expense'} Prompts
              </span>
              <div className="space-y-1">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTextPrompt(s)}
                    className="w-full text-left p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-lg text-[10px] text-slate-500 hover:text-slate-700 truncate block transition"
                  >
                    "{s}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-xs font-medium border border-rose-100 flex items-start gap-1.5">
              <CategoryIcon name="AlertCircle" size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Scan trigger button */}
          <button
            type="button"
            disabled={isLoading || (!textPrompt.trim() && !imagePreview)}
            onClick={handleScan}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white shadow-xs transition duration-200 flex items-center justify-center gap-1.5 ${
              isLoading || (!textPrompt.trim() && !imagePreview)
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer active:bg-indigo-800'
            }`}
            id="btn-ai-scan"
          >
            {isLoading ? (
              <>
                <CategoryIcon name="Loader2" size={14} className="animate-spin" />
                Processing Smart AI...
              </>
            ) : (
              <>
                <CategoryIcon name="Sparkles" size={14} />
                Extract Details with AI
              </>
            )}
          </button>

          {/* AI Rotating Loading state messages */}
          {isLoading && (
            <div className="text-center py-2 animate-pulse space-y-1">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Gemini Engine Running</p>
              <p className="text-xs text-indigo-500 font-medium transition-all duration-300">
                {ROTATING_MESSAGES[loadingMsgIdx]}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Results stage */}
      {parsedResult && (
        <div className="bg-indigo-50/30 border border-indigo-100 rounded-xl p-4 space-y-4 animate-fade-in" id="ai-parsed-results">
          <div className="flex items-center justify-between border-b border-indigo-100/50 pb-2.5">
            <div className="flex items-center gap-1.5">
              <CategoryIcon name="Sparkles" className="text-indigo-500" size={14} />
              <span className="text-xs font-bold text-slate-800">Parsed Details</span>
            </div>
            <button
              onClick={() => setParsedResult(null)}
              className="text-slate-400 hover:text-slate-600 text-xs font-medium cursor-pointer"
            >
              Reset
            </button>
          </div>

          {/* Dynamic list matching the record details */}
          <div className="grid grid-cols-2 gap-3.5 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block tracking-wider">Type</span>
              <span className={`font-bold capitalize flex items-center gap-1 mt-0.5 ${
                parsedResult.type === 'income' ? 'text-emerald-600' : 'text-slate-700'
              }`}>
                <CategoryIcon name={parsedResult.type === 'income' ? 'ArrowUpRight' : 'ArrowDownRight'} size={12} />
                {parsedResult.type}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block tracking-wider">Amount</span>
              <span className="font-bold font-mono text-slate-800 mt-0.5 block">
                {formatAmount(parsedResult.amount, parsedResult.currency || 'USD')}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block tracking-wider">Category</span>
              <span className="font-semibold text-slate-700 mt-0.5 block truncate">
                {getCategoryName(parsedResult.type, parsedResult.category)}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block tracking-wider">Date</span>
              <span className="font-medium text-slate-600 mt-0.5 block font-mono">
                {parsedResult.date}
              </span>
            </div>

            <div className="col-span-2">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block tracking-wider">Description</span>
              <span className="font-medium text-slate-700 mt-0.5 block italic truncate">
                "{parsedResult.description}"
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase block tracking-wider">Payment Method</span>
              <span className="font-semibold text-slate-600 mt-0.5 block font-mono">
                {parsedResult.paymentMethod}
              </span>
            </div>
          </div>

          {/* Custom Action Choices */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-100/50">
            <button
              onClick={handleApplyToForm}
              className="py-2 px-3 bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 hover:border-indigo-300 font-semibold text-xs rounded-xl cursor-pointer transition text-center"
              title="Apply these details to the form for manual edits"
            >
              Apply to Form
            </button>
            <button
              onClick={handleInstantRecord}
              className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer transition text-center"
              title="Add immediately to the transaction ledger"
            >
              Confirm & Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { Transaction, TransactionType, INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../types';
import { CategoryIcon } from './CategoryIcon';

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
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<Omit<Transaction, 'id'> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setError('Image file is too large. Please select an image under 8MB.');
      return;
    }

    setError(null);
    setImageName(file.name);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleScan = async () => {
    if (!textPrompt.trim() && !imagePreview) {
      setError('Please provide a free-text sentence or upload a receipt image first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setParsedResult(null);

    try {
      const response = await fetch('/api/ai/parse-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textPrompt.trim() || undefined,
          image: imagePreview || undefined,
          currentDate: new Date().toISOString().split('T')[0],
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

      setParsedResult({
        type: data.type || 'expense',
        amount: Number(data.amount),
        category: data.category || (data.type === 'income' ? 'Salary' : 'Food'),
        date: data.date || new Date().toISOString().split('T')[0],
        description: data.description || 'AI Extracted Entry',
        paymentMethod: data.paymentMethod || 'Card',
      });
    } catch (err: any) {
      setError(err.message || 'Something went wrong while contacting Gemini server. Check your API key.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyToForm = () => {
    if (parsedResult) {
      onSetFormFields(parsedResult);
      // Trigger user feedback
      setParsedResult(null);
      setTextPrompt('');
      clearImage();
    }
  };

  const handleInstantRecord = () => {
    if (parsedResult) {
      onApplyTransaction(parsedResult);
      setParsedResult(null);
      setTextPrompt('');
      clearImage();
    }
  };

  // Pre-configured suggestions to help users discover features
  const SUGGESTIONS = [
    'Bought groceries at Target for $64.20 using Card yesterday',
    'Received $120.00 freelance writing payment via PayPal today',
    'Monthly subscription cost $14.99 for netflix on Card last Friday',
  ];

  const getCategoryName = (type: TransactionType, key: string) => {
    const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    return list[key]?.name || key;
  };

  return (
    <div className="space-y-4">
      {/* Input Stage */}
      {!parsedResult && (
        <div className="space-y-4">
          {/* File Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-5 text-center transition-all ${
              imagePreview
                ? 'border-emerald-200 bg-emerald-50/20'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            {imagePreview ? (
              <div className="space-y-3">
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Receipt preview"
                    className="max-h-24 mx-auto rounded-lg border border-slate-100 shadow-2xs object-cover"
                  />
                  <button
                    onClick={clearImage}
                    type="button"
                    className="absolute -top-2 -right-2 w-5 h-5 bg-slate-900 text-white rounded-full flex items-center justify-center text-[10px] hover:bg-slate-800 shadow transition"
                    title="Remove Image"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-xs text-slate-500 font-medium truncate max-w-xs mx-auto">
                  {imageName}
                </div>
              </div>
            ) : (
              <div className="space-y-2 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="mx-auto w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 shadow-2xs">
                  <CategoryIcon name="Camera" size={18} className="text-indigo-500" />
                </div>
                <div>
                  <span className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                    Upload receipt photo
                  </span>
                  <span className="text-xs text-slate-400"> or drag and drop</span>
                </div>
                <p className="text-[10px] text-slate-400">PNG, JPG or WEBP up to 8MB</p>
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

          {/* Text input area */}
          <div>
            <label htmlFor="ai-text" className="block text-xs font-medium text-slate-500 mb-1">
              Natural Language description
            </label>
            <textarea
              id="ai-text"
              rows={3}
              value={textPrompt}
              onChange={(e) => setTextPrompt(e.target.value)}
              placeholder="e.g. Received $1500 freelance design cash payment last Tuesday..."
              className="block w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400 outline-none transition resize-none"
            />
          </div>

          {/* Prompt Suggestions */}
          {!textPrompt && !imagePreview && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                Quick Prompts
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
                ${parsedResult.amount.toFixed(2)}
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

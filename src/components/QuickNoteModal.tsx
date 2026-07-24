import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CategoryIcon } from './CategoryIcon';
import { CurrencyCode, formatAmount } from '../utils/currency';
import { Transaction } from '../types';

interface QuickNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: CurrencyCode;
  onSave: (tx: Omit<Transaction, 'id'>) => Promise<void>;
  triggerToast: (msg: string) => void;
}

export const QuickNoteModal: React.FC<QuickNoteModalProps> = ({
  isOpen,
  onClose,
  currency,
  onSave,
  triggerToast,
}) => {
  const [noteText, setNoteText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedTx, setParsedTx] = useState<Omit<Transaction, 'id'> | null>(null);

  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setError(null);
      };

      rec.onerror = (e: any) => {
        console.error('Speech recognition error:', e);
        if (e.error === 'not-allowed') {
          setError('Microphone access denied. Please type your note instead.');
        } else {
          setError(`Speech capture error: ${e.error}. Try typing.`);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript) {
          setNoteText((prev) => (prev + ' ' + finalTranscript).trim());
        }
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (err) {
          // ignore
        }
      }
    };
  }, []);

  // Clear state when closed or opened
  useEffect(() => {
    if (isOpen) {
      setNoteText('');
      setParsedTx(null);
      setError(null);
      setIsListening(false);
    } else {
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  }, [isOpen]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setError('Voice recognition is not fully supported in this browser. Please type your note.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error(e);
        setError('Could not start voice capture. Please type instead.');
      }
    }
  };

  const handleParse = async () => {
    if (!noteText.trim()) {
      setError('Please type or record a quick note first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setParsedTx(null);

    try {
      const response = await fetch('/api/ai/parse-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: noteText.trim(),
          currentDate: new Date().toISOString().split('T')[0],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze note.');
      }

      const data = await response.json();

      if (!data.amount || isNaN(Number(data.amount))) {
        throw new Error('Confidential error: Gemini AI could not extract a valid amount from your note. Please be more specific.');
      }

      setParsedTx({
        type: data.type || 'expense',
        amount: Number(data.amount),
        category: data.category || (data.type === 'income' ? 'Salary' : 'Food'),
        date: data.date || new Date().toISOString().split('T')[0],
        description: data.description || 'Quick Note Record',
        paymentMethod: data.paymentMethod || 'Cash',
      });
    } catch (err: any) {
      setError(err.message || 'Something went wrong while communicating with Gemini API.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!parsedTx) return;
    setIsLoading(true);
    try {
      await onSave(parsedTx);
      onClose();
    } catch (err) {
      setError('Failed to record transaction. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const SUGGESTIONS = [
    'Coffee at Starbucks for $4.80 this morning',
    'Received direct deposit salary of $3200 yesterday',
    'Taxi ride to office cost $18.50 paid with card',
    'Sold my old desk for $60 cash on Sunday',
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs">
          {/* Backdrop click closer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ y: '100%', opacity: 0.9 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xl rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden max-h-[90vh] z-10"
            id="quick-note-modal"
          >
            {/* Grab handle for touch layout */}
            <div className="w-12 h-1 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto my-3 sm:hidden" />

            {/* Header */}
            <div className="px-6 pb-4 pt-2 sm:pt-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight font-display flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    <CategoryIcon name="Sparkles" size={14} className="animate-pulse" />
                  </span>
                  AI Quick Note Recorder
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                  Hold to dictate or type details to extract entries instantly
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <CategoryIcon name="X" size={16} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Voice dictation interface */}
              <div className="flex flex-col items-center justify-center py-2">
                <div className="relative flex items-center justify-center">
                  <AnimatePresence>
                    {isListening && (
                      <>
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0.5 }}
                          animate={{ scale: 1.8, opacity: 0 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeOut' }}
                          className="absolute w-16 h-16 rounded-full bg-indigo-400/30 dark:bg-indigo-500/20"
                        />
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0.6 }}
                          animate={{ scale: 1.4, opacity: 0 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeOut', delay: 0.6 }}
                          className="absolute w-16 h-16 rounded-full bg-indigo-400/20 dark:bg-indigo-500/10"
                        />
                      </>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={toggleListening}
                    className={`relative w-16 h-16 rounded-full flex items-center justify-center border transition-all duration-300 shadow-md outline-none cursor-pointer ${
                      isListening
                        ? 'bg-rose-500 border-rose-400 text-white shadow-rose-200 dark:shadow-none'
                        : 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500 text-white shadow-indigo-100 dark:shadow-none'
                    }`}
                  >
                    <CategoryIcon name={isListening ? 'MicOff' : 'Mic'} size={24} />
                  </button>
                </div>

                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-3">
                  {isListening ? 'Dictating... Speak clearly' : 'Tap to Record Voice Note'}
                </span>
              </div>

              {/* Text Field block */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Quick Note Content
                </label>
                <div className="relative">
                  <textarea
                    rows={3}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="e.g. Spent $15.50 on lunch at Chipotle today with Card..."
                    className="w-full text-xs font-semibold p-3.5 rounded-2xl bg-slate-50/50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                  />
                  {noteText && (
                    <button
                      onClick={() => setNoteText('')}
                      className="absolute bottom-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                    >
                      <CategoryIcon name="Trash2" size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Suggestions */}
              {!noteText && (
                <div className="space-y-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Try a pattern suggestion
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s, idx) => (
                      <button
                        key={idx}
                        onClick={() => setNoteText(s)}
                        className="text-[10px] font-bold text-left px-2.5 py-1.5 rounded-xl border border-slate-100 dark:border-slate-850 hover:bg-slate-50/60 dark:hover:bg-slate-850/60 text-slate-500 dark:text-slate-400 transition-all cursor-pointer"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors container */}
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100/40 dark:border-rose-900/30 rounded-2xl flex items-start gap-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  <CategoryIcon name="AlertTriangle" size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Parsed Result Preview */}
              {parsedTx && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-emerald-50/50 dark:bg-emerald-950/15 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/30 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-emerald-100/30 dark:border-emerald-900/20 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      AI Extracted Receipt
                    </span>
                    <span className="text-[9px] font-mono font-extrabold px-1.5 py-0.5 bg-emerald-100/50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-md">
                      CONFIDENT
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                        Amount ({currency})
                      </span>
                      <span className="text-xs font-extrabold font-mono text-slate-700 dark:text-slate-200">
                        {parsedTx.type === 'expense' ? '-' : '+'}{formatAmount(parsedTx.amount, currency)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                        Type
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-block ${
                        parsedTx.type === 'income'
                          ? 'bg-emerald-100/60 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                          : 'bg-indigo-100/60 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                      }`}>
                        {parsedTx.type === 'income' ? 'Income' : 'Expense'}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                        Description / Merchant
                      </span>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 block truncate">
                        {parsedTx.description}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                        Category
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <CategoryIcon name="Tag" size={11} className="text-slate-400" />
                        {parsedTx.category}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                        Payment via
                      </span>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                        <CategoryIcon name="CreditCard" size={11} className="text-slate-400" />
                        {parsedTx.paymentMethod || 'Cash'}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Bottom Actions Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex gap-3 shrink-0">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 py-3 text-xs font-bold rounded-2xl border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              {parsedTx ? (
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="flex-1 py-3 text-xs font-extrabold rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-100 dark:shadow-none flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <CategoryIcon name="Loader2" size={13} className="animate-spin" />
                  ) : (
                    <CategoryIcon name="Check" size={13} />
                  )}
                  Record Entry
                </button>
              ) : (
                <button
                  onClick={handleParse}
                  disabled={isLoading || !noteText.trim()}
                  className="flex-1 py-3 text-xs font-extrabold rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <CategoryIcon name="Loader2" size={13} className="animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <CategoryIcon name="Sparkles" size={13} />
                      AI Analysis
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

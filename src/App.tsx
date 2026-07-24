import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'motion/react';
import { Transaction, Budget, AppSettings } from './types';
import { StatsGrid } from './components/StatsGrid';
import { TransactionForm } from './components/TransactionForm';
import { TransactionList } from './components/TransactionList';
import { VisualCharts } from './components/VisualCharts';
import { BudgetOverview } from './components/BudgetOverview';
import { DashboardInsights } from './components/DashboardInsights';
import { QuickAddWidget } from './components/QuickAddWidget';
import { SpendingTrends } from './components/SpendingTrends';
import { SearchModal } from './components/SearchModal';
import { QuickNoteModal } from './components/QuickNoteModal';
import { SettingsView } from './components/SettingsView';
import { MonthlyFinancialReport } from './components/MonthlyFinancialReport';
import { CategoryIcon } from './components/CategoryIcon';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from './lib/firebase';
import { onAuthStateChanged, User, GoogleAuthProvider } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { saveTransaction, saveTransactionsBatch, deleteTransaction, saveBudget, seedUserData, clearUserTransactions, nukeUserData, saveUserSettingsToFirestore } from './lib/db';
import { LoginView } from './components/LoginView';
import { CurrencyCode, formatAmountNoCents } from './utils/currency';
import { getCachedAccessToken, setCachedAccessToken, exportToSpreadsheet } from './lib/googleSheetsService';
import { getTelegramConfig, saveTelegramConfig, sendTelegramMessage, formatNewTransactionMessage } from './lib/telegramService';
import { getStoredAIConfig, saveStoredAIConfig } from './lib/aiProviderConfig';
import { exportWorksheetCSV } from './utils/worksheetUtils';
import { INITIAL_EXPENSES_DATASET } from './data/expensesDataset';

// Realistic sample transactions from Expenses Spreadsheet
const SAMPLE_TRANSACTIONS: Transaction[] = INITIAL_EXPENSES_DATASET;

const DEFAULT_BUDGETS: Budget[] = [
  { category: 'Food', limit: 450.0 },
  { category: 'Shopping', limit: 300.0 },
  { category: 'Housing', limit: 1400.0 },
  { category: 'Transport', limit: 150.0 },
  { category: 'Utilities', limit: 180.0 },
  { category: 'Entertainment', limit: 100.0 },
  { category: 'Healthcare', limit: 150.0 },
  { category: 'Other_Expense', limit: 100.0 },
];

const DEFAULT_ALLOWED_TYPES = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx'];

const DEFAULT_SETTINGS: AppSettings = {
  companyName: 'CHAMLAK MEDIA',
  tagline: 'Finance Hub',
  supportEmail: 'chamnabmey.info@gmail.com',
  logoUrl: '',
  allowedFileTypes: DEFAULT_ALLOWED_TYPES,
};

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [googleToken, setGoogleToken] = useState<string | null>(() => getCachedAccessToken());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const syncOfflineTransactionsToServer = async (txs: Transaction[]) => {
    try {
      await fetch('/api/db/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txs),
      });
    } catch (err) {
      console.warn('Failed to sync guest transactions to server:', err);
    }
  };

  const syncOfflineBudgetsToServer = async (bgts: Budget[]) => {
    try {
      await fetch('/api/db/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bgts),
      });
    } catch (err) {
      console.warn('Failed to sync guest budgets to server:', err);
    }
  };
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [formEntryMode, setFormEntryMode] = useState<'manual' | 'ai'>('manual');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('finance_tracker_theme') as 'light' | 'dark') || 'light');
  const [currency, setCurrency] = useState<CurrencyCode>(() => (localStorage.getItem('finance_tracker_currency') as CurrencyCode) || 'USD');
  const [dashboardCurrencyFilter, setDashboardCurrencyFilter] = useState<'usd-only' | 'khr-only' | 'consolidated'>(() => (localStorage.getItem('finance_tracker_dashboard_currency_filter') as 'usd-only' | 'khr-only' | 'consolidated') || 'consolidated');

  // Sync dashboard currency filter local persistence
  useEffect(() => {
    localStorage.setItem('finance_tracker_dashboard_currency_filter', dashboardCurrencyFilter);
  }, [dashboardCurrencyFilter]);

  const dashboardData = useMemo(() => {
    let filteredTransactions = transactions;
    let targetCurrency = currency; // Default to global selected currency

    if (dashboardCurrencyFilter === 'usd-only') {
      filteredTransactions = transactions.filter(t => t.currency === 'USD');
      targetCurrency = 'USD';
    } else if (dashboardCurrencyFilter === 'khr-only') {
      filteredTransactions = transactions.filter(t => t.currency === 'KHR');
      targetCurrency = 'KHR';
    }

    return {
      transactions: filteredTransactions,
      currency: targetCurrency,
    };
  }, [transactions, currency, dashboardCurrencyFilter]);
  const lastAutoSyncHashRef = useRef<string>('');
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('finance_tracker_settings');
    const defaultTypes = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx'];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          allowedFileTypes: parsed.allowedFileTypes && parsed.allowedFileTypes.length > 0 ? parsed.allowedFileTypes : defaultTypes,
        };
      } catch (e) {
        console.error(e);
      }
    }
    return {
      companyName: 'CHAMLAK MEDIA',
      tagline: 'Finance Hub',
      supportEmail: 'chamnabmey.info@gmail.com',
      logoUrl: '',
      allowedFileTypes: defaultTypes,
    };
  });

  // Sync theme class & local persistence
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('finance_tracker_theme', theme);
  }, [theme]);

  // Sync currency local persistence
  useEffect(() => {
    localStorage.setItem('finance_tracker_currency', currency);
  }, [currency]);

  // Sync app settings local persistence & single debounced Cloud sync
  useEffect(() => {
    localStorage.setItem('finance_tracker_settings', JSON.stringify(settings));
  }, [settings]);

  // Debounced cloud settings backup effect
  useEffect(() => {
    if (!user || user.uid === 'offline-user') return;
    const timer = setTimeout(() => {
      saveUserSettingsToFirestore(user.uid, {
        theme,
        currency,
        appSettings: settings,
        aiConfig: getStoredAIConfig(),
        telegramConfig: getTelegramConfig(),
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [theme, currency, settings, user]);

  // Global key shortcut Ctrl/Cmd + K for search modal
  useEffect(() => {
    const handleGlobalShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, []);

  // Mobile scan button long-press handlers for Quick Note trigger
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActiveRef = useRef(false);
  const lastTouchTimeRef = useRef<number>(0);

  const startLongPress = (e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    if (e.type === 'mousedown' && now - lastTouchTimeRef.current < 450) {
      return;
    }
    if (e.type === 'touchstart') {
      lastTouchTimeRef.current = now;
    }

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    isLongPressActiveRef.current = false;
    setIsHolding(true);
    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      setIsQuickNoteOpen(true);
      setIsHolding(false);
      if (navigator.vibrate) {
        try {
          navigator.vibrate(80);
        } catch (err) {
          // ignore potential iframe restrictions
        }
      }
    }, 600); // Trigger after 600ms hold
  };

  const endLongPress = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.type === 'mouseup' && Date.now() - lastTouchTimeRef.current < 450) {
      return;
    }
    setIsHolding(false);
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleFabClick = () => {
    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false;
      return;
    }
    setEditingTransaction(null);
    setActiveTab('record');
    setFormEntryMode('ai');
  };

  // Automatic processing of recurring transactions
  const processRecurringTransactions = (currentTxs: Transaction[]): { updatedTxs: Transaction[]; count: number } => {
    let listChanged = false;
    let count = 0;
    const txMap = currentTxs.map(t => ({ ...t }));
    const newTxs: Transaction[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    txMap.forEach((tx) => {
      if (!tx.isRecurring || !tx.recurringInterval) return;

      let referenceDateStr = tx.lastGeneratedDate || tx.date;
      let referenceDate = new Date(referenceDateStr);
      let tempLastGeneratedDate = tx.lastGeneratedDate || '';

      while (true) {
        let nextDate = new Date(referenceDate);
        if (tx.recurringInterval === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else if (tx.recurringInterval === 'monthly') {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }

        const nextDateStr = nextDate.toISOString().split('T')[0];
        if (nextDateStr > todayStr) {
          break;
        }

        const generatedTx: Transaction = {
          id: `tx-auto-${tx.id}-${nextDateStr}`,
          type: tx.type,
          amount: tx.amount,
          category: tx.category,
          date: nextDateStr,
          description: `${tx.description} (Recurring)`,
          paymentMethod: tx.paymentMethod,
          imageAttachment: tx.imageAttachment,
          additionalEvidence: tx.additionalEvidence,
        };

        const exists = currentTxs.some(t => t.id === generatedTx.id) || newTxs.some(t => t.id === generatedTx.id);
        if (!exists) {
          newTxs.push(generatedTx);
          count++;
        }

        tempLastGeneratedDate = nextDateStr;
        referenceDate = nextDate;
        listChanged = true;
      }

      if (tempLastGeneratedDate !== tx.lastGeneratedDate) {
        tx.lastGeneratedDate = tempLastGeneratedDate;
        listChanged = true;
      }
    });

    if (listChanged) {
      return {
        updatedTxs: [...newTxs, ...txMap],
        count,
      };
    }

    return { updatedTxs: currentTxs, count: 0 };
  };

  const triggerToast = (message: string) => {
    setShowNotification(message);
    setTimeout(() => {
      setShowNotification(null);
    }, 3000);
  };

  // Auth state listener
  useEffect(() => {
    let fallbackTimer: NodeJS.Timeout;

    const handleFallback = () => {
      setUser((prev) => {
        if (prev !== undefined) return prev;
        const isGuest = localStorage.getItem('finance_tracker_is_guest') === 'true';
        if (isGuest) {
          return {
            uid: 'offline-user',
            displayName: 'Guest User',
            email: 'guest@chamlackmedia.com',
          } as any;
        }
        return null;
      });
    };

    let unsubscribeAuth = () => {};
    try {
      unsubscribeAuth = onAuthStateChanged(
        auth,
        (currentUser) => {
          if (currentUser) {
            localStorage.removeItem('finance_tracker_is_guest');
            setUser(currentUser);
          } else {
            const isGuest = localStorage.getItem('finance_tracker_is_guest') === 'true';
            if (isGuest) {
              setUser({
                uid: 'offline-user',
                displayName: 'Guest User',
                email: 'guest@chamlackmedia.com',
              } as any);
            } else {
              setUser(null);
            }
          }
        },
        (error) => {
          console.warn('Auth state change error:', error);
          handleFallback();
        }
      );
    } catch (err) {
      console.warn('Firebase Auth failed to attach listener:', err);
      handleFallback();
    }

    // Fallback if auth check is delayed in sandboxed frame
    fallbackTimer = setTimeout(() => {
      handleFallback();
    }, 1800);

    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      clearTimeout(fallbackTimer);
    };
  }, []);

  // Sync with Firestore in real-time or LocalStorage in guest mode
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setBudgets([]);
      return;
    }

    if (user.uid === 'offline-user') {
      // Offline Guest Mode with persistent server-side JSON storage sync
      const initOfflineMode = async () => {
        let localTxs: Transaction[] = [];
        let localBudgets: Budget[] = [];
        let hasServerData = false;

        // 1. Try fetching from server-side JSON database first (survives client-side clear/reload)
        try {
          const [txsResp, budgetsResp] = await Promise.all([
            fetch("/api/db/transactions"),
            fetch("/api/db/budgets")
          ]);
          
          if (txsResp.ok) {
            const serverTxs = await txsResp.json();
            if (Array.isArray(serverTxs) && serverTxs.length > 0) {
              localTxs = serverTxs;
              localStorage.setItem('finance_tracker_offline_txs', JSON.stringify(serverTxs));
              localStorage.setItem('finance_tracker_offline_initialized', 'true');
              hasServerData = true;
            }
          }
          
          if (budgetsResp.ok) {
            const serverBudgets = await budgetsResp.json();
            if (Array.isArray(serverBudgets) && serverBudgets.length > 0) {
              localBudgets = serverBudgets;
              localStorage.setItem('finance_tracker_offline_budgets', JSON.stringify(serverBudgets));
            }
          }
        } catch (err) {
          console.warn("Failed to load transactions/budgets backup from server:", err);
        }

        // 2. Fallback to LocalStorage if server didn't have data
        if (!hasServerData) {
          const offlineInitialized = localStorage.getItem('finance_tracker_offline_initialized');
          const offlineRaw = localStorage.getItem('finance_tracker_offline_txs');
          
          if (!offlineInitialized && offlineRaw === null) {
            localTxs = SAMPLE_TRANSACTIONS;
            localStorage.setItem('finance_tracker_offline_txs', JSON.stringify(SAMPLE_TRANSACTIONS));
            localStorage.setItem('finance_tracker_offline_initialized', 'true');
            // Save to server-side backup
            await syncOfflineTransactionsToServer(SAMPLE_TRANSACTIONS);
          } else {
            try {
              localTxs = offlineRaw ? JSON.parse(offlineRaw) : [];
              if (!Array.isArray(localTxs)) localTxs = [];
            } catch (e) {
              localTxs = [];
            }
          }
        }

        if (localBudgets.length === 0) {
          const localBudgetsRaw = localStorage.getItem('finance_tracker_offline_budgets');
          const offlineInitialized = localStorage.getItem('finance_tracker_offline_initialized');
          if (!offlineInitialized && localBudgetsRaw === null) {
            localBudgets = DEFAULT_BUDGETS;
            localStorage.setItem('finance_tracker_offline_budgets', JSON.stringify(DEFAULT_BUDGETS));
            await syncOfflineBudgetsToServer(DEFAULT_BUDGETS);
          } else {
            try {
              localBudgets = localBudgetsRaw ? JSON.parse(localBudgetsRaw) : [];
            } catch (e) {
              localBudgets = [];
            }
          }
        }

        const { updatedTxs, count } = processRecurringTransactions(localTxs);
        if (count > 0) {
          localStorage.setItem('finance_tracker_offline_txs', JSON.stringify(updatedTxs));
          await syncOfflineTransactionsToServer(updatedTxs);
          triggerToast(`Auto-generated ${count} recurring transaction(s) due.`);
        }
        setTransactions(updatedTxs);
        setBudgets(localBudgets);
      };

      initOfflineMode();
      return;
    }

    // Restore cached cloud transactions for instant rendering on reload
    const cachedTxsKey = `finance_tracker_cloud_txs_${user.uid}`;
    const cachedBudgetsKey = `finance_tracker_cloud_budgets_${user.uid}`;

    let initialCloudTxs: Transaction[] = [];
    const cachedTxs = localStorage.getItem(cachedTxsKey);
    if (cachedTxs) {
      try {
        const parsed = JSON.parse(cachedTxs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialCloudTxs = parsed;
          setTransactions(parsed);
        }
      } catch (e) {
        console.error('Failed to read cached txs:', e);
      }
    }

    const cachedBudgets = localStorage.getItem(cachedBudgetsKey);
    if (cachedBudgets) {
      try {
        const parsedB = JSON.parse(cachedBudgets);
        if (Array.isArray(parsedB) && parsedB.length > 0) {
          setBudgets(parsedB);
        }
      } catch (e) {
        console.error('Failed to read cached budgets:', e);
      }
    }

    // Subscribe to transactions collection in Cloud mode without restrictive order index
    const unsubscribeTxs = onSnapshot(collection(db, 'users', user.uid, 'transactions'), async (snapshot) => {
      const txs: Transaction[] = [];
      snapshot.forEach((doc) => {
        txs.push(doc.data() as Transaction);
      });

      // Handle empty cloud database
      if (snapshot.empty) {
        // Auto-seed SAMPLE_TRANSACTIONS (Excel dataset) for user if Firestore is empty
        try {
          await seedUserData(user.uid, SAMPLE_TRANSACTIONS, DEFAULT_BUDGETS);
          setTransactions(SAMPLE_TRANSACTIONS);
          localStorage.setItem(cachedTxsKey, JSON.stringify(SAMPLE_TRANSACTIONS));
        } catch (err) {
          console.error("Auto-seeding user data into Firestore failed:", err);
          setTransactions(SAMPLE_TRANSACTIONS);
          localStorage.setItem(cachedTxsKey, JSON.stringify(SAMPLE_TRANSACTIONS));
        }
        return;
      }

      // Sort client-side by date descending
      txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Save to local cache
      localStorage.setItem(cachedTxsKey, JSON.stringify(txs));

      // Run recurring transaction engine
      const { updatedTxs, count } = processRecurringTransactions(txs);
      setTransactions(updatedTxs);
      checkAndAutoSync(updatedTxs);

      if (count > 0) {
        // Save new auto-generated records to Firestore
        const newOnly = updatedTxs.filter(ut => !txs.some(t => t.id === ut.id));
        newOnly.forEach(async (nt) => {
          try {
            await saveTransaction(user.uid, nt);
          } catch (e) {
            console.error('Error writing recurring tx:', e);
          }
        });

        // Update parent recurring masters in Firestore
        const changedMasters = updatedTxs.filter(ut => {
          const match = txs.find(t => t.id === ut.id);
          return match && match.lastGeneratedDate !== ut.lastGeneratedDate;
        });
        changedMasters.forEach(async (cm) => {
          try {
            await saveTransaction(user.uid, cm);
          } catch (e) {
            console.error('Error updating master recurring tx:', e);
          }
        });

        triggerToast(`Auto-generated ${count} recurring transaction(s) due.`);
      }
    }, (error) => {
      console.error("Firestore transactions sync error:", error);
    });

    // Subscribe to budgets collection in Cloud mode
    const unsubscribeBudgets = onSnapshot(collection(db, 'users', user.uid, 'budgets'), (snapshot) => {
      const bList: Budget[] = [];
      snapshot.forEach((doc) => {
        bList.push(doc.data() as Budget);
      });

      if (bList.length === 0) {
        // Seed with default budgets if they have none
        seedUserData(user.uid, [], DEFAULT_BUDGETS).catch(err => {
          console.error('Failed to seed default budgets:', err);
        });
        setBudgets(DEFAULT_BUDGETS);
        localStorage.setItem(cachedBudgetsKey, JSON.stringify(DEFAULT_BUDGETS));
      } else {
        setBudgets(bList);
        localStorage.setItem(cachedBudgetsKey, JSON.stringify(bList));
      }
    }, (error) => {
      console.error("Firestore budgets sync error:", error);
    });

    // Subscribe to user document for cloud settings restoration
    const unsubscribeUserDoc = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const uData = docSnap.data();
        if (uData && uData.userSettings) {
          const {
            theme: cloudTheme,
            currency: cloudCurrency,
            appSettings: cloudAppSettings,
            aiConfig: cloudAiConfig,
            telegramConfig: cloudTelegramConfig,
          } = uData.userSettings;

          if (cloudTheme && cloudTheme !== theme) {
            setTheme(cloudTheme);
            localStorage.setItem('finance_tracker_theme', cloudTheme);
          }
          if (cloudCurrency && cloudCurrency !== currency) {
            setCurrency(cloudCurrency);
            localStorage.setItem('finance_tracker_currency', cloudCurrency);
          }
          if (cloudAppSettings) {
            setSettings((prev) => {
              const isDifferent = JSON.stringify(prev) !== JSON.stringify(cloudAppSettings);
              if (isDifferent) {
                const merged = { ...prev, ...cloudAppSettings };
                localStorage.setItem('finance_tracker_settings', JSON.stringify(merged));
                return merged;
              }
              return prev;
            });
          }
          if (cloudAiConfig) {
            saveStoredAIConfig(cloudAiConfig);
          }
          if (cloudTelegramConfig) {
            saveTelegramConfig(cloudTelegramConfig);
          }
        }
      }
    }, (error) => {
      console.warn("Firestore user settings sync warning:", error);
    });

    return () => {
      unsubscribeTxs();
      unsubscribeBudgets();
      unsubscribeUserDoc();
    };
  }, [user, refreshCount]);

  const notifyTelegramIfEnabled = async (tx: Transaction) => {
    try {
      const tgConfig = getTelegramConfig();
      if (tgConfig.autoNotifyNewTx && tgConfig.botToken && tgConfig.chatId) {
        const symbol = currency === 'KHR' ? '៛' : '$';
        const msg = formatNewTransactionMessage(tx, settings.companyName, symbol);
        await sendTelegramMessage(tgConfig.botToken, tgConfig.chatId, msg);
      }
    } catch (err) {
      console.error('Telegram auto-notify failed:', err);
    }
  };

  // Add or Update Handler
  const handleFormSubmit = async (txData: Omit<Transaction, 'id'>) => {
    if (!user) return;
    try {
      if (user.uid === 'offline-user') {
        let updatedTxsList: Transaction[] = [];
        let savedTx: Transaction;
        if (editingTransaction) {
          savedTx = {
            ...editingTransaction,
            ...txData
          };
          updatedTxsList = transactions.map(t => t.id === editingTransaction.id ? savedTx : t);
          setEditingTransaction(null);
          triggerToast('Transaction updated successfully.');
        } else {
          savedTx = {
            id: `tx-${Date.now()}`,
            ...txData,
          };
          updatedTxsList = [savedTx, ...transactions];
          triggerToast('Transaction recorded successfully.');
          setActiveTab('dashboard');
        }
        setTransactions(updatedTxsList);
        localStorage.setItem('finance_tracker_offline_txs', JSON.stringify(updatedTxsList));
        await syncOfflineTransactionsToServer(updatedTxsList);
        checkAndAutoSync(updatedTxsList);
        notifyTelegramIfEnabled(savedTx);
        return;
      }

      let updatedTxsList: Transaction[] = [];
      let savedTx: Transaction;
      if (editingTransaction) {
        // Edit mode
        savedTx = {
          ...editingTransaction,
          ...txData
        };
        updatedTxsList = transactions.map(t => t.id === editingTransaction.id ? savedTx : t);
        setTransactions(updatedTxsList);
        localStorage.setItem(`finance_tracker_cloud_txs_${user.uid}`, JSON.stringify(updatedTxsList));
        await saveTransaction(user.uid, savedTx);
        setEditingTransaction(null);
        triggerToast('Transaction updated successfully.');
        setActiveTab('ledger');
      } else {
        // Add mode
        savedTx = {
          id: `tx-${Date.now()}`,
          ...txData,
        };
        updatedTxsList = [savedTx, ...transactions];
        setTransactions(updatedTxsList);
        localStorage.setItem(`finance_tracker_cloud_txs_${user.uid}`, JSON.stringify(updatedTxsList));
        await saveTransaction(user.uid, savedTx);
        triggerToast('Transaction recorded successfully.');
        setActiveTab('dashboard');
      }
      checkAndAutoSync(updatedTxsList);
      notifyTelegramIfEnabled(savedTx);
    } catch (e) {
      console.error(e);
      triggerToast('Failed to save transaction.');
    }
  };

  // Delete Handler
  const handleDeleteTransaction = async (id: string) => {
    if (!user) return;
    try {
      const filtered = transactions.filter(t => t.id !== id);
      if (user.uid === 'offline-user') {
        setTransactions(filtered);
        localStorage.setItem('finance_tracker_offline_txs', JSON.stringify(filtered));
        await syncOfflineTransactionsToServer(filtered);
        triggerToast('Transaction deleted.');
        if (editingTransaction?.id === id) {
          setEditingTransaction(null);
        }
        checkAndAutoSync(filtered);
        return;
      }

      setTransactions(filtered);
      localStorage.setItem(`finance_tracker_cloud_txs_${user.uid}`, JSON.stringify(filtered));
      await deleteTransaction(user.uid, id);
      triggerToast('Transaction deleted.');
      if (editingTransaction?.id === id) {
        setEditingTransaction(null);
      }
      checkAndAutoSync(filtered);
    } catch (e) {
      console.error(e);
      triggerToast('Failed to delete transaction.');
    }
  };

  // Update Budget Limit
  const handleUpdateBudget = async (category: string, limit: number) => {
    if (!user) return;
    try {
      if (user.uid === 'offline-user') {
        const updatedBudgets = budgets.map(b => b.category === category ? { ...b, limit } : b);
        setBudgets(updatedBudgets);
        localStorage.setItem('finance_tracker_offline_budgets', JSON.stringify(updatedBudgets));
        await syncOfflineBudgetsToServer(updatedBudgets);
        triggerToast(`Budget for category updated to ${formatAmountNoCents(limit, currency)}.`);
        return;
      }

      await saveBudget(user.uid, { category, limit });
      triggerToast(`Budget for category updated to $${limit.toFixed(0)}.`);
    } catch (e) {
      console.error(e);
      triggerToast('Failed to update budget.');
    }
  };

  // Export to CSV conforming to all 16 user worksheet columns
  const handleExportCSV = () => {
    const csvContent = exportWorksheetCSV(transactions);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `expense_worksheet_${new Date().toISOString().slice(0, 10)}.csv`);
    a.click();
    triggerToast('Expense worksheet exported successfully.');
  };

  // Global Refresh function
  const handleGlobalRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    triggerToast('Synchronizing offline records, Google Sheets, and configurations...');
    
    // Force increment to re-fetch/re-bind the core Firestore/LocalStorage listeners and process recurrings
    setRefreshCount((prev) => prev + 1);

    // Re-validate Google Sheets status if connected
    if (googleToken) {
      try {
        const cached = getCachedAccessToken();
        if (cached) setGoogleToken(cached);
      } catch (err) {
        console.warn('Sheets status refresh skipped:', err);
      }
    }
    
    // Slight artificial delay for elegant, tactile transitions
    await new Promise((resolve) => setTimeout(resolve, 850));
    setIsRefreshing(false);
    triggerToast('All accounts and settings are fully up to date!');
  };

  // Reset to sample data
  const handleResetData = async () => {
    if (!user) return;
    if (window.confirm('This will restore all demo transactions and reset budgets. Continue?')) {
      try {
        if (user.uid === 'offline-user') {
          setTransactions(SAMPLE_TRANSACTIONS);
          setBudgets(DEFAULT_BUDGETS);
          localStorage.setItem('finance_tracker_offline_txs', JSON.stringify(SAMPLE_TRANSACTIONS));
          localStorage.setItem('finance_tracker_offline_budgets', JSON.stringify(DEFAULT_BUDGETS));
          await syncOfflineTransactionsToServer(SAMPLE_TRANSACTIONS);
          await syncOfflineBudgetsToServer(DEFAULT_BUDGETS);
          setEditingTransaction(null);
          triggerToast('Database reset to sample data.');
          return;
        }

        await seedUserData(user.uid, SAMPLE_TRANSACTIONS, DEFAULT_BUDGETS);
        setEditingTransaction(null);
        triggerToast('Database reset to sample data.');
      } catch (e) {
        console.error(e);
        triggerToast('Failed to reset data.');
      }
    }
  };

  // Clear all transactions data
  const handleClearAllData = async () => {
    if (!user) return;
    if (window.confirm('Are you absolutely sure you want to clear ALL transaction data? This cannot be undone.')) {
      try {
        if (user.uid === 'offline-user') {
          setTransactions([]);
          localStorage.setItem('finance_tracker_offline_txs', JSON.stringify([]));
          localStorage.setItem('finance_tracker_offline_initialized', 'true');
          await syncOfflineTransactionsToServer([]);
          setEditingTransaction(null);
          triggerToast('All records cleared.');
          return;
        }

        const cachedTxsKey = `finance_tracker_cloud_txs_${user.uid}`;
        localStorage.setItem(cachedTxsKey, JSON.stringify([]));
        await clearUserTransactions(user.uid, transactions);
        setTransactions([]);
        setEditingTransaction(null);
        triggerToast('All records cleared.');
      } catch (e) {
        console.error(e);
        triggerToast('Failed to clear records.');
      }
    }
  };

  // Nuke Data Handler - Completely erases all application data (transactions, budgets, settings, local storage, cloud documents)
  const handleNukeData = async () => {
    if (!user) return;
    try {
      if (user.uid === 'offline-user') {
        localStorage.setItem('finance_tracker_offline_txs', JSON.stringify([]));
        localStorage.setItem('finance_tracker_offline_budgets', JSON.stringify([]));
        localStorage.setItem('finance_tracker_offline_initialized', 'true');
        await syncOfflineTransactionsToServer([]);
        await syncOfflineBudgetsToServer([]);
      } else {
        const cachedTxsKey = `finance_tracker_cloud_txs_${user.uid}`;
        const cachedBudgetsKey = `finance_tracker_cloud_budgets_${user.uid}`;
        localStorage.setItem(cachedTxsKey, JSON.stringify([]));
        localStorage.setItem(cachedBudgetsKey, JSON.stringify([]));
        await nukeUserData(user.uid);
      }

      setTransactions([]);
      setBudgets([]);
      setEditingTransaction(null);
      setSettings(DEFAULT_SETTINGS);

      // Persist reset settings in localStorage
      localStorage.setItem('finance_tracker_settings', JSON.stringify(DEFAULT_SETTINGS));

      triggerToast('💥 Nuke Data Complete: All application data has been permanently erased.');
    } catch (e) {
      console.error('Nuke data error:', e);
      triggerToast('Failed to erase application data.');
    }
  };

  // Google Authentication Handlers
  const handleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedAccessToken(credential.accessToken);
        setGoogleToken(credential.accessToken);
      }
      triggerToast('Signed in successfully!');
    } catch (error) {
      console.error(error);
      triggerToast('Authentication failed.');
    }
  };

  const handleEmailSignIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    triggerToast('Signed in successfully!');
  };

  const handleEmailSignUp = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    triggerToast('Account created successfully!');
  };

  const handlePasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const handleSignOut = async () => {
    try {
      if (user?.uid === 'offline-user') {
        setUser(null);
        setCachedAccessToken(null);
        setGoogleToken(null);
        triggerToast('Switched to login screen.');
        return;
      }
      await signOut(auth);
      setCachedAccessToken(null);
      setGoogleToken(null);
      triggerToast('Signed out successfully.');
    } catch (error) {
      console.error(error);
      triggerToast('Sign out failed.');
    }
  };

  // Google Sheets Integration Handlers
  const handleConnectSheets = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedAccessToken(credential.accessToken);
        setGoogleToken(credential.accessToken);
        triggerToast('Google Sheets connected successfully!');
      } else {
        throw new Error('Access token not found in Google credentials.');
      }
    } catch (error) {
      console.error(error);
      triggerToast('Failed to connect Google Sheets.');
    }
  };

  const handleDisconnectSheets = () => {
    setCachedAccessToken(null);
    setGoogleToken(null);
    localStorage.removeItem('finance_tracker_linked_sheet_id');
    localStorage.removeItem('finance_tracker_auto_sync_sheets');
    triggerToast('Disconnected from Google Sheets.');
  };

  const handleImportTransactions = async (imported: Omit<Transaction, 'id'>[]) => {
    if (!user) return;
    try {
      const now = Date.now();
      const generated: Transaction[] = imported.map((item, idx) => ({
        ...item,
        id: `tx-import-${now}-${idx}-${Math.random().toString(36).substr(2, 7)}`,
      }));

      const updated = [...generated, ...transactions];
      setTransactions(updated);

      if (user.uid === 'offline-user') {
        localStorage.setItem('finance_tracker_offline_txs', JSON.stringify(updated));
      } else {
        // Cloud Mode - write to Firestore in batch
        localStorage.setItem(`finance_tracker_cloud_txs_${user.uid}`, JSON.stringify(updated));
        await saveTransactionsBatch(user.uid, generated);
      }
      checkAndAutoSync(updated);
      triggerToast(`Successfully imported ${generated.length} record(s)!`);
    } catch (e) {
      console.error('Failed to import:', e);
      triggerToast('Failed to save imported transactions.');
      throw e;
    }
  };

  const checkAndAutoSync = async (updatedTxs: Transaction[]) => {
    const isAutoSync = localStorage.getItem('finance_tracker_auto_sync_sheets') === 'true';
    const linkedSheetId = localStorage.getItem('finance_tracker_linked_sheet_id');
    const token = getCachedAccessToken() || googleToken;
    if (isAutoSync && linkedSheetId && token) {
      const currentHash = JSON.stringify(updatedTxs.map(t => `${t.id}_${t.amount}_${t.date}_${t.type}`));
      if (currentHash === lastAutoSyncHashRef.current) return;
      lastAutoSyncHashRef.current = currentHash;

      try {
        await exportToSpreadsheet(token, linkedSheetId, updatedTxs);
        triggerToast('Auto-synced update to Google Sheets!');
      } catch (e) {
        console.error('Auto-sync failed:', e);
      }
    }
  };

  const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { id: 'record', label: 'Add Record', icon: 'PlusCircle' },
    { id: 'ledger', label: 'Ledger History', icon: 'History' },
    { id: 'budgets', label: 'Budgets Planner', icon: 'PiggyBank' },
    { id: 'settings', label: 'Settings', icon: 'Settings' },
  ];

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors duration-300">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg animate-pulse">
          <CategoryIcon name="Play" size={20} className="fill-white translate-x-[1px] text-white animate-spin" />
        </div>
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-4">Connecting Securely...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginView
        onSignIn={handleSignIn}
        onEmailSignIn={handleEmailSignIn}
        onEmailSignUp={handleEmailSignUp}
        onPasswordReset={handlePasswordReset}
        onContinueAsGuest={() => {
          localStorage.setItem('finance_tracker_is_guest', 'true');
          setUser({
            uid: 'offline-user',
            displayName: 'Guest User',
            email: 'guest@chamlackmedia.com',
          } as any);
          triggerToast('Welcome! You are using Guest Mode (Local Storage).');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-800 dark:text-slate-100 select-none flex flex-col md:flex-row transition-colors duration-300" id="app-container">
      {/* Dynamic Floating Toast Notification */}
      {showNotification && (
        <div className="fixed bottom-20 md:bottom-5 right-5 z-50 bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-slate-800 dark:border-slate-700 animate-slide-in">
          <CategoryIcon name="Check" className="text-emerald-400" size={14} />
          {showNotification}
        </div>
      )}

      {/* 1. Left Navigation Sidebar (Desktop & Tablet) */}
      <aside className="hidden md:flex md:w-64 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex-col fixed inset-y-0 left-0 z-30 shadow-2xs transition-colors duration-300">
        {/* Sidebar Header / Logo */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          {settings.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt="Workspace Logo" 
              className="w-10 h-10 rounded-xl object-contain bg-white shadow-3xs p-1 shrink-0 border border-slate-100 dark:border-slate-800" 
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-indigo-100 dark:shadow-none relative overflow-hidden group shrink-0">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition duration-300" />
              <CategoryIcon name="Play" size={16} className="fill-white translate-x-[1px] text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-wider uppercase leading-none truncate">
              {settings.companyName.split(' ')[0]} <span className="text-indigo-600 dark:text-indigo-400">{settings.companyName.split(' ').slice(1).join(' ') || 'MEDIA'}</span>
            </h1>
            <p className="text-[9px] text-teal-650 dark:text-teal-400 font-extrabold uppercase tracking-widest mt-1 truncate">{settings.tagline || 'Finance Hub'}</p>
          </div>
        </div>

        {/* Sidebar Navigation Items */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id === 'record') setFormEntryMode('manual');
                  if (item.id !== 'record') setEditingTransaction(null);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold rounded-xl transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-900/35 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                }`}
              >
                <CategoryIcon name={item.icon} size={16} className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Bottom Utilities / Session details */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          {/* Currency Format Selector */}
          <div className="w-full flex flex-col gap-1.5 p-3 border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl shadow-3xs text-xs font-semibold text-slate-700 dark:text-slate-300">
            <label htmlFor="currency-select" className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider flex items-center gap-1.5">
              <CategoryIcon name="Coins" size={11} className="text-indigo-500 dark:text-indigo-400" />
              Currency Settings
            </label>
            <select
              id="currency-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="w-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/20 transition cursor-pointer"
            >
              <option value="USD">USD ($) Dollar</option>
              <option value="KHR">KHR (៛) Riel</option>
            </select>
          </div>

          {/* Dark Mode Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="w-full flex items-center justify-between gap-2 text-xs font-semibold py-2.5 px-3 border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl cursor-pointer transition shadow-3xs"
            title="Toggle theme color palette"
          >
            <div className="flex items-center gap-2">
              <CategoryIcon name={theme === 'light' ? 'Moon' : 'Sun'} size={14} className={theme === 'light' ? 'text-indigo-600' : 'text-amber-500'} />
              <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {theme}
            </span>
          </button>

          {/* Global Refresh Button */}
          <button
            onClick={handleGlobalRefresh}
            disabled={isRefreshing}
            className={`w-full flex items-center justify-between gap-2 text-xs font-semibold py-2.5 px-3 border ${
              isRefreshing 
                ? 'border-indigo-200 bg-indigo-50/30 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 font-bold' 
                : 'border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            } rounded-xl cursor-pointer transition shadow-3xs`}
            title="Refresh database, Google Sheets, and configuration updates"
          >
            <div className="flex items-center gap-2">
              <CategoryIcon 
                name="RefreshCcw" 
                size={14} 
                className={`${isRefreshing ? 'animate-spin text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`} 
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Global Refresh'}</span>
            </div>
            {isRefreshing && (
              <span className="text-[8px] font-extrabold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 animate-pulse">
                Syncing
              </span>
            )}
          </button>

          <button
            onClick={handleResetData}
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 px-3 border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer transition shadow-3xs"
            title="Restore default demo records"
          >
            <CategoryIcon name="Database" size={12} />
            Demo Data
          </button>
          <button
            onClick={handleClearAllData}
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 px-3 border border-transparent hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl cursor-pointer transition"
            title="Clear all transaction lists"
          >
            <CategoryIcon name="Trash2" size={12} />
            Clear Records
          </button>

          {user.uid === 'offline-user' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl text-[10px] font-bold uppercase tracking-wider justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              Guest Offline Mode
            </div>
          )}

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2 px-3 border border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl cursor-pointer transition"
            title="Sign Out Session"
          >
            <CategoryIcon name="LogOut" size={12} />
            Sign Out
          </button>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'User'} 
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full border border-indigo-100 dark:border-indigo-900 object-cover shadow-2xs shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs uppercase shadow-2xs shrink-0">
                {(user.displayName || user.email || 'U').charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{user.displayName || 'Finance User'}</p>
              <p className="text-[9px] text-slate-400 dark:text-slate-550 font-semibold uppercase tracking-wider truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Top Header (Mobile view only) */}
      <header className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 h-16 sticky top-0 z-40 flex items-center justify-between px-4 shadow-3xs transition-colors duration-300">
        <div className="flex items-center gap-2.5 min-w-0">
          {settings.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt="Workspace Logo" 
              className="w-8 h-8 rounded-lg object-contain bg-white shadow-3xs p-0.5 shrink-0 border border-slate-100 dark:border-slate-800" 
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-teal-400 flex items-center justify-center text-white shadow-xs shrink-0">
              <CategoryIcon name="Play" size={13} className="fill-white text-white" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xs font-black text-slate-800 dark:text-slate-100 tracking-wider uppercase leading-none truncate">
              {settings.companyName.split(' ')[0]} <span className="text-indigo-600 dark:text-indigo-400">{settings.companyName.split(' ').slice(1).join(' ') || 'MEDIA'}</span>
            </h1>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[8px] bg-teal-50 dark:bg-teal-950/50 text-teal-650 dark:text-teal-400 font-extrabold px-1.5 py-0.5 rounded-sm uppercase tracking-wider truncate">{settings.tagline || 'Finance Hub'}</span>
              {user.uid === 'offline-user' && (
                <span className="text-[8px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-extrabold px-1.5 py-0.5 rounded-sm uppercase tracking-wider shrink-0">Guest</span>
              )}
            </div>
          </div>
        </div>

        {/* Action controllers on mobile header */}
        <div className="flex items-center gap-2">
          {/* Mobile Currency Selector */}
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="text-[10px] font-bold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-lg px-2 py-1 focus:outline-none cursor-pointer shadow-3xs"
          >
            <option value="USD">$ USD</option>
            <option value="KHR">៛ KHR</option>
          </select>

          {/* Mobile Search Button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="p-2 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-lg cursor-pointer"
            title="Search logs"
          >
            <CategoryIcon name="Search" size={13} className="text-indigo-600 dark:text-indigo-400" />
          </button>

          {/* Mobile Dark Mode Toggle */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-lg cursor-pointer"
            title="Toggle theme mode"
          >
            <CategoryIcon name={theme === 'light' ? 'Moon' : 'Sun'} size={13} className={theme === 'light' ? 'text-indigo-600' : 'text-amber-500'} />
          </button>

          {/* Mobile Global Refresh Button */}
          <button
            onClick={handleGlobalRefresh}
            disabled={isRefreshing}
            className={`p-2 border rounded-lg cursor-pointer transition ${
              isRefreshing 
                ? 'border-indigo-200 bg-indigo-50/30 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400' 
                : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400'
            }`}
            title="Global Refresh"
          >
            <CategoryIcon 
              name="RefreshCcw" 
              size={13} 
              className={`${isRefreshing ? 'animate-spin text-indigo-600 dark:text-indigo-400' : ''}`} 
            />
          </button>

          <button
            onClick={handleResetData}
            className="p-2 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500 rounded-lg cursor-pointer"
            title="Load Demo Data"
          >
            <CategoryIcon name="Database" size={13} />
          </button>
          <button
            onClick={handleClearAllData}
            className="p-2 border border-transparent bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-50 text-rose-500 rounded-lg cursor-pointer"
            title="Clear Records"
          >
            <CategoryIcon name="Trash2" size={13} />
          </button>
          <button
            onClick={handleSignOut}
            className="p-2 border border-transparent bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-lg cursor-pointer"
            title="Sign Out Session"
          >
            <CategoryIcon name="LogOut" size={13} />
          </button>
        </div>
      </header>

      {/* 3. Main Body View (Responsive Placements) */}
      <main className="flex-1 min-w-0 md:ml-64 pb-20 md:pb-8 flex flex-col bg-[#f8fafc] dark:bg-slate-950 transition-colors duration-300">
        {/* Desktop-only Dynamic Header bar */}
        <header className="hidden md:flex justify-between items-center px-8 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-20 shadow-3xs transition-colors duration-300">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 capitalize tracking-tight flex items-center gap-2">
              <CategoryIcon 
                name={NAV_ITEMS.find((n) => n.id === activeTab)?.icon || 'LayoutDashboard'} 
                size={18} 
                className="text-indigo-600 dark:text-indigo-400" 
              />
              {activeTab === 'record' ? (editingTransaction ? 'Edit Record' : 'Record Transaction') : activeTab}
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-550 font-medium">
              {activeTab === 'dashboard' && 'Financial summaries, statistics scorecard, and interactive flow charts'}
              {activeTab === 'record' && (editingTransaction ? 'Edit selected transaction entries' : 'Scan recipe invoice via Smart Gemini AI or type details manually')}
              {activeTab === 'ledger' && 'Search, filter, edit and download absolute transaction records ledger'}
              {activeTab === 'budgets' && 'Formulate monthly expenditure targets and track category limits progress'}
              {activeTab === 'settings' && 'Customize brand properties, upload workspace logos, modify contact details, or format ledger databases'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Command shortcut button */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900 border border-slate-100/50 dark:border-slate-800 rounded-lg pl-3 pr-2.5 py-1.5 flex items-center gap-4 font-semibold hover:border-indigo-300 dark:hover:border-indigo-800 cursor-pointer transition-all duration-200"
              title="Search command center"
            >
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <CategoryIcon name="Search" size={12} className="text-slate-400" />
                Quick Search
              </span>
              <kbd className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-200/50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-md border border-slate-200/20 font-mono tracking-normal leading-none shrink-0">
                ⌘K
              </kbd>
            </button>

            {/* Global Refresh Button */}
            <button
              onClick={handleGlobalRefresh}
              disabled={isRefreshing}
              className={`text-xs ${
                isRefreshing 
                  ? 'text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900 bg-indigo-50/20 animate-pulse' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-800 bg-slate-50 dark:bg-slate-900'
              } border border-slate-100/50 dark:border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2 font-semibold cursor-pointer transition-all duration-200`}
              title="Refresh ledger database, Google Sheets, and configurations"
            >
              <CategoryIcon 
                name="RefreshCcw" 
                size={12} 
                className={`${isRefreshing ? 'animate-spin text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} 
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <div className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/55 border border-slate-100/50 dark:border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-2 font-semibold">
              <CategoryIcon name="Clock" size={12} className="text-indigo-500 dark:text-indigo-400" />
              <span>Date: {new Date().toISOString().split('T')[0]}</span>
            </div>
          </div>
        </header>

        {/* Tab content area container */}
        <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-28 md:pb-8 space-y-6 flex-1">
          {/* Dashboard Tab view */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in" id="dashboard-tab-view">
              {/* Dashboard Currency View Controller */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100/80 dark:border-slate-800/80 p-4 rounded-2xl shadow-[var(--shadow-premium)] hover:shadow-[var(--shadow-premium-hover)] dark:hover:shadow-[var(--shadow-premium-dark-hover)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 select-none transition-all duration-300">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest block font-sans">Dashboard Segment Filter</span>
                  <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                    <CategoryIcon name="Coins" size={14} className="text-indigo-600 dark:text-indigo-400" />
                    {dashboardCurrencyFilter === 'usd-only' && 'United States Dollar Ledger (USD)'}
                    {dashboardCurrencyFilter === 'khr-only' && 'Cambodian Riel Ledger (KHR)'}
                    {dashboardCurrencyFilter === 'consolidated' && `Consolidated Multi-Currency Portfolio (${currency})`}
                  </h2>
                  <p className="text-[11px] text-slate-450 dark:text-slate-555 leading-relaxed max-w-2xl font-medium">
                    {dashboardCurrencyFilter === 'usd-only' && 'Displaying true, unconverted entries originally transacted in USD only.'}
                    {dashboardCurrencyFilter === 'khr-only' && 'Displaying true, unconverted entries originally transacted in KHR only.'}
                    {dashboardCurrencyFilter === 'consolidated' && `Displaying combined records with cross-currency conversions to ${currency}.`}
                  </p>
                </div>

                <div className="flex bg-slate-50 dark:bg-slate-950 p-1 rounded-xl border border-slate-150/70 dark:border-slate-850 w-full md:w-auto shrink-0 self-stretch md:self-auto">
                  <button
                    onClick={() => setDashboardCurrencyFilter('usd-only')}
                    className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                      dashboardCurrencyFilter === 'usd-only'
                        ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xs border border-slate-200/50 dark:border-slate-800'
                        : 'text-slate-400 dark:text-slate-550 hover:text-slate-750 dark:hover:text-slate-300'
                    }`}
                  >
                    <span className="text-sm leading-none">🇺🇸</span>
                    <span>USD Only</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-slate-150 dark:bg-slate-800 rounded font-mono font-bold text-slate-500 dark:text-slate-400">
                      {transactions.filter(t => t.currency === 'USD').length}
                    </span>
                  </button>
                  <button
                    onClick={() => setDashboardCurrencyFilter('khr-only')}
                    className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                      dashboardCurrencyFilter === 'khr-only'
                        ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xs border border-slate-200/50 dark:border-slate-800'
                        : 'text-slate-400 dark:text-slate-550 hover:text-slate-750 dark:hover:text-slate-300'
                    }`}
                  >
                    <span className="text-sm leading-none">🇰🇭</span>
                    <span>KHR Only</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-slate-150 dark:bg-slate-800 rounded font-mono font-bold text-slate-500 dark:text-slate-400">
                      {transactions.filter(t => t.currency === 'KHR').length}
                    </span>
                  </button>
                  <button
                    onClick={() => setDashboardCurrencyFilter('consolidated')}
                    className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                      dashboardCurrencyFilter === 'consolidated'
                        ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-2xs border border-slate-200/50 dark:border-slate-800'
                        : 'text-slate-400 dark:text-slate-555 hover:text-slate-750 dark:hover:text-slate-300'
                    }`}
                  >
                    <CategoryIcon name="TrendingUp" size={11} className="text-indigo-500" />
                    <span>Consolidated</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-slate-150 dark:bg-slate-800 rounded font-mono font-bold text-slate-500 dark:text-slate-400">
                      {transactions.length}
                    </span>
                  </button>
                </div>
              </div>

              <StatsGrid transactions={dashboardData.transactions} currency={dashboardData.currency} />
              <QuickAddWidget onSubmit={handleFormSubmit} currency={dashboardData.currency} />
              <SpendingTrends transactions={dashboardData.transactions} currency={dashboardData.currency} />
              <DashboardInsights transactions={dashboardData.transactions} budgets={budgets} currency={dashboardData.currency} />
              <MonthlyFinancialReport transactions={dashboardData.transactions} currency={dashboardData.currency} />
              <VisualCharts transactions={dashboardData.transactions} currency={dashboardData.currency} />
            </div>
          )}

          {/* Record Input Tab view */}
          {activeTab === 'record' && (
            <div className="max-w-xl mx-auto animate-fade-in" id="record-tab-view">
              <TransactionForm
                onSubmit={handleFormSubmit}
                initialTransaction={editingTransaction}
                defaultEntryMode={formEntryMode}
                settings={settings}
                onCancelEdit={() => {
                  setEditingTransaction(null);
                  setActiveTab('ledger');
                }}
              />
            </div>
          )}

          {/* Ledger History List Tab view */}
          {activeTab === 'ledger' && (
            <div className="w-full animate-fade-in" id="ledger-tab-view">
              <TransactionList
                transactions={transactions}
                onDelete={handleDeleteTransaction}
                onEdit={(tx) => {
                  setEditingTransaction(tx);
                  setActiveTab('record');
                }}
                onExport={handleExportCSV}
                onImportCSV={handleImportTransactions}
                currency={currency}
                companyName={settings.companyName}
                tagline={settings.tagline}
              />
            </div>
          )}

          {/* Budgets Management Tab view */}
          {activeTab === 'budgets' && (
            <div className="max-w-3xl mx-auto animate-fade-in" id="budgets-tab-view">
              <BudgetOverview
                transactions={transactions}
                budgets={budgets}
                onUpdateBudget={handleUpdateBudget}
                currency={currency}
                triggerToast={triggerToast}
              />
            </div>
          )}

          {/* Settings Tab view */}
          {activeTab === 'settings' && (
            <div className="w-full animate-fade-in" id="settings-tab-view">
              <SettingsView
                settings={settings}
                onUpdateSettings={setSettings}
                onResetData={handleResetData}
                onClearData={handleClearAllData}
                onNukeData={handleNukeData}
                triggerToast={triggerToast}
                transactions={transactions}
                googleToken={googleToken}
                onConnectSheets={handleConnectSheets}
                onDisconnectSheets={handleDisconnectSheets}
                onImportTransactions={handleImportTransactions}
                currencySymbol={currency === 'KHR' ? '៛' : '$'}
                user={user}
              />
            </div>
          )}
        </div>
      </main>

      {/* 4. Bottom Menu Navigation (Mobile screens only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-around items-center z-40 px-2 shadow-lg transition-colors duration-300">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (item.id === 'record') setFormEntryMode('manual');
                if (item.id !== 'record') setEditingTransaction(null);
              }}
              className="relative flex flex-col items-center justify-center flex-1 h-full py-1.5 cursor-pointer select-none transition-colors duration-300 outline-none"
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-active-tab-indicator"
                  className="absolute inset-x-1 inset-y-1.5 bg-indigo-50/70 dark:bg-indigo-950/45 rounded-2xl border border-indigo-100/45 dark:border-indigo-900/40 -z-10"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <CategoryIcon 
                name={item.icon} 
                size={18} 
                className={`transition-colors duration-300 ${isActive ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-400'}`} 
              />
              <span 
                className={`text-[9px] tracking-tight transition-colors duration-300 ${
                  isActive ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-400 font-semibold'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* 5. Mobile Floating Action Button (FAB) for Smart AI Scan */}
      <motion.button
        onClick={handleFabClick}
        onMouseDown={startLongPress}
        onMouseUp={endLongPress}
        onMouseLeave={endLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={endLongPress}
        onTouchCancel={endLongPress}
        onContextMenu={(e) => e.preventDefault()}
        whileHover={{ scale: 1.12, rotate: 5 }}
        whileTap={{ scale: 0.92, rotate: -5 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        className="relative md:hidden fixed bottom-20 right-5 z-40 w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none cursor-pointer border border-indigo-400/20 touch-none select-none"
        title="Direct Smart AI Scan (Hold for Quick Note)"
        id="mobile-ai-scan-fab"
      >
        {/* Hold progress indicator ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none p-0.5" viewBox="0 0 48 48">
          <circle
            cx="24"
            cy="24"
            r="21"
            className="stroke-indigo-400/25 dark:stroke-indigo-300/15 fill-none"
            strokeWidth="2.5"
          />
          <motion.circle
            cx="24"
            cy="24"
            r="21"
            className="stroke-white fill-none"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: isHolding ? 1 : 0 }}
            transition={{
              duration: isHolding ? 0.6 : 0.1,
              ease: isHolding ? 'linear' : 'easeOut',
            }}
          />
        </svg>

        <CategoryIcon name="Sparkles" size={20} className="animate-pulse text-white z-10" />
      </motion.button>

      {/* Global Command Search Palette & Quick Note Modal */}
      {isSearchOpen && (
        <SearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          transactions={transactions}
          currency={currency}
          onSelectPage={(tabId) => {
            setActiveTab(tabId);
            if (tabId === 'record') setFormEntryMode('manual');
          }}
          onSelectTransaction={(tx) => {
            setEditingTransaction(tx);
            setActiveTab('record');
            triggerToast(`Navigated to edit "${tx.description}"`);
          }}
        />
      )}

      {isQuickNoteOpen && (
        <QuickNoteModal
          isOpen={isQuickNoteOpen}
          onClose={() => setIsQuickNoteOpen(false)}
          currency={currency}
          onSave={async (tx) => {
            await handleFormSubmit(tx);
          }}
          triggerToast={triggerToast}
        />
      )}
    </div>
  );
}

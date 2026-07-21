import { useState, useEffect } from 'react';
import { Transaction, Budget } from './types';
import { StatsGrid } from './components/StatsGrid';
import { TransactionForm } from './components/TransactionForm';
import { TransactionList } from './components/TransactionList';
import { VisualCharts } from './components/VisualCharts';
import { BudgetOverview } from './components/BudgetOverview';
import { CategoryIcon } from './components/CategoryIcon';

// Realistic sample transactions for initial state/demonstration
const SAMPLE_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    type: 'income',
    amount: 4200.0,
    category: 'Salary',
    date: '2026-07-01',
    description: 'Monthly Salary Payment',
    paymentMethod: 'Bank Transfer',
  },
  {
    id: 'tx-2',
    type: 'expense',
    amount: 1200.0,
    category: 'Housing',
    date: '2026-07-02',
    description: 'Apartment Rent Auto-Pay',
    paymentMethod: 'Bank Transfer',
  },
  {
    id: 'tx-3',
    type: 'expense',
    amount: 145.2,
    category: 'Food',
    date: '2026-07-04',
    description: 'Weekly Supermarket Run',
    paymentMethod: 'Card',
  },
  {
    id: 'tx-4',
    type: 'expense',
    amount: 52.3,
    category: 'Transport',
    date: '2026-07-06',
    description: 'Gas Station Refuel',
    paymentMethod: 'Card',
  },
  {
    id: 'tx-5',
    type: 'income',
    amount: 650.0,
    category: 'Freelance',
    date: '2026-07-08',
    description: 'Website UI Design Freelance',
    paymentMethod: 'Mobile Pay',
  },
  {
    id: 'tx-6',
    type: 'expense',
    amount: 110.0,
    category: 'Utilities',
    date: '2026-07-10',
    description: 'Electricity & Internet Bill',
    paymentMethod: 'Card',
  },
  {
    id: 'tx-7',
    type: 'expense',
    amount: 185.0,
    category: 'Shopping',
    date: '2026-07-12',
    description: 'New Mechanical Keyboard',
    paymentMethod: 'Card',
  },
  {
    id: 'tx-8',
    type: 'expense',
    amount: 45.0,
    category: 'Entertainment',
    date: '2026-07-14',
    description: 'Streaming Subscriptions',
    paymentMethod: 'Card',
  },
  {
    id: 'tx-9',
    type: 'expense',
    amount: 65.5,
    category: 'Food',
    date: '2026-07-15',
    description: 'Dinner Date Night',
    paymentMethod: 'Cash',
  },
  {
    id: 'tx-10',
    type: 'expense',
    amount: 40.0,
    category: 'Healthcare',
    date: '2026-07-16',
    description: 'Pharmacy OTC Purchase',
    paymentMethod: 'Cash',
  },
];

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

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showNotification, setShowNotification] = useState<string | null>(null);

  // Load from LocalStorage
  useEffect(() => {
    // Force clear all previous data as requested by the user
    setTransactions([]);
    localStorage.setItem('finance_tracker_transactions', JSON.stringify([]));

    const localBudgets = localStorage.getItem('finance_tracker_budgets');
    if (localBudgets) {
      setBudgets(JSON.parse(localBudgets));
    } else {
      setBudgets(DEFAULT_BUDGETS);
      localStorage.setItem('finance_tracker_budgets', JSON.stringify(DEFAULT_BUDGETS));
    }
  }, []);

  const triggerToast = (message: string) => {
    setShowNotification(message);
    setTimeout(() => {
      setShowNotification(null);
    }, 3000);
  };

  // Add or Update Handler
  const handleFormSubmit = (txData: Omit<Transaction, 'id'>) => {
    let updatedTransactions: Transaction[];

    if (editingTransaction) {
      // Edit mode
      updatedTransactions = transactions.map((t) =>
        t.id === editingTransaction.id ? { ...t, ...txData } : t
      );
      setEditingTransaction(null);
      triggerToast('Transaction updated successfully.');
    } else {
      // Add mode
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        ...txData,
      };
      updatedTransactions = [newTx, ...transactions];
      triggerToast('Transaction recorded successfully.');
    }

    setTransactions(updatedTransactions);
    localStorage.setItem('finance_tracker_transactions', JSON.stringify(updatedTransactions));
  };

  // Delete Handler
  const handleDeleteTransaction = (id: string) => {
    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);
    localStorage.setItem('finance_tracker_transactions', JSON.stringify(updated));
    triggerToast('Transaction deleted.');
    
    // If deleted transaction is currently being edited, cancel edit mode
    if (editingTransaction?.id === id) {
      setEditingTransaction(null);
    }
  };

  // Update Budget Limit
  const handleUpdateBudget = (category: string, limit: number) => {
    const updated = budgets.map((b) => (b.category === category ? { ...b, limit } : b));
    setBudgets(updated);
    localStorage.setItem('finance_tracker_budgets', JSON.stringify(updated));
    triggerToast(`Budget for category updated to $${limit.toFixed(0)}.`);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['ID', 'Type', 'Amount ($)', 'Category', 'Date', 'Description', 'Payment Method'];
    const csvRows = [
      headers.join(','),
      ...transactions.map((tx) =>
        [
          tx.id,
          tx.type,
          tx.amount,
          tx.category,
          tx.date,
          `"${tx.description.replace(/"/g, '""')}"`,
          tx.paymentMethod,
        ].join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `financial_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    a.click();
    triggerToast('Ledger ledger exported successfully.');
  };

  // Reset to sample data
  const handleResetData = () => {
    if (window.confirm('This will restore all demo transactions and reset budgets. Continue?')) {
      setTransactions(SAMPLE_TRANSACTIONS);
      setBudgets(DEFAULT_BUDGETS);
      localStorage.setItem('finance_tracker_transactions', JSON.stringify(SAMPLE_TRANSACTIONS));
      localStorage.setItem('finance_tracker_budgets', JSON.stringify(DEFAULT_BUDGETS));
      setEditingTransaction(null);
      triggerToast('Database reset to sample data.');
    }
  };

  // Clear all data
  const handleClearAllData = () => {
    if (window.confirm('Are you absolutely sure you want to clear ALL transaction data? This cannot be undone.')) {
      setTransactions([]);
      localStorage.setItem('finance_tracker_transactions', JSON.stringify([]));
      setEditingTransaction(null);
      triggerToast('All records cleared.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12 select-none" id="app-container">
      {/* Dynamic Floating Toast Notification */}
      {showNotification && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-slate-800 animate-slide-in">
          <CategoryIcon name="Check" className="text-emerald-400" size={14} />
          {showNotification}
        </div>
      )}

      {/* Modern High-Fidelity Header */}
      <header className="bg-white border-b border-slate-100 py-5 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <CategoryIcon name="TrendingUp" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">Finance Tracker</h1>
              <p className="text-xs text-slate-400">Record, visualize, and budget your income and expenses</p>
            </div>
          </div>

          {/* Quick utility controls */}
          <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-end">
            <button
              onClick={handleResetData}
              className="text-xs font-medium px-3 py-1.5 border border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50 text-slate-500 rounded-lg cursor-pointer transition"
              title="Reset records to default demo data"
              id="btn-reset-data"
            >
              Demo Data
            </button>
            <button
              onClick={handleClearAllData}
              className="text-xs font-medium px-3 py-1.5 border border-transparent hover:bg-rose-50 text-rose-500 rounded-lg cursor-pointer transition"
              title="Clear all recorded entries"
              id="btn-clear-all"
            >
              Clear Records
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* KPI Scorecard Grid */}
        <StatsGrid transactions={transactions} />

        {/* Dynamic Bento Block Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Column 1: Record Form (Span 4) */}
          <div className="lg:col-span-4">
            <TransactionForm
              onSubmit={handleFormSubmit}
              initialTransaction={editingTransaction}
              onCancelEdit={() => setEditingTransaction(null)}
            />
          </div>

          {/* Column 2: Insights Visualizations (Span 8) */}
          <div className="lg:col-span-8 space-y-6">
            <VisualCharts transactions={transactions} />
            <BudgetOverview
              transactions={transactions}
              budgets={budgets}
              onUpdateBudget={handleUpdateBudget}
            />
          </div>
        </div>

        {/* Full ledger history list */}
        <div className="w-full">
          <TransactionList
            transactions={transactions}
            onDelete={handleDeleteTransaction}
            onEdit={(tx) => {
              setEditingTransaction(tx);
              // Scroll gracefully to input form
              document.getElementById('transaction-form-card')?.scrollIntoView({ behavior: 'smooth' });
            }}
            onExport={handleExportCSV}
          />
        </div>
      </main>
    </div>
  );
}

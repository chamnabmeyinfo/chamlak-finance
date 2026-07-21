export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  description: string;
  paymentMethod: string;
}

export interface Budget {
  category: string;
  limit: number;
}

export interface CategoryConfig {
  name: string;
  color: string; // Tailwind bg-class
  borderColor: string; // Tailwind border-class
  textColor: string; // Tailwind text-class
  icon: string; // Lucide icon name
}

export const INCOME_CATEGORIES: Record<string, CategoryConfig> = {
  Salary: { name: 'Salary', color: 'bg-emerald-50 text-emerald-700', borderColor: 'border-emerald-200', textColor: 'text-emerald-700', icon: 'Briefcase' },
  Freelance: { name: 'Freelance', color: 'bg-teal-50 text-teal-700', borderColor: 'border-teal-200', textColor: 'text-teal-700', icon: 'Laptop' },
  Investments: { name: 'Investments', color: 'bg-cyan-50 text-cyan-700', borderColor: 'border-cyan-200', textColor: 'text-cyan-700', icon: 'TrendingUp' },
  Other_Income: { name: 'Other Income', color: 'bg-indigo-50 text-indigo-700', borderColor: 'border-indigo-200', textColor: 'text-indigo-700', icon: 'Gift' },
};

export const EXPENSE_CATEGORIES: Record<string, CategoryConfig> = {
  Food: { name: 'Food & Dining', color: 'bg-orange-50 text-orange-700', borderColor: 'border-orange-200', textColor: 'text-orange-700', icon: 'Utensils' },
  Shopping: { name: 'Shopping', color: 'bg-pink-50 text-pink-700', borderColor: 'border-pink-200', textColor: 'text-pink-700', icon: 'ShoppingBag' },
  Housing: { name: 'Housing & Rent', color: 'bg-blue-50 text-blue-700', borderColor: 'border-blue-200', textColor: 'text-blue-700', icon: 'Home' },
  Transport: { name: 'Transport', color: 'bg-purple-50 text-purple-700', borderColor: 'border-purple-200', textColor: 'text-purple-700', icon: 'Car' },
  Utilities: { name: 'Utilities', color: 'bg-amber-50 text-amber-700', borderColor: 'border-amber-200', textColor: 'text-amber-700', icon: 'Zap' },
  Entertainment: { name: 'Entertainment', color: 'bg-rose-50 text-rose-700', borderColor: 'border-rose-200', textColor: 'text-rose-700', icon: 'Tv' },
  Healthcare: { name: 'Healthcare', color: 'bg-red-50 text-red-700', borderColor: 'border-red-200', textColor: 'text-red-700', icon: 'Heart' },
  Other_Expense: { name: 'Miscellaneous', color: 'bg-slate-50 text-slate-700', borderColor: 'border-slate-200', textColor: 'text-slate-700', icon: 'Coffee' },
};

export const PAYMENT_METHODS = ['Card', 'Cash', 'Bank Transfer', 'Mobile Pay'];

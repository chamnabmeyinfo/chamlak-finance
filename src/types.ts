export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'Paid' | 'Pending' | 'Cleared' | 'Reimbursed' | 'Overdue';
export type CurrencyType = 'USD' | 'KHR';

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string; // 1. Date
  vendor?: string; // 2. Vendor
  category: string; // 3. Category
  description: string; // 4. Description
  paymentMethod: string; // 5. Payment Method
  currency?: CurrencyType; // 6. Currency ('USD' | 'KHR')
  netAmount?: number; // 7. Amount (Net)
  taxAmount?: number; // 8. Tax / VAT
  amount: number; // 9. Total
  totalUSD?: number; // 10. Total (USD)
  totalKHR?: number; // 11. Total (KHR)
  status?: TransactionStatus; // 12. Status
  payUnder?: string; // 13. Pay Under
  imageAttachment?: string; // 14. Attachment (Base64 or URL)
  imageAttachmentName?: string; // Original filename
  additionalEvidence?: string; // Secondary proof document
  additionalEvidenceName?: string;
  weekOfMonth?: string; // 15. Week of Month
  exchangeRate?: number; // 16. Exchange Rate (KHR per 1 USD)
  isRecurring?: boolean;
  recurringInterval?: 'weekly' | 'monthly';
  lastGeneratedDate?: string;
  notes?: string;
  tags?: string[];
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
  Social: { name: 'Social Media', color: 'bg-blue-50 text-blue-700', borderColor: 'border-blue-200', textColor: 'text-blue-700', icon: 'Globe' },
  Article: { name: 'Article Write-Up', color: 'bg-lime-50 text-lime-700', borderColor: 'border-lime-200', textColor: 'text-lime-700', icon: 'FileText' },
  IT: { name: 'IT & Cloud Services', color: 'bg-purple-50 text-purple-700', borderColor: 'border-purple-200', textColor: 'text-purple-700', icon: 'Cpu' },
  'Web Design and Development': { name: 'Web Design & Dev', color: 'bg-violet-50 text-violet-700', borderColor: 'border-violet-200', textColor: 'text-violet-700', icon: 'Layers' },
  Videography: { name: 'Videography', color: 'bg-rose-50 text-rose-700', borderColor: 'border-rose-200', textColor: 'text-rose-700', icon: 'Film' },
  'UI Design': { name: 'UI / UX Design', color: 'bg-fuchsia-50 text-fuchsia-700', borderColor: 'border-fuchsia-200', textColor: 'text-fuchsia-700', icon: 'Sliders' },
  Translation: { name: 'Translation Services', color: 'bg-amber-50 text-amber-700', borderColor: 'border-amber-200', textColor: 'text-amber-700', icon: 'Globe' },
  Video: { name: 'Video Production', color: 'bg-red-50 text-red-700', borderColor: 'border-red-200', textColor: 'text-red-700', icon: 'Film' },
  'Graphic Design': { name: 'Graphic Design', color: 'bg-pink-50 text-pink-700', borderColor: 'border-pink-200', textColor: 'text-pink-700', icon: 'Award' },
  Event: { name: 'Event Coordination', color: 'bg-indigo-50 text-indigo-700', borderColor: 'border-indigo-200', textColor: 'text-indigo-700', icon: 'Activity' },
  'Chatbot Setup': { name: 'Chatbot Setup', color: 'bg-sky-50 text-sky-700', borderColor: 'border-sky-200', textColor: 'text-sky-700', icon: 'Bot' },
  'Social Media Marketing': { name: 'Social Marketing', color: 'bg-blue-50 text-blue-700', borderColor: 'border-blue-200', textColor: 'text-blue-700', icon: 'Send' },
  Photography: { name: 'Photography', color: 'bg-emerald-50 text-emerald-700', borderColor: 'border-emerald-200', textColor: 'text-emerald-700', icon: 'Camera' },
  Radio: { name: 'Radio Marketing', color: 'bg-yellow-50 text-yellow-700', borderColor: 'border-yellow-200', textColor: 'text-yellow-700', icon: 'Music' },
  'Rental PMS': { name: 'Rental PMS Solutions', color: 'bg-teal-50 text-teal-700', borderColor: 'border-teal-200', textColor: 'text-teal-700', icon: 'Home' },
  'Video Animation': { name: 'Video Animation', color: 'bg-orange-50 text-orange-700', borderColor: 'border-orange-200', textColor: 'text-orange-700', icon: 'Zap' },
  'Custom Development': { name: 'Custom Dev', color: 'bg-violet-50 text-violet-700', borderColor: 'border-violet-200', textColor: 'text-violet-700', icon: 'Cpu' },
  'Installation Fee': { name: 'Installation Fee', color: 'bg-zinc-50 text-zinc-700', borderColor: 'border-zinc-200', textColor: 'text-zinc-700', icon: 'PlusCircle' },
  'Corporate Branding': { name: 'Corporate Branding', color: 'bg-indigo-50 text-indigo-700', borderColor: 'border-indigo-200', textColor: 'text-indigo-700', icon: 'Sparkles' },
  'Artwork Design': { name: 'Artwork Design', color: 'bg-rose-50 text-rose-700', borderColor: 'border-rose-200', textColor: 'text-rose-700', icon: 'Award' },
  Website: { name: 'Website Solutions', color: 'bg-cyan-50 text-cyan-700', borderColor: 'border-cyan-200', textColor: 'text-cyan-700', icon: 'Globe' },
  'Pop animation': { name: 'Pop Animation', color: 'bg-amber-50 text-amber-700', borderColor: 'border-amber-200', textColor: 'text-amber-700', icon: 'Play' },
  Design: { name: 'Design Services', color: 'bg-pink-50 text-pink-700', borderColor: 'border-pink-200', textColor: 'text-pink-700', icon: 'Sliders' },
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

export const PAYMENT_METHODS = ['Card', 'Cash', 'Bank Transfer', 'ABA Pay', 'Mobile Pay', 'Wing'];
export const TRANSACTION_STATUSES: TransactionStatus[] = ['Paid', 'Pending', 'Cleared', 'Reimbursed', 'Overdue'];

export interface AppSettings {
  companyName: string;
  tagline: string;
  supportEmail: string;
  logoUrl: string; // Base64 image data-url or empty if default
  allowedFileTypes?: string[]; // Array of allowed file extensions e.g. ['.jpg', '.png', '.pdf', '.txt', '.csv', '.doc', '.docx']
}


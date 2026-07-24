import { Transaction } from '../types';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  autoNotifyNewTx: boolean;
  autoNotifyDailySummary: boolean;
  lastReportSentAt?: string;
}

export const getTelegramConfig = (): TelegramConfig => {
  const saved = localStorage.getItem('finance_tracker_telegram_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse telegram config:', e);
    }
  }
  return {
    botToken: '',
    chatId: '',
    autoNotifyNewTx: false,
    autoNotifyDailySummary: false,
  };
};

export const saveTelegramConfig = (config: TelegramConfig) => {
  localStorage.setItem('finance_tracker_telegram_config', JSON.stringify(config));
};

export const sendTelegramMessage = async (botToken: string, chatId: string, text: string) => {
  if (!botToken.trim() || !chatId.trim()) {
    throw new Error('Please provide both a valid Telegram Bot Token and Chat ID.');
  }

  const url = `https://api.telegram.org/bot${botToken.trim()}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId.trim(),
      text,
      parse_mode: 'Markdown',
    }),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || 'Failed to send Telegram message.');
  }
  return data;
};

export const formatFinancialSummaryMessage = (
  transactions: Transaction[],
  companyName: string = 'CHAMLAK MEDIA',
  currencySymbol: string = '$'
): string => {
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpense;
  const now = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  transactions.forEach((t) => {
    const key = `${t.type === 'income' ? '📈' : '📉'} ${t.category}`;
    categoryMap[key] = (categoryMap[key] || 0) + t.amount;
  });

  let topCategoryText = '';
  const topCategories = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (topCategories.length > 0) {
    topCategoryText = '\n\n📊 *Top Categories Summary:*\n' +
      topCategories.map(([cat, amt]) => `• ${cat}: *${currencySymbol}${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}*`).join('\n');
  }

  const statusEmoji = netBalance >= 0 ? '🟢 Net Surplus' : '🔴 Net Deficit';

  return `🧠 *${companyName.toUpperCase()} FINANCIAL BRAIN REPORT*
📅 _Generated on ${now}_

----------------------------------
💰 *Total Income:* \`${currencySymbol}${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}\`
💸 *Total Expenses:* \`${currencySymbol}${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}\`
⚖️ *Net Balance:* \`${currencySymbol}${netBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}\` (${statusEmoji})
📝 *Total Transactions:* ${transactions.length}${topCategoryText}

----------------------------------
📌 _Automated accounting report sent directly from ${companyName} App._`;
};

export const formatNewTransactionMessage = (
  tx: Transaction,
  companyName: string = 'CHAMLAK MEDIA',
  currencySymbol: string = '$'
): string => {
  const typeEmoji = tx.type === 'income' ? '🟢 INCOME RECORDED' : '🔴 EXPENSE RECORDED';
  return `⚡ *${companyName} - NEW TRANSACTION ALERT*

*Status:* ${typeEmoji}
*Amount:* \`${currencySymbol}${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\`
*Category:* ${tx.category}
*Date:* ${tx.date}
*Payment Method:* ${tx.paymentMethod}
*Description:* ${tx.description || 'N/A'}
${tx.imageAttachmentName ? `📎 *Attachment:* ${tx.imageAttachmentName}` : ''}`;
};

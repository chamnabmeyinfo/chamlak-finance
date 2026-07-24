import React, { useState, useEffect } from 'react';
import { Send, Bot, CheckCircle2, AlertCircle, RefreshCw, HelpCircle, ShieldCheck, Zap, MessageSquare } from 'lucide-react';
import { Transaction } from '../types';
import {
  TelegramConfig,
  getTelegramConfig,
  saveTelegramConfig,
  sendTelegramMessage,
  formatFinancialSummaryMessage,
} from '../lib/telegramService';

interface TelegramIntegrationProps {
  transactions: Transaction[];
  companyName: string;
  currencySymbol: string;
  triggerToast: (msg: string) => void;
}

export const TelegramIntegration: React.FC<TelegramIntegrationProps> = ({
  transactions,
  companyName,
  currencySymbol,
  triggerToast,
}) => {
  const [config, setConfig] = useState<TelegramConfig>(getTelegramConfig());
  const [isTesting, setIsTesting] = useState(false);
  const [isSendingSummary, setIsSendingSummary] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);

  useEffect(() => {
    saveTelegramConfig(config);
  }, [config]);

  const handleTestConnection = async () => {
    if (!config.botToken.trim() || !config.chatId.trim()) {
      triggerToast('Please fill in both Bot Token and Chat ID.');
      return;
    }

    setIsTesting(true);
    setTestSuccess(null);
    try {
      const testMsg = `🤖 *CHAMLAK MEDIA Finance Bot connected successfully!*\n\nThis Telegram channel is now registered as the *Accounting Brain Hub* for *${companyName}*. Live income, expense, and financial reports will be posted here.`;
      await sendTelegramMessage(config.botToken, config.chatId, testMsg);
      setTestSuccess(true);
      triggerToast('Telegram bot connection verified! Check your Telegram group for the test message.');
    } catch (err: any) {
      console.error(err);
      setTestSuccess(false);
      triggerToast(err.message || 'Failed to connect to Telegram Bot.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSendSummaryNow = async () => {
    if (!config.botToken.trim() || !config.chatId.trim()) {
      triggerToast('Please configure Bot Token and Chat ID first.');
      return;
    }

    setIsSendingSummary(true);
    try {
      const message = formatFinancialSummaryMessage(transactions, companyName, currencySymbol);
      await sendTelegramMessage(config.botToken, config.chatId, message);
      const now = new Date().toLocaleTimeString();
      setConfig((prev) => ({ ...prev, lastReportSentAt: now }));
      triggerToast('Latest Financial Brain summary sent to Telegram group successfully!');
    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || 'Failed to dispatch financial summary.');
    } finally {
      setIsSendingSummary(false);
    }
  };

  const isConfigured = Boolean(config.botToken.trim() && config.chatId.trim());

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Telegram Accounting Bot</h3>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isConfigured 
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}>
                {isConfigured ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                {isConfigured ? 'Bot Connected' : 'Not Configured'}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Serve as the central brain reporting live financial income, expenses, and summaries directly to your Telegram accounting group.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowInstructions(!showInstructions)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline self-start sm:self-auto"
        >
          <HelpCircle className="w-4 h-4" />
          {showInstructions ? 'Hide Setup Guide' : 'Setup Guide & Instructions'}
        </button>
      </div>

      {/* Setup Instructions Helper Box */}
      {showInstructions && (
        <div className="p-4 bg-sky-50/80 dark:bg-sky-950/30 rounded-xl border border-sky-100 dark:border-sky-900/50 text-sm text-sky-900 dark:text-sky-200 space-y-3">
          <h4 className="font-bold flex items-center gap-2 text-sky-800 dark:text-sky-300">
            <ShieldCheck className="w-4 h-4" /> How to connect your Telegram Bot (3 Quick Steps):
          </h4>
          <ol className="list-decimal list-inside space-y-2 text-xs sm:text-sm">
            <li>
              Open Telegram and search for <strong>@BotFather</strong>. Send <code>/newbot</code> and follow the prompts to get your <strong>Bot API Token</strong> (e.g. <code>123456789:ABCdefGhIJKlm...</code>).
            </li>
            <li>
              Add your newly created bot to your target <strong>Telegram Accounting Group or Channel</strong> and promote it to <strong>Admin</strong>.
            </li>
            <li>
              To get your <strong>Group Chat ID</strong>, send a message in the group, then add <strong>@myidbot</strong> or <strong>@RawDataBot</strong> to the group, or visit <code>https://api.telegram.org/bot&lt;YourBOTToken&gt;/getUpdates</code> in your browser to inspect the <code>chat.id</code> (starts with a minus sign like <code>-100123456789</code> for supergroups).
            </li>
          </ol>
        </div>
      )}

      {/* Configuration Form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Telegram Bot Token <span className="text-rose-500">*</span>
          </label>
          <input
            type="password"
            placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
            value={config.botToken}
            onChange={(e) => setConfig((prev) => ({ ...prev, botToken: e.target.value }))}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-sky-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Group / Chat ID <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. -1001234567890 or 987654321"
            value={config.chatId}
            onChange={(e) => setConfig((prev) => ({ ...prev, chatId: e.target.value }))}
            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-sky-500 font-mono"
          />
        </div>
      </div>

      {/* Test Connection Result Feedback */}
      {testSuccess === true && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Telegram Bot verified! Test message successfully delivered to group.</span>
        </div>
      )}
      {testSuccess === false && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Connection failed. Make sure the Bot Token and Chat ID are correct, and that the bot has been added to the Telegram group.</span>
        </div>
      )}

      {/* Bot Automation Toggles */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl space-y-3 border border-slate-100 dark:border-slate-700/80">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-amber-500" /> Auto-Report Preferences
        </h4>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">Auto-Report New Transactions</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Instantly send a formatted alert to Telegram whenever a new Income or Expense record is logged or imported.
            </p>
          </div>
          <input
            type="checkbox"
            checked={config.autoNotifyNewTx}
            onChange={(e) => setConfig((prev) => ({ ...prev, autoNotifyNewTx: e.target.checked }))}
            className="w-5 h-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={isTesting || !isConfigured}
          className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
          Test Bot Connection
        </button>

        <button
          type="button"
          onClick={handleSendSummaryNow}
          disabled={isSendingSummary || !isConfigured}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSendingSummary ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Current Financial Report to Telegram Now
        </button>
      </div>

      {config.lastReportSentAt && (
        <p className="text-right text-[11px] text-slate-400 dark:text-slate-500 italic">
          Last report sent to group at {config.lastReportSentAt}
        </p>
      )}
    </div>
  );
};

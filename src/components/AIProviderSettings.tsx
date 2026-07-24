import React, { useState, useEffect } from 'react';
import { Cpu, Key, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Eye, EyeOff, ShieldCheck, Sparkles, Check, ChevronDown, Zap } from 'lucide-react';
import {
  AIProviderId,
  AI_PROVIDERS,
  UserAIConfig,
  getStoredAIConfig,
  saveStoredAIConfig,
} from '../lib/aiProviderConfig';

interface AIProviderSettingsProps {
  triggerToast: (msg: string) => void;
}

export const AIProviderSettings: React.FC<AIProviderSettingsProps> = ({ triggerToast }) => {
  const [config, setConfig] = useState<UserAIConfig>(getStoredAIConfig());
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    saveStoredAIConfig(config);
  }, [config]);

  const activeProvider = AI_PROVIDERS[config.provider] || AI_PROVIDERS.gemini;

  const handleProviderChange = (providerId: AIProviderId) => {
    const prov = AI_PROVIDERS[providerId];
    setConfig((prev) => ({
      ...prev,
      provider: providerId,
      model: prov.defaultModel,
    }));
    setTestResult(null);
  };

  const handleTestKey = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/ai/test-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: config.provider,
          apiKey: config.apiKey,
          model: config.model,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'API key test failed.');
      }

      setTestResult({
        success: true,
        message: data.message || `Successfully connected to ${activeProvider.name}!`,
      });
      setConfig((prev) => ({ ...prev, isCustomKeyActive: true }));
      triggerToast(`AI Provider verified: ${activeProvider.name} is ready!`);
    } catch (err: any) {
      console.error(err);
      setTestResult({
        success: false,
        message: err.message || 'Failed to verify API key.',
      });
      triggerToast(err.message || 'Verification failed. Check your API key.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-xs space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">AI Engine & API Keys</h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${activeProvider.badgeColor}`}>
                <Zap className="w-3 h-3" />
                {activeProvider.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choose your AI provider (Gemini, ChatGPT, Claude, DeepSeek, Groq) and configure API credentials for receipt scanning & AI insights.
            </p>
          </div>
        </div>
      </div>

      {/* Provider Selector Cards & Dropdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Select AI Provider
          </label>
          <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
            Active: {activeProvider.name}
          </span>
        </div>

        {/* Dropdown for fast access */}
        <div className="relative">
          <select
            value={config.provider}
            onChange={(e) => handleProviderChange(e.target.value as AIProviderId)}
            className="w-full pl-3.5 pr-10 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer"
          >
            {(Object.keys(AI_PROVIDERS) as AIProviderId[]).map((pId) => {
              const prov = AI_PROVIDERS[pId];
              return (
                <option key={pId} value={pId}>
                  {prov.name} ({prov.defaultModel})
                </option>
              );
            })}
          </select>
          <div className="pointer-events-none absolute right-3 top-3 text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        {/* Interactive Provider Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
          {(Object.keys(AI_PROVIDERS) as AIProviderId[]).map((pId) => {
            const prov = AI_PROVIDERS[pId];
            const isSelected = config.provider === pId;

            return (
              <button
                key={pId}
                type="button"
                onClick={() => handleProviderChange(pId)}
                className={`p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'border-purple-600 dark:border-purple-500 bg-purple-50/60 dark:bg-purple-950/40 ring-1 ring-purple-500/30 shadow-3xs'
                    : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-950/40'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`font-bold text-xs ${isSelected ? 'text-purple-900 dark:text-purple-200' : 'text-slate-700 dark:text-slate-200'}`}>
                    {prov.name}
                  </span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 truncate">
                  {prov.defaultModel}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Provider Details Box */}
      <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {activeProvider.name} Credentials
            </span>
          </div>
          <a
            href={activeProvider.docUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
          >
            Get {activeProvider.name} API Key <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* API Key Input */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              API Key {config.provider === 'gemini' ? <span className="text-emerald-600 font-normal">(Optional default ready)</span> : <span className="text-rose-500">*</span>}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder={activeProvider.keyPlaceholder}
                value={config.apiKey}
                onChange={(e) => {
                  setConfig((prev) => ({ ...prev, apiKey: e.target.value, isCustomKeyActive: Boolean(e.target.value.trim()) }));
                  setTestResult(null);
                }}
                className="w-full pl-3 pr-10 py-2 text-xs font-mono rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {config.provider === 'gemini' && !config.apiKey.trim() && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold pt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Built-in system Gemini key is active.
              </p>
            )}
          </div>

          {/* Model Selector */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Model
            </label>
            <select
              value={config.model}
              onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))}
              className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
            >
              {activeProvider.recommendedModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Verification Alert Message */}
        {testResult && (
          <div
            className={`p-3 text-xs rounded-xl border flex items-center gap-2 font-medium ${
              testResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            }`}
          >
            {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span className="leading-tight">{testResult.message}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleTestKey}
            disabled={isTesting || (config.provider !== 'gemini' && !config.apiKey.trim())}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-3xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Test & Verify Key Connection
          </button>
        </div>
      </div>
    </div>
  );
};


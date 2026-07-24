export type AIProviderId = 'gemini' | 'openai' | 'claude' | 'groq' | 'deepseek' | 'openrouter';

export interface AIProviderDetails {
  id: AIProviderId;
  name: string;
  defaultModel: string;
  recommendedModels: string[];
  keyPlaceholder: string;
  docUrl: string;
  description: string;
  badgeColor: string;
}

export const AI_PROVIDERS: Record<AIProviderId, AIProviderDetails> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    defaultModel: 'gemini-3.6-flash',
    recommendedModels: ['gemini-3.6-flash', 'gemini-3.1-pro-preview'],
    keyPlaceholder: 'AIzaSy...',
    docUrl: 'https://aistudio.google.com/app/apikey',
    description: 'Fast, highly accurate multimodal AI by Google DeepMind (Default system provider).',
    badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    defaultModel: 'gpt-4o-mini',
    recommendedModels: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
    keyPlaceholder: 'sk-proj-...',
    docUrl: 'https://platform.openai.com/api-keys',
    description: 'Industry standard models by OpenAI with vision and structured output capabilities.',
    badgeColor: 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-400 border-green-200',
  },
  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    defaultModel: 'claude-3-5-haiku-20241022',
    recommendedModels: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
    keyPlaceholder: 'sk-ant-api03-...',
    docUrl: 'https://console.anthropic.com/settings/keys',
    description: 'Advanced reasoning and vision accuracy by Anthropic.',
    badgeColor: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400 border-orange-200',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek AI',
    defaultModel: 'deepseek-chat',
    recommendedModels: ['deepseek-chat', 'deepseek-reasoner'],
    keyPlaceholder: 'sk-...',
    docUrl: 'https://platform.deepseek.com/api_keys',
    description: 'High-performance cost-effective models by DeepSeek.',
    badgeColor: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border-blue-200',
  },
  groq: {
    id: 'groq',
    name: 'Groq Llama',
    defaultModel: 'llama-3.3-70b-versatile',
    recommendedModels: ['llama-3.3-70b-versatile', 'llama3-70b-8192', 'mixtral-8x7b-32768'],
    keyPlaceholder: 'gsk_...',
    docUrl: 'https://console.groq.com/keys',
    description: 'Ultra-fast inference on LPUs powered by open source Meta Llama models.',
    badgeColor: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 border-purple-200',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter Unified',
    defaultModel: 'openai/gpt-4o-mini',
    recommendedModels: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-haiku', 'google/gemini-3.6-flash', 'deepseek/deepseek-chat'],
    keyPlaceholder: 'sk-or-v1-...',
    docUrl: 'https://openrouter.ai/keys',
    description: 'Unified API routing to 100+ LLMs with a single API key.',
    badgeColor: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 border-indigo-200',
  },
};

export interface UserAIConfig {
  provider: AIProviderId;
  apiKey: string;
  model: string;
  isCustomKeyActive: boolean;
}

export const getStoredAIConfig = (): UserAIConfig => {
  const saved = localStorage.getItem('finance_tracker_ai_provider_config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && (parsed.model === 'gemini-2.5-flash' || parsed.model === 'gemini-2.5-pro')) {
        parsed.model = AI_PROVIDERS.gemini.defaultModel;
        localStorage.setItem('finance_tracker_ai_provider_config', JSON.stringify(parsed));
      }
      return parsed;
    } catch (e) {
      console.error('Failed to parse AI provider config:', e);
    }
  }
  return {
    provider: 'gemini',
    apiKey: '',
    model: AI_PROVIDERS.gemini.defaultModel,
    isCustomKeyActive: false,
  };
};

export const saveStoredAIConfig = (config: UserAIConfig) => {
  localStorage.setItem('finance_tracker_ai_provider_config', JSON.stringify(config));
};

/**
 * Asks the server whether this account may use the built-in Gemini key.
 * Only owner accounts can; everyone else supplies their own provider key.
 */
export async function fetchBuiltInKeyAvailable(): Promise<boolean> {
  try {
    const { getAuthHeader } = await import('./firebase');
    const resp = await fetch('/api/ai/capabilities', { headers: await getAuthHeader() });
    if (!resp.ok) return false;
    const data = await resp.json();
    return Boolean(data.builtInKeyAvailable);
  } catch {
    return false;
  }
}

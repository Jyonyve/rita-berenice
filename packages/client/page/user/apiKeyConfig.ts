import type { ApiKeyType } from '@rita-berenice/shared/domain';

export const API_KEY_CONFIG: Array<{ key: ApiKeyType; label: string; placeholder: string }> = [
  { key: 'openrouterApiKey', label: 'OpenRouter', placeholder: 'sk-or-...' },
  { key: 'openaiApiKey', label: 'OpenAI', placeholder: 'sk-...' },
  { key: 'anthropicApiKey', label: 'Anthropic', placeholder: 'sk-ant-...' },
  { key: 'googleApiKey', label: 'Google', placeholder: 'AIza...' },
  { key: 'groqApiKey', label: 'Groq', placeholder: 'gsk_...' },
];

/**
 * Query parameter that asks the profile page to open its API key section instead of
 * leaving it collapsed. A fresh signup is redirected here because chatting is impossible
 * until the account stores a provider key.
 */
export const API_KEY_SETUP_PARAM = 'setup';
export const API_KEY_SETUP_VALUE = 'apiKeys';

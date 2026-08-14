import type { ApiKeyType } from '@rita-berenice/shared/domain';

export const API_KEY_CONFIG: Array<{ key: ApiKeyType; label: string; placeholder: string }> = [
	{ key: 'openrouterApiKey', label: 'OpenRouter', placeholder: 'sk-or-...' },
	{ key: 'openaiApiKey', label: 'OpenAI', placeholder: 'sk-...' },
	{ key: 'anthropicApiKey', label: 'Anthropic', placeholder: 'sk-ant-...' },
	{ key: 'googleApiKey', label: 'Google', placeholder: 'AIza...' },
	{ key: 'groqApiKey', label: 'Groq', placeholder: 'gsk_...' },
];

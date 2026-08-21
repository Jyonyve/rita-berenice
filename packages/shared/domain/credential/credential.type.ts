// src/shared/domain/credential/CredentialInterfaces.ts
export interface ValidationResult {
	valid: boolean;
	platform: 'direct' | 'openrouter'; // Where the API is accessed
	provider?: 'openai' | 'anthropic' | 'google' | 'groq';
	creditInfo?: string;
	errorMessage?: string;
}

export interface UserApiKeys {
	openaiApiKey?: string;
	anthropicApiKey?: string;
	googleApiKey?: string;
	openrouterApiKey?: string;
	groqApiKey?: string;
}

export const API_KEY_TYPES = [
	'openaiApiKey',
	'anthropicApiKey',
	'googleApiKey',
	'openrouterApiKey',
	'groqApiKey',
] as const satisfies readonly (keyof UserApiKeys)[];

export type ApiKeyType = (typeof API_KEY_TYPES)[number];

export interface UpdateApiKeyRequest {
	keyType: ApiKeyType;
	keyValue: string;
}

/**
 * Maps a chat model's platform/provider pair onto the API key it needs.
 *
 * Both sides depend on this: the server refuses to build an LLM client without the key,
 * and the client warns before sending rather than burning a request that cannot succeed.
 * Returns undefined for combinations that carry no key requirement.
 */
export const getRequiredApiKeyType = (
	platform: string,
	provider?: string
): ApiKeyType | undefined => {
	if (platform === 'openrouter') return 'openrouterApiKey';
	if (platform !== 'direct') return undefined;

	switch (provider) {
		case 'openai':
			return 'openaiApiKey';
		case 'anthropic':
			return 'anthropicApiKey';
		case 'google':
			return 'googleApiKey';
		case 'groq':
			return 'groqApiKey';
		default:
			return undefined;
	}
};

/** Human-facing provider label for the key type, used in "register your X key" messages. */
export const API_KEY_TYPE_LABELS: Record<ApiKeyType, string> = {
	openaiApiKey: 'OpenAI',
	anthropicApiKey: 'Anthropic',
	googleApiKey: 'Google',
	openrouterApiKey: 'OpenRouter',
	groqApiKey: 'Groq',
};

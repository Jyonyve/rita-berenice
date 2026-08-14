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

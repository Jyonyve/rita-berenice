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

export interface UpdateApiKeyRequest {
	keyType: keyof UserApiKeys;
	keyValue: string;
}

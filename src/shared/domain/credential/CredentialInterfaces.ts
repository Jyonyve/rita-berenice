// src/shared/domain/credential/CredentialInterfaces.ts
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

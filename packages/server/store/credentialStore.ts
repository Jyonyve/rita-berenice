// src/server/credential/credentialService.ts

import { CredentialResponse } from '@rita-berenice/shared/api';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import { ValidationResult, UserApiKeys } from '@rita-berenice/shared/domain';
import { buildCredentialId, encryptValue, decryptValue } from '@rita-berenice/shared/util';
import { Collection } from 'chromadb';
import chromaDbClient from '../db/chromaDbClient.js';
import { getCredentialEnv } from '../config/env.js';

// ✅ API Response Types
interface OpenAIUsageResponse {
	total_usage?: number;
}

interface OpenRouterAuthResponse {
	data?: { usage?: number };
}

interface GoogleErrorResponse {
	error?: { message?: string };
}

const { getCredentialCollection, upsertRecord, getRecordById } = chromaDbClient;
const { SECRET_ENCRYPTION_KEY } = getCredentialEnv();

export const credentialStore = {
	_credentialCollection: null as Collection | null,

	// Get collection with caching
	_getCollection: async (): Promise<Collection> => {
		if (credentialStore._credentialCollection) {
			return credentialStore._credentialCollection;
		}
		const collection = await getCredentialCollection();
		credentialStore._credentialCollection = collection;
		return collection;
	},

	_validateOpenAI: async (apiKey: string): Promise<ValidationResult> => {
		try {
			const response = await fetch('https://api.openai.com/v1/models', {
				headers: { Authorization: `Bearer ${apiKey}` },
			});

			if (response.ok) {
				try {
					const usageResponse = await fetch(
						'https://api.openai.com/v1/usage?date=' + new Date().toISOString().split('T')[0],
						{ headers: { Authorization: `Bearer ${apiKey}` } }
					);

					if (usageResponse.ok) {
						const usage = (await usageResponse.json()) as OpenAIUsageResponse;
						const creditInfo = usage.total_usage ? `Used: $${(usage.total_usage / 100).toFixed(2)}` : '';
						return { valid: true, platform: 'direct', provider: 'openai', creditInfo };
					}
				} catch (usageError) {
					// Usage API failed, but key is still valid
				}

				return { valid: true, platform: 'direct', provider: 'openai', creditInfo: '' };
			}

			const errorMessage =
				response.status === 401 ? 'Invalid or expired API key' : `API error: ${response.status}`;

			return { valid: false, platform: 'direct', provider: 'openai', errorMessage };
		} catch (error) {
			return {
				valid: false,
				platform: 'direct',
				provider: 'openai',
				errorMessage: 'Network error - could not validate',
			};
		}
	},

	_validateAnthropic: async (apiKey: string): Promise<ValidationResult> => {
		try {
			const response = await fetch('https://api.anthropic.com/v1/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': apiKey,
					'anthropic-version': '2023-06-01',
				},
				body: JSON.stringify({
					model: 'claude-3-haiku-20240307',
					max_tokens: 1,
					messages: [{ role: 'user', content: 'Hi' }],
				}),
			});

			if (response.status === 401) {
				return { valid: false, platform: 'direct', provider: 'anthropic', errorMessage: '' };
			}

			if (response.status === 429) {
				return {
					valid: false,
					platform: 'direct',
					provider: 'anthropic',
					errorMessage: 'Rate limited or no credits',
				};
			}

			return { valid: true, platform: 'direct', provider: 'anthropic', creditInfo: '' };
		} catch (error) {
			return {
				valid: false,
				platform: 'direct',
				provider: 'anthropic',
				errorMessage: 'Network error - could not validate',
			};
		}
	},

	_validateGoogle: async (apiKey: string): Promise<ValidationResult> => {
		try {
			const response = await fetch(
				`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
			);

			if (response.ok) {
				return { valid: true, platform: 'direct', provider: 'google', creditInfo: '' };
			}

			let errorMessage = `API error: ${response.status}`;
			if (response.status === 400 || response.status === 403) {
				try {
					const error = (await response.json()) as GoogleErrorResponse;
					errorMessage = error.error?.message || errorMessage;
				} catch {}
			}

			return { valid: false, platform: 'direct', provider: 'google', errorMessage };
		} catch (error) {
			return {
				valid: false,
				platform: 'direct',
				provider: 'google',
				errorMessage: 'Network error - could not validate',
			};
		}
	},

	_validateGroq: async (apiKey: string): Promise<ValidationResult> => {
		try {
			const response = await fetch('https://api.groq.com/openai/v1/models', {
				headers: { Authorization: `Bearer ${apiKey}` },
			});

			if (response.ok) {
				return { valid: true, platform: 'direct', provider: 'groq', creditInfo: '' };
			}

			const errorMessage = response.status === 401 ? '' : `API error: ${response.status}`;

			return { valid: false, platform: 'direct', provider: 'groq', errorMessage };
		} catch (error) {
			return {
				valid: false,
				platform: 'direct',
				provider: 'groq',
				errorMessage: 'Network error - could not validate',
			};
		}
	},

	_validateOpenRouter: async (apiKey: string): Promise<ValidationResult> => {
		try {
			const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
				headers: { Authorization: `Bearer ${apiKey}` },
			});

			if (response.ok) {
				const data = (await response.json()) as OpenRouterAuthResponse;
				const creditInfo = data.data?.usage ? `Credits: $${data.data.usage.toFixed(2)}` : '';

				return { valid: true, platform: 'openrouter', creditInfo };
			}

			const errorMessage = response.status === 401 ? '' : `API error: ${response.status}`;

			return { valid: false, platform: 'openrouter', errorMessage };
		} catch (error) {
			return {
				valid: false,
				platform: 'openrouter',
				errorMessage: 'Network error - could not validate',
			};
		}
	},

	/**
	 * Creates or updates a user's encrypted API keys.
	 */
	storeUserApiKeys: async (userId: string, apiKeys: UserApiKeys): Promise<void> => {
		try {
			const collection = await credentialStore._getCollection();
			const credentialId = buildCredentialId(userId);
			const now = new Date().toISOString();

			// --- Logic to preserve createdAt on update ---
			const existingRecord = await getRecordById(collection, credentialId).catch(() => null);

			const metadata = {
				userId,
				type: METADATA_TYPES.CREDENTIAL,
				keyType: METADATA_TYPES.APIKEY,
				createdAt: existingRecord?.metadatas?.[0]?.createdAt || now,
				updatedAt: now,
			};
			// --- End of new logic ---

			const encryptedKeys: Record<string, string> = {};
			await Promise.all(
				Object.entries(apiKeys).map(async ([key, value]) => {
					if (value) {
						encryptedKeys[key] = await encryptValue(value, SECRET_ENCRYPTION_KEY);
					}
				})
			);

			const secretDocument = JSON.stringify(encryptedKeys);

			await upsertRecord(collection, credentialId, secretDocument, metadata);

			console.log(`[CredentialService] Successfully stored/updated API keys for user ${userId}`);
		} catch (error) {
			console.error(`[CredentialService] Failed to store API keys for user ${userId}:`, error);
			throw error;
		}
	},

	/**
	 * Retrieves and decrypts API keys for a user.
	 */
	getUserApiKeys: async (userId: string): Promise<CredentialResponse> => {
		try {
			const collection = await credentialStore._getCollection();
			const credentialId = buildCredentialId(userId);
			const result = await getRecordById(collection, credentialId);

			if (!result.documents?.[0]) {
				console.warn(`[CredentialService] No API keys found for user ${userId}`);
				return { userApiKeys: {}, validationResults: {} };
			}

			const encryptedKeys = JSON.parse(result.documents[0]);
			const decryptedKeys: UserApiKeys = {};

			await Promise.all(
				Object.entries(encryptedKeys).map(async ([key, encryptedValue]) => {
					if (typeof encryptedValue === 'string') {
						try {
							decryptedKeys[key as keyof UserApiKeys] = await decryptValue(
								encryptedValue,
								SECRET_ENCRYPTION_KEY
							);
						} catch (decryptError) {
							console.error(`[CredentialService] Failed to decrypt key for user ${userId}:`, decryptError);
						}
					}
				})
			);
			return { userApiKeys: decryptedKeys, validationResults: {} };
		} catch (error) {
			console.error(`[CredentialService] Failed to retrieve API keys for user ${userId}:`, error);
			return { userApiKeys: {}, validationResults: {} };
		}
	},

	/**
	 * Updates a single API key for a user.
	 */
	updateUserApiKey: async (
		userId: string,
		keyType: keyof UserApiKeys,
		keyValue: string
	): Promise<void> => {
		try {
			const existingKeys = await credentialStore.getUserApiKeys(userId);
			const updatedKeys = { ...existingKeys, [keyType]: keyValue };
			await credentialStore.storeUserApiKeys(userId, updatedKeys.userApiKeys);
		} catch (error) {
			console.error(`[CredentialService] Failed to update ${keyType} for user ${userId}:`, error);
			throw error;
		}
	},

	/**
	 * Initializes default API keys for a user from environment variables.
	 */
	initializeDefaultApiKeys: async (userId: string): Promise<void> => {
		const defaultKeys: UserApiKeys = {
			openaiApiKey: '',
			anthropicApiKey: '',
			googleApiKey: '',
			openrouterApiKey: '',
			groqApiKey: '',
		};

		const validKeys = Object.fromEntries(
			Object.entries(defaultKeys).filter(([, value]) => value)
		) as UserApiKeys;

		if (Object.keys(validKeys).length > 0) {
			await credentialStore.storeUserApiKeys(userId, validKeys);
			console.log(`[CredentialService] Initialized default API keys for user ${userId}`);
		}
	},

	validateApiKeys: async (apiKeys: UserApiKeys): Promise<CredentialResponse> => {
		const validationResults: Record<string, ValidationResult> = {};

		const validationPromises = Object.entries(apiKeys).map(async ([keyType, keyValue]) => {
			if (!keyValue || keyValue.trim() === '') return;

			try {
				let result: ValidationResult;

				switch (keyType) {
					case 'openaiApiKey':
						result = await credentialStore._validateOpenAI(keyValue);
						break;
					case 'anthropicApiKey':
						result = await credentialStore._validateAnthropic(keyValue);
						break;
					case 'googleApiKey':
						result = await credentialStore._validateGoogle(keyValue);
						break;
					case 'groqApiKey':
						result = await credentialStore._validateGroq(keyValue);
						break;
					case 'openrouterApiKey':
						result = await credentialStore._validateOpenRouter(keyValue);
						break;
					default:
						result = { valid: false, platform: 'openrouter', errorMessage: 'Unknown key type' };
				}

				validationResults[keyType] = result;
			} catch (error) {
				validationResults[keyType] = {
					valid: false,
					platform: 'openrouter',
					errorMessage: 'Validation failed',
				};
			}
		});

		await Promise.all(validationPromises);

		return { userApiKeys: apiKeys, validationResults };
	},
};

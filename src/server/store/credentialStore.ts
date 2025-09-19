// src/server/credential/credentialService.ts

import { chromaDbClient } from '../db/chromaDbClient.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { Collection } from 'chromadb';
import { buildCredentialId } from '#shared/util/buildIdUtils.js';
import { decryptValue, encryptValue } from '#shared/util/cryptoUtils.js';
import { UserApiKeys } from '#shared/domain/credential/index.js';
import { CredentialResponse } from '#shared/api/ModuleResponse.js';

const { getCredentialCollection, upsertRecord, getRecordById } = chromaDbClient;
const ENCRYPTION_KEY = process.env.SECRET_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
	throw new Error('SERVER_ENCRYPTION_KEY is required for credential storage.');
}

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
						encryptedKeys[key] = await encryptValue(value, ENCRYPTION_KEY!);
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
				return { userApiKeys: {} };
			}

			const encryptedKeys = JSON.parse(result.documents[0]);
			const decryptedKeys: UserApiKeys = {};

			await Promise.all(
				Object.entries(encryptedKeys).map(async ([key, encryptedValue]) => {
					if (typeof encryptedValue === 'string') {
						try {
							decryptedKeys[key as keyof UserApiKeys] = await decryptValue(
								encryptedValue,
								ENCRYPTION_KEY!
							);
						} catch (decryptError) {
							console.error(`[CredentialService] Failed to decrypt key for user ${userId}:`, decryptError);
						}
					}
				})
			);

			return { userApiKeys: decryptedKeys };
		} catch (error) {
			console.error(`[CredentialService] Failed to retrieve API keys for user ${userId}:`, error);
			return { userApiKeys: {} };
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
			openaiApiKey: process.env.OPENAI_API_KEY,
			anthropicApiKey: process.env.ANTHROPIC_API_KEY,
			googleApiKey: process.env.GOOGLE_API_KEY,
			openrouterApiKey: process.env.OPENROUTER_API_KEY,
			groqApiKey: process.env.GROQ_API_KEY,
		};

		const validKeys = Object.fromEntries(
			Object.entries(defaultKeys).filter(([, value]) => value)
		) as UserApiKeys;

		if (Object.keys(validKeys).length > 0) {
			await credentialStore.storeUserApiKeys(userId, validKeys);
			console.log(`[CredentialService] Initialized default API keys for user ${userId}`);
		}
	},
};

// src/server/credential/credentialService.ts

import { chromaDbClient } from '../db/chromaDbClient.js';
import { encrypt, decrypt } from '../util/cryptoUtils.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { Collection } from 'chromadb';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { buildCredentialId } from '#shared/util/buildIdUtils.js';

export interface UserApiKeys {
	openaiApiKey?: string;
	anthropicApiKey?: string;
	googleApiKey?: string;
	openrouterApiKey?: string;
	groqApiKey?: string;
}
const { getCredentialCollection, getRecordById, getRecords } = chromaDbClient;
const collectionType = COLLECTIONS.CREDENTIAL;

export const credentialStore = {
	_credentialCollection: null as Collection | null,

	// Get collection with caching
	_getCollection: async (): Promise<Collection> => {
		// First check if it's in the cache (non-async operation)
		if (credentialStore._credentialCollection) {
			return credentialStore._credentialCollection;
		}

		// If not in cache, fetch it (async operation)
		const collection = await getCredentialCollection();
		credentialStore._credentialCollection = collection;
		return collection;
	},

	/**
	 * Stores encrypted API keys for a user
	 */
	storeUserApiKeys: async (userId: string, apiKeys: UserApiKeys): Promise<void> => {
		try {
			const collection = await credentialStore._getCollection();
			const credentialId = buildCredentialId(userId);

			// Encrypt sensitive data
			const encryptedKeys: Record<string, string> = {};
			for (const [key, value] of Object.entries(apiKeys)) {
				if (value) {
					encryptedKeys[key] = encrypt(value);
				}
			}

			const secretDocument = JSON.stringify(encryptedKeys);

			await chromaDbClient.upsertRecord(collection, credentialId, secretDocument, {
				userId,
				type: METADATA_TYPES.CREDENTIAL,
				keyType: 'api_keys',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			});

			console.log(`[CredentialService] Successfully stored API keys for user ${userId}`);
		} catch (error) {
			console.error(`[CredentialService] Failed to store API keys for user ${userId}:`, error);
			throw error;
		}
	},

	/**
	 * Retrieves and decrypts API keys for a user
	 */
	getUserApiKeys: async (userId: string): Promise<UserApiKeys> => {
		try {
			const collection = await credentialStore._getCollection();
			const credentialId = buildCredentialId(userId);

			const result = await chromaDbClient.getRecordById(collection, credentialId);

			if (!result.documents || result.documents.length === 0) {
				console.warn(`[CredentialService] No API keys found for user ${userId}`);
				return {};
			}

			const encryptedDocument = result.documents[0];
			if (!encryptedDocument) {
				return {};
			}

			const encryptedKeys = JSON.parse(encryptedDocument);
			const decryptedKeys: UserApiKeys = {};

			// Decrypt each API key
			for (const [key, encryptedValue] of Object.entries(encryptedKeys)) {
				if (typeof encryptedValue === 'string') {
					try {
						decryptedKeys[key as keyof UserApiKeys] = decrypt(encryptedValue);
					} catch (decryptError) {
						console.error(`[CredentialService] Failed to decrypt ${key} for user ${userId}`);
					}
				}
			}

			return decryptedKeys;
		} catch (error) {
			console.error(`[CredentialService] Failed to retrieve API keys for user ${userId}:`, error);
			return {};
		}
	},

	/**
	 * Updates specific API keys for a user
	 */
	updateUserApiKey: async (
		userId: string,
		keyType: keyof UserApiKeys,
		keyValue: string
	): Promise<void> => {
		try {
			const existingKeys = await credentialStore.getUserApiKeys(userId);
			const updatedKeys = { ...existingKeys, [keyType]: keyValue };
			await credentialStore.storeUserApiKeys(userId, updatedKeys);
		} catch (error) {
			console.error(`[CredentialService] Failed to update ${keyType} for user ${userId}:`, error);
			throw error;
		}
	},

	/**
	 * Initializes default API keys from environment variables
	 */
	initializeDefaultApiKeys: async (userId: string): Promise<void> => {
		const defaultKeys: UserApiKeys = {
			openaiApiKey: process.env.OPENAI_API_KEY,
			anthropicApiKey: process.env.ANTHROPIC_API_KEY,
			googleApiKey: process.env.GOOGLE_API_KEY,
			openrouterApiKey: process.env.OPENROUTER_API_KEY,
			groqApiKey: process.env.GROQ_API_KEY,
		};

		// Filter out undefined values
		const validKeys: UserApiKeys = {};
		for (const [key, value] of Object.entries(defaultKeys)) {
			if (value) {
				validKeys[key as keyof UserApiKeys] = value;
			}
		}

		if (Object.keys(validKeys).length > 0) {
			await credentialStore.storeUserApiKeys(userId, validKeys);
			console.log(`[CredentialService] Initialized default API keys for user ${userId}`);
		}
	},
};

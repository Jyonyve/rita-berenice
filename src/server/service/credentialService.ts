import { chromaDbClient } from '#server/db/index.ts';
import { SECRET_DOC_ID } from '#root/src/shared/index.ts';
import type { Collection } from 'chromadb'; // Use Collection type
import { decrypt, encrypt } from '../util/cryptoUtils.ts';

const { getCredentialCollection, upsertDocument, getDocumentById } = chromaDbClient;

export const credentialService = {
	// Internal cache for the secret collection
	_credentialCollection: null as Collection | null,

	// Private helper to get/cache the collection
	_getCollection: async (): Promise<Collection> => {
		// Check cache first
		if (credentialService._credentialCollection) {
			return credentialService._credentialCollection;
		}
		// Fetch and cache if not found
		const collection = await getCredentialCollection(); // Use the basic getter
		credentialService._credentialCollection = collection;
		return collection;
	},

	saveUserSecret: async (secretData: Record<string, any>): Promise<void> => {
		if (!secretData) {
			throw new Error('Cannot save null or undefined secret data.');
		}

		let encryptedContent: string;
		try {
			const stringifiedData = JSON.stringify(secretData);
			encryptedContent = encrypt(stringifiedData); // Encrypt the JSON string
		} catch (error) {
			console.error('Error during secret encryption:', error);
			throw new Error('Failed to prepare secrets for saving.');
		}

		try {
			const collection = await credentialService._getCollection();
			// Use the generic upsertDocument method directly
			await upsertDocument(
				collection,
				SECRET_DOC_ID, // Use the fixed ID
				encryptedContent, // The encrypted string is the document content
				{
					// Metadata for the secret document
					type: 'user_secret_bundle',
					lastUpdated: new Date().toISOString(),
				}
				// No embedding needed for secrets
			);
			console.info(`Secret document (ID: ${SECRET_DOC_ID}) saved successfully.`);
		} catch (error) {
			console.error(`Failed to save secret document (ID: ${SECRET_DOC_ID}) to database:`, error);
			// Clear cache on error? Maybe not, collection might still be valid.
			throw new Error('Failed to save secrets to the database.');
		}
	},

	getUserSecret: async (): Promise<Record<string, any> | null> => {
		let encryptedContent: string | null = null;
		try {
			const collection = await credentialService._getCollection();
			// Use the generic getDocumentById method directly
			encryptedContent = await getDocumentById(collection, SECRET_DOC_ID);
		} catch (error) {
			// Catch errors during collection getting or document fetching
			console.error(`Error retrieving secret document (ID: ${SECRET_DOC_ID}) from DB:`, error);
			// Don't proceed if DB access fails
			return null;
		}

		// Check if the document was found
		if (!encryptedContent) {
			console.info(`No secret document found with ID: ${SECRET_DOC_ID}. User may need to initialize.`);
			return null; // No secret stored yet or retrieval failed silently before
		}

		// Try to decrypt and parse
		try {
			const decryptedContent = decrypt(encryptedContent); // Decrypt the raw content
			// Decrypt function should handle errors or return indicator of failure
			if (!decryptedContent) {
				console.error(
					`Failed to decrypt content for secret document (ID: ${SECRET_DOC_ID}). Key might be wrong or data corrupted.`
				);
				return null; // Avoid parsing if decryption failed
			}
			return JSON.parse(decryptedContent); // Parse the decrypted JSON
		} catch (error) {
			// This catches errors from decrypt() throwing or JSON.parse() failing
			console.error(
				`Failed to decrypt or parse retrieved secret document (ID: ${SECRET_DOC_ID}):`,
				error
			);
			// It's safer to return null than potentially malformed/partially decrypted data
			return null;
		}
	},

	/**
	 * Loads secrets from the database into process.env.
	 * Call this early in your application startup.
	 */
	loadSecretsIntoEnv: async (): Promise<void> => {
		console.log('Attempting to load secrets into environment...');
		const secrets = await credentialService.getUserSecret();

		if (secrets) {
			console.log('Secrets retrieved, setting environment variables...');
			for (const [key, value] of Object.entries(secrets)) {
				if (value !== null && value !== undefined) {
					// Handle nested objects like BEDROCK_CONFIG if you stored them that way
					if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
						console.log(`Processing nested secret object: ${key}`);
						for (const [nestedKey, nestedValue] of Object.entries(value)) {
							if (nestedValue !== null && nestedValue !== undefined) {
								process.env[nestedKey] = String(nestedValue);
							}
						}
					} else {
						process.env[key] = String(value); // Ensure it's a string
					}
				}
			}
			console.log('Environment variables set from stored secrets.');
		} else {
			console.warn(
				'No secrets found or failed to load secrets. Application might rely on default environment variables or require initialization.'
			);
		}
	},

	/**
	 * Method to clear the internal collection cache.
	 */
	clearCollectionCache: (): void => {
		credentialService._credentialCollection = null;
		console.log('Credential service collection cache cleared.');
	},
};

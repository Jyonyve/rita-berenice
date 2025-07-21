import type { Collection } from 'chromadb';
import { decrypt, encrypt } from './cryptoUtils.js';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { supportAiModelInfo } from '#shared/config/supportAiModelInfo.js';

/* User secret storing key */
export const SECRET_DOC_ID = 'user_api_keys' as const;
const { getCredentialCollection, upsertRecord, getRecordById } = chromaDbClient;

// Define the structure for stored credentials
interface UserCredentials {
	openrouter?: { apiKey: string; supportedProviders: string[] };
	direct?: {
		openai?: { apiKey: string; organization?: string; project?: string };
		anthropic?: { apiKey: string };
		google?: { apiKey: string };
	};
	lastUpdated: string;
	version: string;
}

export const credentialService = {
	_credentialCollection: null as Collection | null,

	_getCollection: async (): Promise<Collection> => {
		if (credentialService._credentialCollection) {
			return credentialService._credentialCollection;
		}
		const collection = await getCredentialCollection();
		credentialService._credentialCollection = collection;
		return collection;
	},

	/**
	 * Saves user credentials with validation for supported providers
	 */
	saveUserCredentials: async (credentials: Partial<UserCredentials>): Promise<void> => {
		if (!credentials || Object.keys(credentials).length === 0) {
			throw new Error('Cannot save empty or invalid credentials.');
		}

		// Validate credentials structure
		const validatedCredentials: UserCredentials = {
			...credentials,
			lastUpdated: new Date().toISOString(),
			version: '1.0',
		};

		// Validate that provided credentials match supported providers
		if (validatedCredentials.openrouter) {
			const { supportedProviders } = validatedCredentials.openrouter;
			if (supportedProviders) {
				const validProviders = Object.keys(supportAiModelInfo.openrouter);
				const invalidProviders = supportedProviders.filter((p) => !validProviders.includes(p));
				if (invalidProviders.length > 0) {
					console.warn(`Invalid OpenRouter providers: ${invalidProviders.join(', ')}`);
				}
			}
		}

		if (validatedCredentials.direct) {
			const directProviders = Object.keys(validatedCredentials.direct);
			const validDirectProviders = Object.keys(supportAiModelInfo.direct);
			const invalidDirectProviders = directProviders.filter((p) => !validDirectProviders.includes(p));
			if (invalidDirectProviders.length > 0) {
				console.warn(`Invalid direct providers: ${invalidDirectProviders.join(', ')}`);
			}
		}

		try {
			const stringifiedData = JSON.stringify(validatedCredentials);
			const encryptedContent = encrypt(stringifiedData);

			const collection = await credentialService._getCollection();
			await upsertRecord(collection, SECRET_DOC_ID, encryptedContent, {
				type: 'user_credential_bundle',
				lastUpdated: validatedCredentials.lastUpdated,
				version: validatedCredentials.version,
				hasOpenRouter: !!validatedCredentials.openrouter,
				hasDirect: !!validatedCredentials.direct,
			});
			console.info('User credentials saved successfully.');
		} catch (error) {
			console.error('Failed to save credentials:', error);
			throw new Error('Failed to save credentials to database.');
		}
	},

	/**
	 * Retrieves and validates user credentials
	 */
	getUserCredentials: async (): Promise<UserCredentials | null> => {
		try {
			const collection = await credentialService._getCollection();
			const result = await getRecordById(collection, SECRET_DOC_ID);
			const encryptedContent = result.documents[0];

			if (!encryptedContent) {
				console.info('No credentials found. User needs to initialize.');
				return null;
			}

			const decryptedContent = decrypt(encryptedContent);
			if (!decryptedContent) {
				console.error('Failed to decrypt credentials.');
				return null;
			}

			const credentials = JSON.parse(decryptedContent) as UserCredentials;

			// Validate credential structure
			if (!credentials.version) {
				console.warn('Credentials missing version. May need migration.');
			}

			return credentials;
		} catch (error) {
			console.error('Error retrieving credentials:', error);
			return null;
		}
	},

	/**
	 * Gets API key for a specific provider and platform
	 */
	getApiKey: async (provider: string, platform?: string): Promise<string | null> => {
		const credentials = await credentialService.getUserCredentials();
		if (!credentials) return null;

		try {
			if (provider === 'openrouter') {
				return credentials.openrouter?.apiKey || null;
			}

			if (provider === 'direct' && platform) {
				const directCreds = credentials.direct?.[platform as keyof typeof credentials.direct];
				return directCreds?.apiKey || null;
			}

			return null;
		} catch (error) {
			console.error(`Error getting API key for ${provider}/${platform}:`, error);
			return null;
		}
	},

	/**
	 * Checks if a specific model is available based on stored credentials
	 */
	isModelAvailable: async (provider: string, platform: string, model: string): Promise<boolean> => {
		const credentials = await credentialService.getUserCredentials();
		if (!credentials) return false;

		// Check if the model exists in our support matrix
		const supportedModels = supportAiModelInfo[provider]?.[platform];
		if (!supportedModels?.includes(model)) return false;

		// Check if user has credentials for this provider/platform
		if (provider === 'openrouter') {
			return !!credentials.openrouter?.apiKey;
		}

		if (provider === 'direct') {
			return !!credentials.direct?.[platform as keyof typeof credentials.direct]?.apiKey;
		}

		return false;
	},

	/**
	 * Gets all available models for the user based on their credentials
	 */
	getAvailableModels: async (): Promise<Record<string, Record<string, string[]>>> => {
		const credentials = await credentialService.getUserCredentials();
		if (!credentials) return {};

		const availableModels: Record<string, Record<string, string[]>> = {};

		// Check OpenRouter models
		if (credentials.openrouter?.apiKey) {
			availableModels.openrouter = { ...supportAiModelInfo.openrouter };
		}

		// Check direct provider models
		if (credentials.direct) {
			availableModels.direct = {};
			Object.entries(credentials.direct).forEach(([platform, creds]) => {
				if (creds?.apiKey && supportAiModelInfo.direct[platform]) {
					availableModels.direct[platform] = [...supportAiModelInfo.direct[platform]];
				}
			});
		}

		return availableModels;
	},

	/**
	 * Loads credentials into environment variables with proper naming
	 */
	loadCredentialsIntoEnv: async (): Promise<void> => {
		console.log('Loading AI provider credentials into environment...');
		const credentials = await credentialService.getUserCredentials();

		if (!credentials) {
			console.warn('No credentials found for environment loading.');
			return;
		}

		try {
			// Set OpenRouter credentials
			if (credentials.openrouter?.apiKey) {
				process.env.OPENROUTER_API_KEY = credentials.openrouter.apiKey;
				console.log('✓ OpenRouter API key loaded');
			}

			// Set direct provider credentials
			if (credentials.direct) {
				const { openai, anthropic, google } = credentials.direct;

				if (openai?.apiKey) {
					process.env.OPENAI_API_KEY = openai.apiKey;
					if (openai.organization) process.env.OPENAI_ORGANIZATION = openai.organization;
					if (openai.project) process.env.OPENAI_PROJECT = openai.project;
					console.log('✓ OpenAI credentials loaded');
				}

				if (anthropic?.apiKey) {
					process.env.ANTHROPIC_API_KEY = anthropic.apiKey;
					console.log('✓ Anthropic API key loaded');
				}

				if (google?.apiKey) {
					process.env.GOOGLE_API_KEY = google.apiKey;
					process.env.GEMINI_API_KEY = google.apiKey; // Alternative name
					console.log('✓ Google/Gemini API key loaded');
				}
			}

			console.log('Environment variables set from stored credentials.');
		} catch (error) {
			console.error('Error loading credentials into environment:', error);
		}
	},

	/**
	 * Updates specific provider credentials without affecting others
	 */
	updateProviderCredentials: async (
		provider: string,
		platform: string | null,
		newCredentials: any
	): Promise<void> => {
		const existingCredentials = (await credentialService.getUserCredentials()) || {
			lastUpdated: new Date().toISOString(),
			version: '1.0',
		};

		if (provider === 'openrouter') {
			existingCredentials.openrouter = { ...existingCredentials.openrouter, ...newCredentials };
		} else if (provider === 'direct' && platform) {
			if (!existingCredentials.direct) existingCredentials.direct = {};
			existingCredentials.direct[platform as keyof typeof existingCredentials.direct] = {
				...existingCredentials.direct[platform as keyof typeof existingCredentials.direct],
				...newCredentials,
			};
		}

		await credentialService.saveUserCredentials(existingCredentials);
	},

	clearCollectionCache: (): void => {
		credentialService._credentialCollection = null;
		console.log('Credential service collection cache cleared.');
	},
};

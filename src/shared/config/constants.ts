import { COLLECTIONS } from '../domain/index.ts';

export const ALPHANUMERIC_ALPHABET =
	'0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' as const;
export const BASE_IMAGE_DIR = '/src/client/asset/character';
export const DEFAULT_RECAP_INTERVAL: number = 3 as const;
export const DEFAULT_RELATIONSHIP_RECAP_INTERVAL = 5 as const;
export const DEFAULT_RECENT_TURN_COUNT: number = 10 as const;
export const DEFAULT_LOADING_TURN_COUNT: number = 5 as const;
export const DEFAULT_LOADING_BATCH_TURN_COUNT: number = 20 as const;
export const MAX_LLM_RETRIES = 5;

// Default limit for querying chat logs
export const DEFAULT_QUERY_LIMIT: number = 10 as const;

/* user secret storing key */
export const SECRET_DOC_ID = 'user_api_keys' as const;

export const MODULE_NAMES = { ...COLLECTIONS, LLM: 'llm' } as const;
export type MODULE_TYPES = (typeof MODULE_NAMES)[keyof typeof MODULE_NAMES];

export const ENV_CONSTANTS = {
	VITE_API_URL: 'http://localhost:3000',
	// VITE_APP_ENV: "development",
	VITE_APP_ENV: 'production', // Or "development" in dev mode

	// Langchain
	LANGCHAIN_TRACING_V2: true,
	LANGCHAIN_ENDPOINT: 'https://api.smith.langchain.com',
	// LANGCHAIN_PROJECT: "rita-berenice",

	// SSR Config
	SSR_PORT: 3000,
	SSR_HOST: '0.0.0.0',
};

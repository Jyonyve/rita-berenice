export const ALPHANUMERIC_ALPHABET =
	'0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' as const;
export const RUNTIME_IMAGE_DIR = '/assets/character';
export const DEFAULT_USER_AVATAR = '/assets/user/new_user.webp' as const;
export const DEFAULT_CHARACTER_AVATAR = '/assets/character/new_character.webp' as const;

export const BASE_IMAGE_DIR = `public${RUNTIME_IMAGE_DIR}`;
export const SOURCE_IMAGE_DIR = `/${BASE_IMAGE_DIR}`;
export const ABORT_TIMEOUT = 600 as const; ///300초
export const DEFAULT_RECAP_INTERVAL: number = 3 as const;
export const DEFAULT_RELATIONSHIP_RECAP_INTERVAL = 5 as const;
export const DEFAULT_RECENT_TURN_COUNT: number = 10 as const;
export const DEFAULT_LOADING_TURN_COUNT: number = 5 as const;
export const DEFAULT_LOADING_BATCH_TURN_COUNT: number = 20 as const;
export const RECENT_CHAT_TURN: number = 3 as const;
export const MAX_LLM_RETRIES = 2;
export const REQUEST_CHARACTER_LIMIT = 1000 as const;
export const RESPONSE_CHARACTER_LIMIT = 1000 as const;
export const DEFAULT_TENANT_ID = 'public' as const;
export const NA = 'N/A' as const;
export const APPNAME = 'Rita-Berenice' as const;
export const APPNAME_LOWERCASE = APPNAME.toLowerCase();
export const LIMIT_5MB = 5 * 1024 * 1024;
export const GENDER_OPTIONS = ['male', 'female', 'other', 'no_comment'] as const;
export type GENDER_OPTION = (typeof GENDER_OPTIONS)[number];

// Default limit for querying chat logs
export const DEFAULT_QUERY_LIMIT: number = 10 as const;

export const MODULE_NAMES = {
	CHARACTER: 'character',
	PROFILE: 'profile',
	CHAT: 'chat',
	SESSION: 'session',
	TEMP: 'temp',
	RECAP: 'recap',
	LORE: 'lore',
	TERM: 'term',
	CREDENTIAL: 'credential',
	LLM: 'llm',
	MEMORY: 'memory',
	PERSONA: 'persona',
	ORCHESTRATION: 'orchestration',
	USER: 'user',
	LOGIN: 'login',
} as const;
export type MODULE_TYPES = (typeof MODULE_NAMES)[keyof typeof MODULE_NAMES];

export const METADATA_TYPES = {
	CREDENTIAL: 'credential',
	APIKEY: 'apikey',
	CHARACTER: 'character',
	PROFILE: 'profile',
	SESSION: 'session',
	MESSAGE: 'message',
	TURN: 'turn',
	STORY: 'story',
	RECAP: 'recap',
	RELATIONSHIP: 'relationship',
	LORE: 'lore',
	HISTORY: 'history',
	TEMP: 'temp',
	DOCUMENT: 'document',
	TERM: 'term',
	USER: 'user',
	INDEX: 'index',
} as const;

export type MetadataType = (typeof METADATA_TYPES)[keyof typeof METADATA_TYPES];

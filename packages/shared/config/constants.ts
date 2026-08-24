export const ALPHANUMERIC_ALPHABET =
	'0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ' as const;

export const ABORT_TIMEOUT = 600 as const; ///300초
export const DEFAULT_RECAP_INTERVAL: number = 3 as const;
export const DEFAULT_RELATIONSHIP_RECAP_INTERVAL = 5 as const;
export const DEFAULT_RECENT_TURN_COUNT: number = 10 as const;
export const DEFAULT_LOADING_TURN_COUNT: number = 5 as const;
export const DEFAULT_LOADING_BATCH_TURN_COUNT: number = 20 as const;
export const RECENT_CHAT_TURN: number = 3 as const;
export const MAX_LLM_RETRIES = 2;
export const REQUEST_CHARACTER_LIMIT = 1500 as const;
export const RESPONSE_EDIT_CHARACTER_LIMIT = 5000 as const;
export const DEFAULT_TENANT_ID = 'public' as const;
export const NA = 'N/A' as const;
export const APPNAME = 'Rita-Berenice' as const;
export const APPNAME_LOWERCASE = APPNAME.toLowerCase();
export const LIMIT_5MB = 5 * 1024 * 1024;
export const GENDER_OPTIONS = ['male', 'female', 'other', 'nocomment'] as const;
export type GENDER_OPTION = (typeof GENDER_OPTIONS)[number];

// Character exposure: 'private' characters are visible only to their registering owner;
// 'public' characters are visible to every authenticated user.
export const CHARACTER_VISIBILITY = { PRIVATE: 'private', PUBLIC: 'public' } as const;
export type CharacterVisibility = (typeof CHARACTER_VISIBILITY)[keyof typeof CHARACTER_VISIBILITY];
export const DEFAULT_CHARACTER_VISIBILITY: CharacterVisibility = CHARACTER_VISIBILITY.PUBLIC;

// Whether {{DIRECTION_TOKEN}} markers in generated chat text are localized into display labels.
export const DEFAULT_LOCALIZE_DIRECTIONS = true as const;

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
	HISTORY: 'history',
	TERM: 'term',
	CREDENTIAL: 'credential',
	LLM: 'llm',
	MEMORY: 'memory',
	PERSONA: 'persona',
	ORCHESTRATION: 'orchestration',
	USER: 'user',
	DOCUMENT: 'document',
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
	WORLD: 'world',
} as const;

export type MetadataType = (typeof METADATA_TYPES)[keyof typeof METADATA_TYPES];

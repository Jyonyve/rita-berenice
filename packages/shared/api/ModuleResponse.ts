import { EmotionValue, PortraitUrlMap } from '../config/emotionConstants.js';
import { LangCode } from '../config/langConstants.js';
import {
	CharacterInfo,
	CharacterTermInfo,
	ChatTurn,
	DisplayTurn,
	HistoryInfo,
	LoreInfo,
	ProfileInfo,
	RecapInfo,
	SessionInfo,
	SessionTermInfo,
	TempChatTurn,
	UserInfo,
	ValidationResult,
	ChatEntry,
	ApiKeyType,
	DocumentInfo,
} from '../domain/index.js';

export interface ApiErrorResponse {
	status: 'error'; // Literal string to indicate an error response
	code: number; // The HTTP status code
	message: string; // The client-friendly error message
	debug?: string; // Optional: for development, the original internal error message
	details?: any;
}

export type Metadata = Record<string, string | number | boolean | null>;

/**
 * Standard ChromaDB response format used across all modules.
 * Compatible with ChromaDB v2+ GetResult and QueryResult after type conversion.
 */
export type ChromaResponse = {
	ids: string[];
	metadatas: (Metadata | null)[];
	documents: (string | null)[];
	distances?: (number | null)[] | null | undefined;
};

// Response types using type intersection for better TypeScript compatibility
export type CharacterResponse = ChromaResponse & {
	characterInfo: CharacterInfo;
	characterInfos: CharacterInfo[];
	characterPortraits: Record<string, PortraitUrlMap>;
	characterAvatars: Record<string, PortraitUrlMap>;
};

export type ProfileResponse = ChromaResponse & {
	profileInfo: ProfileInfo;
	profileInfos: ProfileInfo[];
	profilePortraits: Record<string, string>;
	profileAvatars: Record<string, string>;
};

export type ChatResponse = ChromaResponse & { chatTurns: ChatTurn[]; displayTurns: DisplayTurn[] };

export type TempChatResponse = ChromaResponse & {
	tempChatTurns: TempChatTurn[];
	tempChatTurn: TempChatTurn;
};

export type LoreResponse = ChromaResponse & {
	loreInfo: LoreInfo;
	loreContent: string;
	loreInfos: LoreInfo[];
	loreContents: string[];
};

export type HistoryResponse = ChromaResponse & {
	historyInfo: HistoryInfo;
	historyContent: string;
	historyInfos: HistoryInfo[];
	historyContents: string[];
	historyImageUrls: Record<string, string>;
};

export type RecapResponse = ChromaResponse & {
	recapInfo: RecapInfo;
	recapInfos: RecapInfo[];
	recapContent: string;
	recapContents: string[];
};

export type TermResponse = ChromaResponse & {
	term: Term;
	terms: Term[];
	characterTermInfos: CharacterTermInfo[];
	sessionTermInfos: SessionTermInfo[];
};

export type Term = Pick<
	CharacterTermInfo | SessionTermInfo,
	'koreanTerm' | 'englishTerm' | 'termId' | 'type'
>;

export type MemoryResponse = {
	langCode: LangCode;
	shortTermHistory: ChatTurn[]; // Last 5-10 turns
	longTermHistory: ChatTurn[]; // Semantically relevant past turns
	relevantLore: LoreInfo[];
	relevantHistory: HistoryInfo[];
	relevantDocuments?: DocumentInfo[];
	relevantRecaps?: RecapInfo[];
	factualRecapSummary?: string;
	relationshipRecapSummary?: string;
};

export type PersonaResponse = { response: string; emotion: EmotionValue };

export type UserResponse = ChromaResponse & { userInfo: UserInfo; userInfos: UserInfo[] };

export type SessionResponse = ChromaResponse & {
	sessionInfo: SessionInfo;
	sessionInfos: SessionInfo[];
};

export type CredentialMetadataResponse = { configuredKeyTypes: ApiKeyType[] };

export type CredentialValidationResponse = { validationResults: Record<string, ValidationResult> };

export type ModelCatalogEntry = {
	id: string;
	name: string;
	platform: 'openrouter' | 'direct';
	provider: 'openai' | 'anthropic' | 'google';
	contextWindow: number;
	maxOutputTokens: number;
	recommendedOutputTokens: number;
	supportsTemperature: boolean;
	source: 'live' | 'fallback';
};

export type ModelCatalogResponse = {
	models: ModelCatalogEntry[];
	refreshedAt: string;
	source: 'live' | 'fallback';
};

export type DocumentResponse = { documentInfo: DocumentInfo; documentInfos: DocumentInfo[] };

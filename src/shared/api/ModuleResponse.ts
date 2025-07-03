import { HistoryInfo, LoreInfo } from '../domain/lore/LoreInterfaces.js';
import { LangCode } from '../config/constants.js';
import { EmotionValue } from '../config/emotionWordsMapper.js';
import { CharacterInfo } from '../domain/character/CharacterInterfaces.js';
import { ChatTurn } from '../domain/chat/ChatInterfaces.js';
import { RecapInfo } from '../domain/recap/RecapInterfaces.js';
import { TermInfo } from '../domain/term/TermInterfaces.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { UserInfo } from '../domain/user/UserInterfaces.js';

export interface ApiErrorResponse {
	status: 'error'; // Literal string to indicate an error response
	code: number; // The HTTP status code
	message: string; // The client-friendly error message
	debug?: string; // Optional: for development, the original internal error message
	details?: any;
	// You could add other fields like 'errors: Record<string, string>[]' for validation errors
}

export type Metadata = Record<string, string | number | boolean | null>;

export type ChromaResponse = {
	ids: string[];
	metadatas: (Metadata | null)[];
	documents: (string | null)[];
};

//character
interface CharacterChromaResponse extends ChromaResponse {
	characterInfo: CharacterInfo;
	characterInfos: CharacterInfo[];
}
export type CharacterResponse = CharacterChromaResponse;

// profile
interface ProfileChromaResponse extends ChromaResponse {
	profileInfo: ProfileInfo;
	profileInfos: ProfileInfo[];
}

export type ProfileResponse = ProfileChromaResponse;

// Chat
interface ChatChromaResponse extends ChromaResponse {
	chatTurns: ChatTurn[];
	chatTurn: ChatTurn;
}
export type ChatResponse = ChatChromaResponse;

// Lore
interface LoreChromaResponse extends ChromaResponse {
	lore: LoreInfo;
	loreContent: string;
	lores: LoreInfo[];
	loreContents: string[];
}
export type LoreResponse = LoreChromaResponse;

interface HistoryChromaResponse extends ChromaResponse {
	history: HistoryInfo;
	historyContent: string;
	histories: HistoryInfo[];
	historyContents: string[];
}
export type HistoryResponse = HistoryChromaResponse;

// recap
interface RecapChromaResponse extends ChromaResponse {
	recapInfo: RecapInfo;
	recapInfos: RecapInfo[];
	recapContent: string;
	recapContents: string[];
}
export type RecapResponse = RecapChromaResponse;

// term
interface TermChromaResponse extends ChromaResponse {
	term: Term;
	terms: Term[];
	termInfo: TermInfo;
	termInfos: TermInfo[];
}
export type TermResponse = TermChromaResponse;
export type Term = Pick<TermInfo, 'koreanTerm' | 'englishTerm' | 'termId'>;

interface MemoryLlmResponse {
	langCode: LangCode;
	shortTermHistory: ChatTurn[]; // Last 5-10 turns
	longTermHistory: ChatTurn[]; // Semantically relevant past turns
	relevantLore: LoreInfo[];
	relevantHistory: HistoryInfo[];
	factualRecapSummary?: string; // Changed from RecapInfo
	relationshipRecapSummary?: string; // Changed from RecapInfo
}

export type MemoryResponse = MemoryLlmResponse;

interface PersonaLlmResponse {
	response: string;
	emotion: EmotionValue;
}

export type PersonaResponse = PersonaLlmResponse;

// profile
interface UserChromaResponse extends ChromaResponse {
	userInfo: UserInfo;
	userInfos: UserInfo[];
}

export type UserResponse = UserChromaResponse;

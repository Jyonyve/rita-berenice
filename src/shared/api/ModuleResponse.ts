import { GetResponse } from 'chromadb';
import {
	CharacterInfo,
	ChatMessageType,
	ChatTurn,
	ProfileInfo,
	RecapInfo,
	RecapResult,
	TermInfo,
} from '../domain/index.ts';
import { HistoryInfo, LoreInfo } from '../domain/lore/LoreInterfaces.ts';
// File: shared/api/ApiInterfaces.ts

export interface ApiErrorResponse {
	status: 'error'; // Literal string to indicate an error response
	code: number; // The HTTP status code
	message: string; // The client-friendly error message
	debug?: string; // Optional: for development, the original internal error message
	details?: any;
	// You could add other fields like 'errors: Record<string, string>[]' for validation errors
}

export type ChromaResponse = Pick<GetResponse, 'ids' | 'metadatas' | 'documents'>;
export type AllResponse =
	| CharacterResponse
	| ProfileResponse
	| ChatResponse
	| LoreResponse
	| HistoryResponse;

//character
interface CharacterChromaResponse extends ChromaResponse {
	basicCharacterInfo?: CharacterInfo;
	basicCharacterInfos: CharacterInfo[];
}
export type CharacterResponse = CharacterChromaResponse;

// profile
interface ProfileChromaResponse extends ChromaResponse {
	basicProfileInfo?: ProfileInfo;
	basicProfileInfos: ProfileInfo[];
}

export type ProfileResponse = ProfileChromaResponse;

// Chat
interface ChatChromaResponse extends ChromaResponse {
	chatTurns: ChatTurn[];
	chatTurn?: ChatTurn;
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

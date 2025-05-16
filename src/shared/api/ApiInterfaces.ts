import { GetResponse } from 'chromadb';
import { ChatMessageType, ChatTurn } from '../domain/index.ts';
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
export type AllResponse = CharacterResponse | ProfileResponse;

//character
export interface BasicCharacterInfo {
	characterId: string;
	showName: string;
	description: string;
	instruction: string;
	updatedAt: string;
}
interface CharacterChromaResponse extends ChromaResponse {
	basicCharacterInfo?: BasicCharacterInfo;
	basicCharacterInfos: BasicCharacterInfo[];
}
export type CharacterResponse = CharacterChromaResponse;

// profile
export interface BasicProfileInfo {
	profileId: string;
	showName: string;
	description: string;
}

interface ProfileChromaResponse extends ChromaResponse {
	basicProfileInfo?: BasicProfileInfo;
	basicProfileInfos: BasicProfileInfo[];
}

export type ProfileResponse = ProfileChromaResponse;

// Chat
export interface QueryChatLogsApiRequest {
	// Define a more specific request body type for this route
	sessionId: string;
	queryText: string;
	messageType: ChatMessageType; // Service handles 'both' or array
	limit?: number;
}
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
	histrories: HistoryInfo[];
	historyContents: string[];
}
export type HistoryResponse = HistoryChromaResponse;

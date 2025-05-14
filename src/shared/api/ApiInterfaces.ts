import { GetResponse } from 'chromadb';
import { ChatMessageType, ChatTurn } from '../domain/index.ts';
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

interface ChatChromaResponse extends ChromaResponse {
	chatTurns: ChatTurn[];
	chatTurn?: ChatTurn;
}

export type ChatResponse = ChatChromaResponse;

// chat
export interface QueryChatLogsRequest {
	sessionId: string;
	queryText: string;
	messageType?: ChatMessageType;
	limit?: number;
}

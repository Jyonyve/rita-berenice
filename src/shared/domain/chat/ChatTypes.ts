import { DefaultAiRole } from '../index.ts';

export type ChatType = 'dialogue' | 'action';

type DefaultChatEntry = { type: ChatType; prompt: string };
export type ChatEntry = DefaultChatEntry; // expand if needed

export type ChatMessageType = 'request' | 'response';
export type ChatMessageSet = { request: ChatMessage; response: ChatMessage };

export interface ChatMessage {
	role: ChatRoleType;
	messageId: string;
	messageType: ChatMessageType;
	entries: ChatEntry[];
	timestamp: string; // ISO 8601 format
}

export interface ChatTurn {
	sessionId: string;
	sequence: number;
	request: ChatMessage;
	response: ChatMessage;
}

export interface TempChatTurn {
	sessionId: string;
	sequence: number;
	chatTurnSets: ChatMessageSet[];
}

export type ChatSession = { sessionId: string; conversations: ChatTurn[] };

export const SUFFIX = {
	REQUEST: 'request',
	RESPONSE: 'response',
	FULL: 'full',
	RECAP: 'recap',
	SUMMARY: 'summary',
	TEMP: 'temp',
} as const;

export type ChatRoleType = DefaultAiRole;
export type SuffixType = (typeof SUFFIX)[keyof typeof SUFFIX];

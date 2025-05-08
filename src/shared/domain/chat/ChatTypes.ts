import { allEmotionKeywordsList } from '../../config/index.ts';
import { DefaultAiRole } from '../index.ts';

export type ChatType = 'dialogue' | 'action';
export type ChatRoleType = DefaultAiRole;

type DefaultChatEntry = { type: ChatType; prompt: string };
export type ChatEntry = DefaultChatEntry; // expand if needed

export type ChatMessageType = 'request' | 'response';
export type ChatMessageSet = { request: ChatMessage; response: ChatMessage };

export interface ChatMessage {
	role: ChatRoleType;
	messageId: string;
	messageType: ChatMessageType;
	entries: ChatEntry[];
	showName: string;
	timestamp: string; // ISO 8601 format
	emotion: (typeof allEmotionKeywordsList)[number];
	model?: string;
}

export interface MigChatMessage {
	uuid: string;
	role: ChatRoleType;
	content: string;
	timestamp: string;
	showName?: string;
	emotion?: string;
	model?: string;
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
	SET: 'set',
	RELATIONSHIP: 'relationship',
	RECAP: 'recap',
	LORE: 'lore',
	TEMP: 'temp',
} as const;

export type SuffixType = (typeof SUFFIX)[keyof typeof SUFFIX];

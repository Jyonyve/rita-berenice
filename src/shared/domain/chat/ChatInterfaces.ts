import { allEmotionKeywordsList } from '../../config/index.ts';
import { DefaultAiRole } from '../index.ts';
import { METADATA_TYPES, MetadataType } from '../chromadb/index.ts';

export type ChatType = 'dialogue' | 'action';
export type ChatRoleType = DefaultAiRole;

type DefaultChatEntry = { type: ChatType; prompt: string };
export type ChatEntry = DefaultChatEntry; // expand if needed

export type ChatMessageType = 'request' | 'response';
export type ChatMessageSet = { request: ChatMessage; response: ChatMessage };

export interface ChatMessageMetadata {
	sessionId: string;
	sequence: number;
	messageType: ChatMessageType;
	role: ChatRoleType;
	showName: string;
	messageId: string;
	timestamp: string; // ISO 8601 format
	emotion: (typeof allEmotionKeywordsList)[number];
	type: typeof METADATA_TYPES.MESSAGE;
}
export interface ChatMessage extends ChatMessageMetadata {
	entries: ChatEntry[];
	model?: string;
}

export interface MigChatMessage {
	uuid: string;
	role: ChatRoleType;
	messageType: ChatMessageType;
	content: string;
	timestamp: string;
	showName?: string;
	emotion?: string;
	model?: string;
}

export interface ChatTurnMetadata {
	sessionId: string;
	sequence: number;
	chatTurnId: string;
	requestMessageId: string;
	responseMessageId: string;
	createdAt: string; // ISO 8601 format, dont record updatedAt as sequence fix the order, createdAt is just for information
	type: typeof METADATA_TYPES.TURN;
}

export interface ChatTurn extends ChatTurnMetadata {
	request: ChatMessage;
	response: ChatMessage;
}

export interface TempChatTurn {
	sessionId: string;
	sequence: number;
	chatTurnSets: ChatMessageSet[];
	type: typeof METADATA_TYPES.TEMP;
}

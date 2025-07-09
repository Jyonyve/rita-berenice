import { METADATA_TYPES, MetadataType } from '#shared/config/constants.js';
import { allEmotionKeywordsList } from '../../config/emotionWordsMapper.js';
import { DefaultAiRole } from '../aimodel/AiInfoTypes.js';

export type ChatRoleType = DefaultAiRole;
export type ChatEntry = { type: 'dialogue' | 'action'; prompt: string };
export type ChatMessageType = 'request' | 'response';
export type ChatMessageSet = { request: ChatMessage; response: ChatMessage; setNo: number };

// --- UNIFIED BASE METADATA ---
interface ChatBaseMetadata {
	// Core identification (consistent across all types)
	sessionId: string;
	characterId: string; // Added to all for consistency
	userId: string;
	profileId: string;
	type: MetadataType;

	// Timestamps (consistent format)
	createdAt: string; // ISO 8601 format
	updatedAt: string; // ISO 8601 format

	// Content categorization (unified approach)
	keywords: string;
	topics: string;
	entities: string;

	// Sequence/ordering (where applicable)
	sequence: number;
}

export type ChatBaseMetadataType = ChatBaseMetadata;

export interface ChatMessageMetadata {
	sessionId: string;
	sequence: number;
	messageType: ChatMessageType;
	role: ChatRoleType;
	showName: string;
	messageId: string;
	createdAt: string; // ISO 8601 format
	updatedAt: string; // ISO 8601 format
	emotion: (typeof allEmotionKeywordsList)[number];
	type: typeof METADATA_TYPES.MESSAGE;
}

export interface ChatMessage extends ChatMessageMetadata {
	entries: ChatEntry[];
	model?: string;
}

// src/shared/domain/ChatInterfaces.ts

// This is what gets stored in ChromaDB (all primitives)
export interface ChatTurnMetadata extends ChatBaseMetadata {
	chatTurnId: string;
	requestMessageId: string;
	responseMessageId: string;
	type: typeof METADATA_TYPES.TURN;

	// LLM-generated enrichment (ChromaDB-compatible - all primitives)
	summary: string;

	// Arrays stored as comma-separated strings
	keywords: string; // "keyword1,keyword2,keyword3"
	topics: string; // "topic1,topic2,topic3"
	entities: string; // "character:Tarion,location:Forest"

	// Emotion objects flattened to primitives
	userEmotionPrimary: string;
	userEmotionIntensity: number;
	userEmotionNuances: string; // "frustrated,curious"
	characterEmotionPrimary: string;
	characterEmotionIntensity: number;
	characterEmotionNuances: string; // "defensive,hurt"

	// Other fields as strings
	dialogueAct: string;
	actions: string; // "action1,action2"
	relationshipShifts: string; // "Tarion-User:trust_increased"
	flags: string; // "flag1,flag2,flag3"
	memoryChunk: string;

	// Complex objects as JSON strings
	loreReferences: string; // JSON.stringify([{id, relevance}])
	historyReferences: string; // JSON.stringify([{id, relevance}])
}

// This is what your application works with (rich objects)
// In your ChatInterfaces.ts, update the ChatTurn interface:

export interface ChatTurn
	extends Omit<
		ChatTurnMetadata,
		| 'keywords'
		| 'topics'
		| 'entities'
		| 'userEmotionPrimary'
		| 'userEmotionIntensity'
		| 'userEmotionNuances'
		| 'characterEmotionPrimary'
		| 'characterEmotionIntensity'
		| 'characterEmotionNuances'
		| 'actions'
		| 'relationshipShifts'
		| 'flags'
		| 'loreReferences'
		| 'historyReferences'
	> {
	// Rich metadata for application use
	keywords: string[];
	topics: string[];
	entities: string[];
	userEmotion: { primary: string; intensity: number; nuances: string[] };
	characterEmotion: { primary: string; intensity: number; nuances: string[] };
	actions: string[];
	relationshipShifts: string[];
	flags: string[];
	loreReferences: Array<{ id: string; relevance: number }>;
	historyReferences: Array<{ id: string; relevance: number }>;

	// Full message objects
	request: ChatMessage;
	response: ChatMessage;
}

export type ChatTurnCdo = Pick<
	ChatTurn,
	'userId' | 'sessionId' | 'sequence' | 'request' | 'response'
>;

export interface MigChatMessage {
	uuid: string;
	role: ChatRoleType;
	messageType: ChatMessageType;
	content: string;
	createdAt: string;
	updatedAt: string;
	name: string;
	showName: string;
	emotion: string;
	model?: string;
}

export interface TempChatTurnMetadata {
	type: typeof METADATA_TYPES.TEMP;
	sequence: number;
	sessionId: string;
	userId: string;
	tempTurnId: string;
	createdAt: string;
	updatedAt: string;
	setCount: number;
	fixedSetNo: number; // if none of them fixed, default -1
}

export interface TempChatTurn extends TempChatTurnMetadata {
	chatTurnSets: ChatMessageSet[];
}

export type TempChatTurnCdo = Pick<TempChatTurn, 'sessionId' | 'sequence' | 'userId'> & {
	userInput: string;
};

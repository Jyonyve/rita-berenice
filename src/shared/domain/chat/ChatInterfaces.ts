import { METADATA_TYPES, MetadataType } from '#shared/config/constants.js';
import { allEmotionKeywordsList, EmotionValue } from '../../config/emotionWordsMapper.js';
import { DefaultAiRole } from '../aimodel/AiInfoTypes.js';
import { Reference } from '../BaseTypes.js';

export type ChatRoleType = DefaultAiRole;
export type ChatEntry = { type: 'dialogue' | 'action'; prompt: string };
export type ChatMessageType = 'request' | 'response';
export type ChatMessageSet = { request: ChatMessage; response: ChatMessage; setNo: number };

export interface ChatMessageMetadata {
	sessionId: string;
	sequence: number;
	messageType: ChatMessageType;
	role: ChatRoleType;
	showName: string;
	messageId: string;
	createdAt: string; // ISO 8601 format
	updatedAt: string; // ISO 8601 format
	emotion: EmotionValue;
	type: typeof METADATA_TYPES.MESSAGE;
	model: string;
}

export interface ChatMessage extends ChatMessageMetadata {
	entries: ChatEntry[];
}

/**
 * Defines the possible values for the 'contentType' of a search index record.
 * This specifies what kind of attribute the index entry represents.
 */
export type ChatIndexContentType =
	| 'KEYWORD'
	| 'TOPIC'
	| 'ENTITY'
	| 'ACTION'
	| 'FLAG'
	| 'RELATIONSHIP_SHIFT'
	| 'USER_EMOTION_NUANCE'
	| 'CHARACTER_EMOTION_NUANCE';

// --- 1. The Primary Document Metadata ---
/**
 * The final, lean metadata structure for a primary ChatTurn document.
 * It contains NO array-like data intended for searching.
 */
export interface ChatTurnMetadata {
	type: typeof METADATA_TYPES.TURN;
	chatTurnId: string;

	// Core identifiers and timestamps
	sessionId: string;
	characterId: string;
	userId: string;
	profileId: string;
	sequence: number;
	createdAt: string;
	updatedAt: string;

	// The original message objects for perfect reconstruction
	requestJson: string;
	responseJson: string;

	// Key LLM-generated fields
	summary: string;
	memoryChunk: string;
	dialogueAct: string;

	// Flattened primary emotion data and nuanceList
	userEmotionPrimary: string;
	userEmotionIntensity: number;
	characterEmotionPrimary: string;
	characterEmotionIntensity: number;

	// Post-retrieval context (not used for searching)
	loreReferenceList: string;
	historyReferenceList: string;
}

// --- 2. The Search Index Metadata ---
/**
 * The single, unified metadata structure for all search index records.
 */
// File: src/shared/domain/chat/ChatInterfaces.ts
export interface ChatIndexMetadata {
	type: typeof METADATA_TYPES.INDEX;
	contentType: ChatIndexContentType;
	chatTurnId: string;
	value: string;
	sessionId: string;
	characterId: string;
	originalCreatedAt: string;
	semanticContext: string; // Context description for semantic understanding

	// Enhanced emotion metadata properties
	emotionCategory: string; // For emotion-related indexes (mapped category)
	emotionIntensity: number; // For emotion-related indexes (0.0-1.0)
	emotionType: 'primary' | 'nuance'; // Whether this is primary emotion or nuance
	tokenCount: number; // For monitoring and optimization
}

// --- 3. The Application-Level Rich Object ---
// This interface remains unchanged. It's the rich object your application code works with.
// The service layer is responsible for fetching the ChatTurnMetadata and then, if needed,
// its associated search index entries to reconstruct these arrays.
export interface ChatTurn
	extends Omit<
		ChatTurnMetadata,
		| 'loreReferenceList'
		| 'historyReferenceList'
		| 'requestJson'
		| 'responseJson'
		| 'userEmotionPrimary'
		| 'userEmotionIntensity'
		| 'characterEmotionPrimary'
		| 'characterEmotionIntensity'
	> {
	keywordList: string[];
	topicList: string[];
	entityList: string[];
	actionList: string[];
	flagList: string[];
	relationshipShiftList: string[];

	userEmotion: { primary: string; intensity: number; nuanceList: string[] };
	characterEmotion: { primary: string; intensity: number; nuanceList: string[] };

	loreReferenceList: Reference[];
	historyReferenceList: Reference[];

	request: ChatMessage;
	response: ChatMessage;
}

// Other interfaces like ChatMessage, ChatMessageSet, etc., remain the same.

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
	index: number;
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
	inputJsonString: string;
};

export interface DisplayTurn {
	chatTurnId: string;
	sessionId: string;
	characterId: string;
	userId: string;
	profileId: string;
	sequence: number;
	createdAt: string;
	updatedAt: string;
	request: ChatMessage;
	response: ChatMessage;
}

import { allEmotionKeywordsList } from '../../config/index.ts';
import { DefaultAiRole } from '../index.ts';
import { METADATA_TYPES, MetadataType } from '../chromadb/index.ts';

export type ChatType = 'dialogue' | 'action';
export type ChatRoleType = DefaultAiRole;

type DefaultChatEntry = { type: ChatType; prompt: string };
export type ChatEntry = DefaultChatEntry; // expand if needed

export type ChatMessageType = 'request' | 'response';
export type ChatMessageSet = { request: ChatMessage; response: ChatMessage };

// --- UNIFIED BASE METADATA ---
interface BaseMetadata {
	// Core identification (consistent across all types)
	sessionId: string;
	characterId: string; // Added to all for consistency
	type: MetadataType;

	// Timestamps (consistent format)
	createdAt: string; // ISO 8601 format
	updatedAt: string; // ISO 8601 format

	// Content categorization (unified approach)
	keywords: string[]; // Always array, not string
	topics: string[]; // Unified from extractedTopics/keyThemes
	entities: string[]; // Unified from keyEntities

	// Sequence/ordering (where applicable)
	sequence: number;
}

export type BaseMetadataType = BaseMetadata;

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

export interface ChatTurnMetadata extends BaseMetadataType {
	chatTurnId: string;
	requestMessageId: string;
	responseMessageId: string;
	type: typeof METADATA_TYPES.TURN;

	// LLM-generated enrichment (all required with defaults)
	summary: string; // Renamed from turnSummary for consistency

	// Emotional analysis (unified structure)
	userEmotion: {
		primary: string;
		intensity: number; // 0.0 to 1.0
		nuances: string[];
	};
	characterEmotion: { primary: string; intensity: number; nuances: string[] };

	// Interaction analysis
	dialogueAct: string; // question, statement, command, etc.
	actions: string[]; // Renamed from keyActionsDescribed
	relationshipShifts: string[]; // Renamed from relationshipDynamicsShift

	// Cross-references (unified structure)
	loreReferences: Array<{
		id: string; // Renamed from loreId for consistency
		relevance: number; // 0.0 to 1.0
	}>;
	historyReferences: Array<{
		id: string; // Renamed from historyId for consistency
		relevance: number;
	}>;

	// Flags and memory
	flags: string[]; // Renamed from triggerFlags
	memoryChunk: string; // Key field for RAG retrieval
}

export interface ChatTurn extends ChatTurnMetadata {
	request: ChatMessage;
	response: ChatMessage;
}

export interface MigChatMessage {
	uuid: string;
	role: ChatRoleType;
	messageType: ChatMessageType;
	content: string;
	createdAt: string;
	updatedAt: string;
	showName: string;
	emotion: string;
	model?: string;
}

export interface TempChatTurn {
	sessionId: string;
	sequence: number;
	chatTurnSets: ChatMessageSet[];
	type: typeof METADATA_TYPES.TEMP;
}

export type ChatTurnCdo = Pick<ChatTurn, 'sessionId' | 'sequence' | 'request' | 'response'>;

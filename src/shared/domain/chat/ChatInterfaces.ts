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
	createdAt: string; // ISO 8601 format
	updatedAt: string; // ISO 8601 format
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
	createdAt: string;
	updatedAt: string;
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

	// From LLM Analysis of the Request & Response interaction:
	turnSummary: string; // A very brief summary (e.g., "User asks about Tarion's past, Tarion evades.") Default: "N/A"
	keyEntities: string[]; // e.g., ["character:Tarion", "location:DarkForest"]. Default: []
	extractedTopics: string[]; // e.g., ["betrayal", "quest_for_artifact"]. Default: []

	userEmotionalTone: { primary: string; intensity: number; nuances: string[] }; // Default: { primary: "neutral", intensity: 0.5, nuances: [] }
	characterEmotionalTone: { primary: string; intensity: number; nuances: string[] }; // Default: { primary: "neutral", intensity: 0.5, nuances: [] }

	relationshipDynamicsShift: string[]; // e.g., ["Tarion-User:trust_increased"]. Default: []
	dialogueAct: string; // e.g., "question", "statement", "command". Default: "N/A"
	keyActionsDescribed: string[]; // Actions, e.g., ["Tarion_draws_sword"]. Default: []

	loreReferences: Array<{ loreId: string; relevance: number }>; // Default: []
	historyReferences: Array<{ historyId: string; relevance: number }>; // Default: []

	triggerFlags: string[]; // e.g., ["new_lore_revealed", "character_goal_updated"]. Default: []

	// For RAG - a concise, self-contained statement of what was learned or happened in this turn
	// This can be directly used as a searchable "memory chunk"
	memoryChunk: string; // LLM generates this. e.g., "In turn 125, Tarion expressed anger towards Elicia when she mentioned the stolen sword, hinting at a past betrayal." Default: "N/A"
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

export type ChatTurnCdo = Pick<ChatTurn, 'sessionId' | 'sequence' | 'request' | 'response'>;

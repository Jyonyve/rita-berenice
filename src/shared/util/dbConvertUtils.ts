// src/shared/util/loreHelpers.ts

import { convertArrayToString, convertStringToArray } from './parseUtils.js';
import { buildProfileId } from './buildIdUtils.js';
import {
	CharacterInfo,
	CharacterMetadata,
	ChatIndexContentType,
	ChatIndexMetadata,
	ChatMessage,
	ChatTurn,
	ChatTurnMetadata,
	DisplayTurn,
	HistoryIndexContentType,
	HistoryIndexMetadata,
	HistoryInfo,
	HistoryMetadata,
	LoreIndexContentType,
	LoreIndexMetadata,
	LoreInfo,
	LoreMetadata,
	MiscLoreInfo,
	MiscLoreMetadata,
	ProfileInfo,
	ProfileMetadata,
	RecapIndexMetadata,
	RecapInfo,
	RecapMetadata,
	Reference,
	RelatedEvent,
	SessionInfo,
	SessionMetadata,
	UserInfo,
	UserMetadata,
	WorldLoreInfo,
	WorldLoreMetadata,
} from '../domain/index.js';
import { METADATA_TYPES } from '#shared/config/constants.js';

export const metadataToCharacter = (
	metadata: CharacterMetadata,
	description: string,
	instruction: string,
	worldLoreId: string,
	firstMessage: string
): CharacterInfo => {
	return { ...metadata, description, instruction, worldLoreId, firstMessage };
};

export const metadataToProfile = (metadata: ProfileMetadata, description: string): ProfileInfo => {
	return { ...metadata, description };
};

export const metadataToUser = (metadata: UserMetadata): UserInfo => {
	return { ...metadata };
};

export const metadataToSession = (
	metadata: SessionMetadata,
	lastCharMessage: string,
	userNote: string
): SessionInfo => {
	return { ...metadata, lastCharMessage, userNote };
};

// --- UTILITY HELPERS ---

export const removeCharacterFromLore = (
	currentCharacterIds: string,
	characterIdToRemove: string
): string => {
	const currentIds = convertStringToArray(currentCharacterIds);
	return convertArrayToString(currentIds.filter((id) => id !== characterIdToRemove));
};

// --- CHAT TURN HELPERS ---

/**
 * Converts a rich ChatTurn object into the lean metadata format for storing the primary document in ChromaDB.
 * This function no longer handles stringifying arrays for indexed fields. That logic is now in the store layer.
 */
export const chatTurnToMetadata = (chatTurn: ChatTurn): ChatTurnMetadata => {
	return {
		// Core metadata fields
		type: chatTurn.type,
		chatTurnId: chatTurn.chatTurnId,
		sessionId: chatTurn.sessionId,
		characterId: chatTurn.characterId,
		userId: chatTurn.userId,
		profileId: chatTurn.profileId,
		sequence: chatTurn.sequence,
		createdAt: chatTurn.createdAt,
		updatedAt: chatTurn.updatedAt,

		// Stringified source data for reconstruction
		requestJson: JSON.stringify(chatTurn.request),
		responseJson: JSON.stringify(chatTurn.response),

		// Key LLM-generated fields remain on the main document
		summary: chatTurn.summary,
		memoryChunk: chatTurn.memoryChunk,
		dialogueAct: chatTurn.dialogueAct,

		// Flattened emotion objects
		userEmotionPrimary: chatTurn.userEmotion.primary,
		userEmotionIntensity: chatTurn.userEmotion.intensity,
		characterEmotionPrimary: chatTurn.characterEmotion.primary,
		characterEmotionIntensity: chatTurn.characterEmotion.intensity,

		// Post-retrieval context is still stringified
		loreReferenceList: JSON.stringify(chatTurn.loreReferenceList),
		historyReferenceList: JSON.stringify(chatTurn.historyReferenceList),
	};
};

/**
 * Reconstructs a rich ChatTurn object from its database representation.
 * It now reconstructs ALL indexed arrays (keywords, topics, flags, actions, etc.)
 * from the payload of search index records.
 */
export const metadataToChatTurn = (
	metadata: ChatTurnMetadata,
	indexRecords: ChatIndexMetadata[] = []
): ChatTurn => {
	// --- Reconstruct the original message objects ---
	const request: ChatMessage = JSON.parse(metadata.requestJson);
	const response: ChatMessage = JSON.parse(metadata.responseJson);

	// Helper to filter index records by a specific type and extract their values
	const getValuesFromIndex = (contentType: ChatIndexContentType): string[] => {
		return indexRecords
			.filter((record) => record.contentType === contentType)
			.map((record) => record.value);
	};

	return {
		// Map all fields from the primary metadata object
		...metadata,

		// Reconstruct arrays for ALL indexed types
		keywordList: getValuesFromIndex('KEYWORD'),
		topicList: getValuesFromIndex('TOPIC'),
		entityList: getValuesFromIndex('ENTITY'),
		actionList: getValuesFromIndex('ACTION'),
		flagList: getValuesFromIndex('FLAG'),
		relationshipShiftList: getValuesFromIndex('RELATIONSHIP_SHIFT'),

		// Reconstruct complex emotion objects
		userEmotion: {
			primary: metadata.userEmotionPrimary,
			intensity: metadata.userEmotionIntensity,
			nuanceList: getValuesFromIndex('USER_EMOTION_NUANCE'),
		},
		characterEmotion: {
			primary: metadata.characterEmotionPrimary,
			intensity: metadata.characterEmotionIntensity,
			nuanceList: getValuesFromIndex('CHARACTER_EMOTION_NUANCE'),
		},

		// Parse post-retrieval context
		loreReferenceList: metadata.loreReferenceList ? JSON.parse(metadata.loreReferenceList) : [],
		historyReferenceList: metadata.historyReferenceList
			? JSON.parse(metadata.historyReferenceList)
			: [],

		// Attach the perfectly reconstructed message objects
		request,
		response,
	};
};

/**
 * Reconstructs a rich ChatTurn object from its database representation.
 * It now reconstructs ALL indexed arrays (keywords, topics, flags, actions, etc.)
 * from the payload of search index records.
 */
export const metadataToDisplayTurn = (metadata: ChatTurnMetadata): DisplayTurn => {
	// --- Reconstruct the original message objects ---
	const request: ChatMessage = JSON.parse(metadata.requestJson);
	const response: ChatMessage = JSON.parse(metadata.responseJson);

	return {
		chatTurnId: metadata.chatTurnId,
		sessionId: metadata.sessionId,
		characterId: metadata.characterId,
		userId: metadata.userId,
		profileId: metadata.profileId,
		sequence: metadata.sequence,
		createdAt: metadata.createdAt,
		updatedAt: metadata.updatedAt,
		request,
		response,
	};
};

// --- LORE & HISTORY HELPERS ---

/**
 * Converts a rich LoreInfo object into the lean metadata format for ChromaDB.
 */
export const loreToMetadata = (loreInfo: LoreInfo): LoreMetadata => {
	const baseMetadata = {
		type: loreInfo.type,
		loreId: loreInfo.loreId,
		userId: loreInfo.userId,
		createdAt: loreInfo.createdAt,
		updatedAt: loreInfo.updatedAt,
		title: loreInfo.title,
		generatedTitle: loreInfo.generatedTitle,
		summary: loreInfo.summary,
		category: loreInfo.category, // Always present now - 'World' for world lore
	};

	if (loreInfo.type === METADATA_TYPES.WORLD) {
		return baseMetadata as WorldLoreMetadata;
	} else {
		return { ...baseMetadata, source: (loreInfo as MiscLoreInfo).source } as MiscLoreMetadata;
	}
};

/**
 * Reconstructs a rich LoreInfo object from its primary metadata and its search index records.
 * @param metadata The core LoreMetadata from the main document.
 * @param content The document's content string.
 * @param indexRecords An array of LoreIndexMetadata records associated with this lore.
 */
export const metadataToLore = (
	metadata: LoreMetadata,
	content: string,
	indexRecords: LoreIndexMetadata[] = []
): LoreInfo => {
	const getValuesFromIndex = (contentType: LoreIndexContentType): string[] => {
		return indexRecords
			.filter((record) => record.contentType === contentType && record.loreId === metadata.loreId)
			.map((record) => record.value);
	};

	const baseInfo = {
		...metadata,
		content,
		characterIds: getValuesFromIndex('AFFECTED_CHARACTER'), // Array from index
		keywordList: getValuesFromIndex('KEYWORD'), // Array from index
		topicList: getValuesFromIndex('TOPIC'), // Array from index
		entityList: getValuesFromIndex('ENTITY'), // Array from index
	};

	if (metadata.type === METADATA_TYPES.WORLD) {
		return baseInfo as WorldLoreInfo;
	} else {
		return baseInfo as MiscLoreInfo;
	}
};

/**
 * Converts a rich HistoryInfo object into the lean metadata format for ChromaDB.
 */
export const historyToMetadata = (historyInfo: HistoryInfo): HistoryMetadata => {
	return {
		type: historyInfo.type,
		historyId: historyInfo.historyId,
		characterId: historyInfo.characterId, // History always has single characterId
		userId: historyInfo.userId,
		createdAt: historyInfo.createdAt,
		updatedAt: historyInfo.updatedAt,
		title: historyInfo.title,
		generatedTitle: historyInfo.generatedTitle,
		category: historyInfo.category,
		summary: historyInfo.summary,
		periodLabel: historyInfo.periodLabel,
		eventDateValue: historyInfo.eventDateValue,
		eventDateType: historyInfo.eventDateType,
	};
};

/**
 * Reconstructs a rich HistoryInfo object from its primary metadata and its search index records.
 * @param metadata The core HistoryMetadata from the main document.
 * @param content The document's content string.
 * @param indexRecords An array of HistoryIndexMetadata records associated with this history.
 */
export const metadataToHistory = (
	metadata: HistoryMetadata,
	content: string,
	indexRecords: HistoryIndexMetadata[] = []
): HistoryInfo => {
	const getValuesFromIndex = (contentType: HistoryIndexContentType): string[] => {
		return indexRecords
			.filter(
				(record) => record.contentType === contentType && record.historyId === metadata.historyId
			)
			.map((record) => record.value);
	};

	// Get all affected characters from index
	const affectedCharacters = getValuesFromIndex('AFFECTED_CHARACTER');

	// Parse related events from index (they're stored as JSON strings)
	const relatedEvents: RelatedEvent[] = getValuesFromIndex('RELATED_EVENT')
		.map((value) => {
			try {
				return JSON.parse(value) as RelatedEvent;
			} catch {
				return null;
			}
		})
		.filter((event): event is RelatedEvent => event !== null);

	return {
		...metadata,
		content,
		sideCharacterIdList: affectedCharacters.filter((id) => id !== metadata.characterId),
		allAffectedCharacterIdList: [...new Set([metadata.characterId, ...affectedCharacters])],
		relatedEventList: relatedEvents,
		keywordList: getValuesFromIndex('KEYWORD'),
		topicList: getValuesFromIndex('TOPIC'),
		entityList: getValuesFromIndex('ENTITY'),
	};
};

// --- UTILITY HELPERS ---

export const addLoreReference = (
	existingReferences: Reference[],
	newReference: Reference
): Reference[] => {
	// Check if reference already exists
	const existingIndex = existingReferences.findIndex((ref) => ref.id === newReference.id);

	if (existingIndex !== -1) {
		// Update existing reference with new relevance
		const updated = [...existingReferences];
		updated[existingIndex] = newReference;
		return updated;
	}

	// Add new reference
	return [...existingReferences, newReference];
};

export const removeLoreReference = (
	existingReferences: Reference[],
	referenceIdToRemove: string
): Reference[] => {
	return existingReferences.filter((ref) => ref.id !== referenceIdToRemove);
};

export const addHistoryReference = (
	existingReferences: Reference[],
	newReference: Reference
): Reference[] => {
	// Same logic as lore references
	return addLoreReference(existingReferences, newReference);
};

export const removeHistoryReference = (
	existingReferences: Reference[],
	referenceIdToRemove: string
): Reference[] => {
	return removeLoreReference(existingReferences, referenceIdToRemove);
};

export const updateEmotionIntensity = (
	emotion: { primary: string; intensity: number; nuanceList: string[] },
	newIntensity: number
): { primary: string; intensity: number; nuanceList: string[] } => {
	return {
		...emotion,
		intensity: Math.max(0, Math.min(1, newIntensity)), // Clamp between 0 and 1
	};
};

export const addEmotionNuance = (
	emotion: { primary: string; intensity: number; nuanceList: string[] },
	newNuance: string
): { primary: string; intensity: number; nuanceList: string[] } => {
	if (emotion.nuanceList.includes(newNuance)) {
		return emotion; // Already exists
	}

	return { ...emotion, nuanceList: [...emotion.nuanceList, newNuance] };
};

export const removeEmotionNuance = (
	emotion: { primary: string; intensity: number; nuanceList: string[] },
	nuanceToRemove: string
): { primary: string; intensity: number; nuanceList: string[] } => {
	return {
		...emotion,
		nuanceList: emotion.nuanceList.filter((nuance) => nuance !== nuanceToRemove),
	};
};

// --- RECAP HELPERS ---

/**
 * Converts a rich RecapInfo object into the lean metadata format for storing the primary document in ChromaDB.
 * This function no longer handles stringifying the `flagsArray`. That logic is now in the store layer,
 * which is responsible for creating the individual search index records.
 */
export const recapToMetadata = (recapInfo: RecapInfo): RecapMetadata => {
	return {
		// Core metadata fields
		type: recapInfo.type,
		recapId: recapInfo.recapId,
		sessionId: recapInfo.sessionId,
		characterId: recapInfo.characterId,
		userId: recapInfo.userId,
		profileId: buildProfileId(recapInfo.sessionId, recapInfo.userId),
		createdAt: recapInfo.createdAt,
		updatedAt: recapInfo.updatedAt,

		// Recap-specific fields
		turnStart: recapInfo.turnStart,
		turnEnd: recapInfo.turnEnd,
		model: recapInfo.model,

		// Post-retrieval context is still stringified as it's not search-critical
		loreReferenceList: JSON.stringify(recapInfo.loreReferenceList),
		historyReferenceList: JSON.stringify(recapInfo.historyReferenceList),
	};
};

/**
 * Reconstructs a rich RecapInfo object from its primary metadata and a payload of its search index records.
 * The service layer is responsible for fetching both the main recap document and its associated index entries.
 *
 * @param metadata The core RecapMetadata from the main document.
 * @param content The recap's content string.
 * @param indexRecords An array of RecapSearchIndexMetadata records associated with this recap.
 */
export const metadataToRecap = (
	metadata: RecapMetadata,
	content: string,
	indexRecords: RecapIndexMetadata[] = []
): RecapInfo => {
	const getFlagsFromIndex = (): string[] => {
		return indexRecords
			.filter((record) => record.contentType === 'RECAP_FLAG' && record.recapId === metadata.recapId)
			.map((record) => record.value);
	};

	return {
		// Map all fields from the primary metadata object
		...metadata,

		// Attach the content
		content,

		// Reconstruct the flags array from the provided index records
		flagList: getFlagsFromIndex(),

		// Parse post-retrieval context from JSON strings
		loreReferenceList: metadata.loreReferenceList ? JSON.parse(metadata.loreReferenceList) : [],
		historyReferenceList: metadata.historyReferenceList
			? JSON.parse(metadata.historyReferenceList)
			: [],
	};
};

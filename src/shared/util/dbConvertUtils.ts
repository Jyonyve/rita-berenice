// src/shared/util/loreHelpers.ts

import {
	LoreMetadata,
	LoreInfo,
	HistoryMetadata,
	HistoryInfo,
	LoreIndexMetadata,
	LoreIndexContentType,
} from '../domain/lore/LoreInterfaces.js';
import { convertArrayToString, convertStringToArray } from './chatParseUtils.js';
import {
	ChatTurnMetadata,
	ChatTurn,
	ChatMessage,
	ChatIndexMetadata,
	ChatIndexContentType,
	DisplayTurn,
} from '../domain/chat/ChatInterfaces.js';
import { buildProfileId } from './buildIdUtils.js';
import { CharacterInfo, CharacterMetadata } from '../domain/character/CharacterInterfaces.js';
import { RecapInfo, RecapMetadata, RecapIndexMetadata } from '../domain/recap/RecapInterfaces.js';
import { ProfileInfo, ProfileMetadata } from '../domain/profile/ProfileInterfaces.js';
import { UserInfo, UserMetadata } from '../domain/user/UserInterfaces.js';
import { SessionMetadata } from '../domain/session/SessionInterfaces.js';
import { SessionInfo } from '#shared/domain/session/SessionInterfaces.js';
import { Reference, RelatedEvent } from '../domain/BaseTypes.js';

export const metadataToCharacter = (
	metadata: CharacterMetadata,
	description: string,
	instruction: string,
	firstMessage: string
): CharacterInfo => {
	return { ...metadata, description, instruction, firstMessage };
};

export const metadataToProfile = (metadata: ProfileMetadata, description: string): ProfileInfo => {
	return { ...metadata, description };
};

export const metadataToUser = (metadata: UserMetadata): UserInfo => {
	return { ...metadata };
};

export const metadataToSession = (
	metadata: SessionMetadata,
	lastCharMessage: string
): SessionInfo => {
	return { ...metadata, lastCharMessage };
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

	return { ...metadata, request, response };
};

// --- LORE & HISTORY HELPERS ---

/**
 * Converts a rich LoreInfo object into the lean metadata format for ChromaDB.
 */
export const loreToMetadata = (loreInfo: LoreInfo): LoreMetadata => {
	return {
		type: loreInfo.type,
		loreId: loreInfo.loreId,
		characterId: loreInfo.characterId,
		userId: loreInfo.userId,
		profileId: loreInfo.profileId,
		createdAt: loreInfo.createdAt,
		updatedAt: loreInfo.updatedAt,
		title: loreInfo.title,
		generatedTitle: loreInfo.generatedTitle,
		englishId: loreInfo.englishId,
		category: loreInfo.category,
		source: loreInfo.source,
		summary: loreInfo.summary,
	};
};

/**
 * Reconstructs a rich LoreInfo object from its primary metadata and its search index records.
 * @param metadata The core LoreMetadata from the main document.
 * @param content The document's content string.
 * @param indexRecords An array of ContentSearchIndexMetadata records associated with this lore.
 */
export const metadataToLore = (
	metadata: LoreMetadata,
	content: string,
	indexRecords: LoreIndexMetadata[] = []
): LoreInfo => {
	const getValuesFromIndex = (contentType: LoreIndexContentType): string[] => {
		return indexRecords
			.filter((record) => record.contentType === contentType && record.contentId === metadata.loreId)
			.map((record) => record.value);
	};

	const affectedCharacters = getValuesFromIndex('AFFECTED_CHARACTER');
	return {
		...metadata,
		content,
		sideCharacterIdList: affectedCharacters.filter((id) => id !== metadata.characterId),
		allAffectedCharacterIdList: [...new Set([metadata.characterId, ...affectedCharacters])],
		keywordList: getValuesFromIndex('KEYWORD'),
		topicList: getValuesFromIndex('TOPIC'),
	};
};

/**
 * Converts a rich HistoryInfo object into the lean metadata format for ChromaDB.
 */
export const historyToMetadata = (historyInfo: HistoryInfo): HistoryMetadata => {
	return {
		type: historyInfo.type,
		historyId: historyInfo.historyId,
		characterId: historyInfo.characterId,
		userId: historyInfo.userId,
		profileId: historyInfo.profileId,
		createdAt: historyInfo.createdAt,
		updatedAt: historyInfo.updatedAt,
		title: historyInfo.title,
		generatedTitle: historyInfo.generatedTitle,
		englishId: historyInfo.englishId,
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
 * @param indexRecords An array of ContentSearchIndexMetadata records associated with this history.
 */
export const metadataToHistory = (
	metadata: HistoryMetadata,
	content: string,
	indexRecords: LoreIndexMetadata[] = []
): HistoryInfo => {
	const getValuesFromIndex = (contentType: LoreIndexContentType): string[] => {
		return indexRecords
			.filter(
				(record) => record.contentType === contentType && record.contentId === metadata.historyId
			)
			.map((record) => record.value);
	};

	const affectedCharacters = getValuesFromIndex('AFFECTED_CHARACTER');
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
	return { ...emotion, nuanceList: emotion.nuanceList.filter((nuance) => nuance !== nuanceToRemove) };
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

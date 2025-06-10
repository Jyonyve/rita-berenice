// src/shared/util/loreHelpers.ts

import {
	LoreMetadata,
	LoreInfo,
	HistoryMetadata,
	HistoryInfo,
} from '../domain/lore/LoreInterfaces.ts';
import { convertArrayToString, convertStringToArray } from './chatParseUtils.ts';
import {
	ChatTurnMetadata,
	ChatTurn,
	ChatMessage,
	ChatEntry,
} from '../domain/chat/ChatInterfaces.ts';
import { buildChatTurnId } from '../../server/util/buildIdUtils.ts';
import { Metadata } from 'chromadb';
import { DEFAULT_EMOTION } from '../config/emotionWordsMapper.ts';

// --- LORE HELPERS ---

export const loreToMetadata = (loreInfo: LoreInfo): LoreMetadata => {
	// Combine owner and side characters for the allAffected field
	const allAffectedCharacters = [
		...loreInfo.ownerCharacterIdArray,
		...loreInfo.sideCharacterIdArray,
	];
	const uniqueAllAffected = [...new Set(allAffectedCharacters)]; // Remove duplicates

	return {
		// Base metadata fields (from BaseMetadataType)
		sessionId: loreInfo.sessionId,
		characterId: loreInfo.characterId,
		type: loreInfo.type,
		createdAt: loreInfo.createdAt,
		updatedAt: loreInfo.updatedAt,
		sequence: loreInfo.sequence,

		// Stringify arrays from BaseMetadataType
		keywords: loreInfo.keywords,
		topics: loreInfo.topics,
		entities: loreInfo.entities,

		// Lore-specific fields
		loreId: loreInfo.loreId,
		category: loreInfo.category,
		source: loreInfo.source,
		title: loreInfo.title,
		generatedTitle: loreInfo.generatedTitle,
		englishId: loreInfo.englishId, // kebab-case version of the title summary

		// Stringify character arrays
		ownerCharacterIds: convertArrayToString(loreInfo.ownerCharacterIdArray),
		sideCharacterIds: convertArrayToString(loreInfo.sideCharacterIdArray),
		allAffectedCharacterIds: convertArrayToString(uniqueAllAffected)
	};
};

export const metadataToLore = (metadata: LoreMetadata, content: string): LoreInfo => {
	return {
		// Base metadata fields (from BaseMetadataType)
		sessionId: metadata.sessionId,
		characterId: metadata.characterId,
		type: metadata.type,
		createdAt: metadata.createdAt,
		updatedAt: metadata.updatedAt,
		sequence: metadata.sequence,

		// Parse arrays from BaseMetadataType strings
		keywords: metadata.keywords,
		topics: metadata.topics,
		entities: metadata.entities,

		// Lore-specific fields
		loreId: metadata.loreId,
		category: metadata.category,
		source: metadata.source,
		title: metadata.title,
		generatedTitle: metadata.generatedTitle,
		englishId: metadata.englishId, // kebab-case version of the title summary

		// Content
		content,

		// Parse character arrays
		ownerCharacterIdArray: convertStringToArray(metadata.ownerCharacterIds),
		sideCharacterIdArray: convertStringToArray(metadata.sideCharacterIds),
		allAffectedCharacterIdArray: convertStringToArray(metadata.allAffectedCharacterIds),
	};
};

// --- HISTORY HELPERS ---

export const historyToMetadata = (historyInfo: HistoryInfo): HistoryMetadata => {
	// Combine owner and side characters for the allAffected field
	const allAffectedCharacters = [
		...historyInfo.ownerCharacterIdArray,
		...historyInfo.sideCharacterIdArray,
	];
	const uniqueAllAffected = [...new Set(allAffectedCharacters)]; // Remove duplicates

	return {
		// Base metadata fields (from BaseMetadataType)
		sessionId: historyInfo.sessionId,
		characterId: historyInfo.characterId,
		type: historyInfo.type,
		createdAt: historyInfo.createdAt,
		updatedAt: historyInfo.updatedAt,
		sequence: historyInfo.sequence,

		// Stringify arrays from BaseMetadataType
		keywords:  historyInfo.keywords,
		topics:historyInfo.topics,
		entities: historyInfo.entities,

		// History-specific fields
		historyId: historyInfo.historyId,
		title: historyInfo.title,
		generatedTitle: historyInfo.generatedTitle,
		englishId: historyInfo.englishId, // kebab-case version of the title summary
		category: historyInfo.category, // ✅ Added missing category field

		// Stringify character arrays
		ownerCharacterIds: convertArrayToString(historyInfo.ownerCharacterIdArray),
		sideCharacterIds: convertArrayToString(historyInfo.sideCharacterIdArray),
		allAffectedCharacterIds: convertArrayToString(uniqueAllAffected),

		// Flatten temporal objects
		periodLabel: historyInfo.periodLabel,
		periodConfidence: historyInfo.periodConfidence,
		eventDateValue: historyInfo.eventDateValue,
		eventDateType: historyInfo.eventDateType,
		eventDateConfidence: historyInfo.eventDateConfidence,

		// Stringify complex objects
		relatedEvents: JSON.stringify(historyInfo.relatedEventsArray),
	};
};

export const metadataToHistory = (metadata: HistoryMetadata, content: string): HistoryInfo => {
	return {
		// Base metadata fields (from BaseMetadataType)
		sessionId: metadata.sessionId,
		characterId: metadata.characterId,
		type: metadata.type,
		createdAt: metadata.createdAt,
		updatedAt: metadata.updatedAt,
		sequence: metadata.sequence,

		// Parse arrays from BaseMetadataType strings
		keywords: metadata.keywords,
		topics: metadata.topics,
		entities: metadata.entities,

		// History-specific fields
		historyId: metadata.historyId,
		title: metadata.title,
		generatedTitle: metadata.generatedTitle,
		englishId: metadata.englishId, // kebab-case version of the title summary
		category: metadata.category, // ✅ Added missing category field

		// Temporal information (flattened fields from metadata)
		periodLabel: metadata.periodLabel,
		periodConfidence: metadata.periodConfidence,
		eventDateValue: metadata.eventDateValue,
		eventDateType: metadata.eventDateType,
		eventDateConfidence: metadata.eventDateConfidence,

		// Content
		content,

		// Parse character arrays
		ownerCharacterIdArray: convertStringToArray(metadata.ownerCharacterIds),
		sideCharacterIdArray: convertStringToArray(metadata.sideCharacterIds),
		allAffectedCharacterIdArray: convertStringToArray(metadata.allAffectedCharacterIds),

		// Parse relationships
		relatedEventsArray: metadata.relatedEvents ? JSON.parse(metadata.relatedEvents) : [],
	};
};

// --- UTILITY HELPERS ---

export const addCharacterId = (existingIds: string, newCharacterId: string): string => {
	const currentIds = convertStringToArray(existingIds);
	if (!currentIds.includes(newCharacterId)) {
		currentIds.push(newCharacterId);
	}
	return convertArrayToString(currentIds);
};

export const removeCharacterFromLore = (
	currentCharacterIds: string,
	characterIdToRemove: string
): string => {
	const currentIds = convertStringToArray(currentCharacterIds);
	return convertArrayToString(currentIds.filter((id) => id !== characterIdToRemove));
};

// --- CHAT TURN HELPERS ---

export const chatTurnToMetadata = (chatTurn: ChatTurn): ChatTurnMetadata => {
	return {
		// Base metadata fields (from BaseMetadata)
		sessionId: chatTurn.sessionId,
		characterId: chatTurn.characterId,
		type: chatTurn.type,
		createdAt: chatTurn.createdAt,
		updatedAt: chatTurn.updatedAt,
		sequence: chatTurn.sequence,

		// Chat turn specific fields
		chatTurnId: chatTurn.chatTurnId,
		requestMessageId: chatTurn.requestMessageId,
		responseMessageId: chatTurn.responseMessageId,

		// LLM-generated enrichment (stringify arrays and flatten objects)
		summary: chatTurn.summary,

		// Arrays stored as comma-separated strings
		keywords: convertArrayToString(chatTurn.keywords),
		topics: convertArrayToString(chatTurn.topics),
		entities: convertArrayToString(chatTurn.entities),

		// Flatten emotion objects to primitives
		userEmotionPrimary: chatTurn.userEmotion.primary,
		userEmotionIntensity: chatTurn.userEmotion.intensity,
		userEmotionNuances: convertArrayToString(chatTurn.userEmotion.nuances),
		characterEmotionPrimary: chatTurn.characterEmotion.primary,
		characterEmotionIntensity: chatTurn.characterEmotion.intensity,
		characterEmotionNuances: convertArrayToString(chatTurn.characterEmotion.nuances),

		// Other arrays as strings
		dialogueAct: chatTurn.dialogueAct,
		actions: convertArrayToString(chatTurn.actions),
		relationshipShifts: convertArrayToString(chatTurn.relationshipShifts),
		flags: convertArrayToString(chatTurn.flags),
		memoryChunk: chatTurn.memoryChunk,

		// Complex objects as JSON strings
		loreReferences: JSON.stringify(chatTurn.loreReferences),
		historyReferences: JSON.stringify(chatTurn.historyReferences),
	};
};

export const metadataToChatTurn = (
	metadata: Metadata,
	request: ChatMessage,
	response: ChatMessage
): ChatTurn => {
	return {
		// Base metadata fields (from BaseMetadata)
		sessionId: metadata.sessionId as string,
		characterId: metadata.characterId as string,
		type: 'turn',
		createdAt: metadata.createdAt as string,
		updatedAt: metadata.updatedAt as string,
		sequence: metadata.sequence as number,

		// Chat turn specific fields
		chatTurnId:
			(metadata.chatTurnId as string) ||
			buildChatTurnId(metadata.sessionId as string, metadata.sequence as number),
		requestMessageId: metadata.requestMessageId as string,
		responseMessageId: metadata.responseMessageId as string,

		// LLM-generated enrichment (parse strings to rich objects)
		summary: (metadata.summary as string) || 'N/A',

		// Parse arrays from comma-separated strings
		keywords: convertStringToArray(metadata.keywords as string),
		topics: convertStringToArray(metadata.topics as string),
		entities: convertStringToArray(metadata.entities as string),

		// Reconstruct emotion objects from flattened primitives
		userEmotion: {
			primary: (metadata.userEmotionPrimary as string) || DEFAULT_EMOTION,
			intensity: (metadata.userEmotionIntensity as number) || 0.5,
			nuances: convertStringToArray(metadata.userEmotionNuances as string),
		},
		characterEmotion: {
			primary: (metadata.characterEmotionPrimary as string) || DEFAULT_EMOTION,
			intensity: (metadata.characterEmotionIntensity as number) || 0.5,
			nuances: convertStringToArray(metadata.characterEmotionNuances as string),
		},

		// Parse other arrays from strings
		dialogueAct: (metadata.dialogueAct as string) || 'N/A',
		actions: convertStringToArray(metadata.actions as string),
		relationshipShifts: convertStringToArray(metadata.relationshipShifts as string),
		flags: convertStringToArray(metadata.flags as string),
		memoryChunk: (metadata.memoryChunk as string) || 'N/A',

		// Parse complex objects from JSON strings
		loreReferences: metadata.loreReferences ? JSON.parse(metadata.loreReferences as string) : [],
		historyReferences: metadata.historyReferences
			? JSON.parse(metadata.historyReferences as string)
			: [],

		// Full message objects
		request,
		response,
	};
};

// --- UTILITY HELPERS ---

export const addLoreReference = (
	existingReferences: Array<{ id: string; relevance: number }>,
	newReference: { id: string; relevance: number }
): Array<{ id: string; relevance: number }> => {
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
	existingReferences: Array<{ id: string; relevance: number }>,
	referenceIdToRemove: string
): Array<{ id: string; relevance: number }> => {
	return existingReferences.filter((ref) => ref.id !== referenceIdToRemove);
};

export const addHistoryReference = (
	existingReferences: Array<{ id: string; relevance: number }>,
	newReference: { id: string; relevance: number }
): Array<{ id: string; relevance: number }> => {
	// Same logic as lore references
	return addLoreReference(existingReferences, newReference);
};

export const removeHistoryReference = (
	existingReferences: Array<{ id: string; relevance: number }>,
	referenceIdToRemove: string
): Array<{ id: string; relevance: number }> => {
	return removeLoreReference(existingReferences, referenceIdToRemove);
};

export const updateEmotionIntensity = (
	emotion: { primary: string; intensity: number; nuances: string[] },
	newIntensity: number
): { primary: string; intensity: number; nuances: string[] } => {
	return {
		...emotion,
		intensity: Math.max(0, Math.min(1, newIntensity)), // Clamp between 0 and 1
	};
};

export const addEmotionNuance = (
	emotion: { primary: string; intensity: number; nuances: string[] },
	newNuance: string
): { primary: string; intensity: number; nuances: string[] } => {
	if (emotion.nuances.includes(newNuance)) {
		return emotion; // Already exists
	}

	return { ...emotion, nuances: [...emotion.nuances, newNuance] };
};

export const removeEmotionNuance = (
	emotion: { primary: string; intensity: number; nuances: string[] },
	nuanceToRemove: string
): { primary: string; intensity: number; nuances: string[] } => {
	return { ...emotion, nuances: emotion.nuances.filter((nuance) => nuance !== nuanceToRemove) };
};

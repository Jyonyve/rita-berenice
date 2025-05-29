import { MessageContent, MessageContentText } from '@langchain/core/messages';

import {
	ChatMessage,
	ChatEntry,
	ChatTurn,
	ChatRoleType,
	ChatMessageType,
	METADATA_TYPES,
} from '@shared/domain/index.ts';
import { DEFAULT_EMOTION } from '../config/index.ts';
import { buildCharacterId } from '#root/src/server/index.ts';

export const convertStringToArray = (input: string): string[] => {
	return input.split(',').map((item) => item.trim());
};

export const convertArrayToString = (input: string[]): string => {
	return input.join(',').trim();
};

export const parseTextToEntries = (text: string): ChatEntry[] => {
	const entries: ChatEntry[] = [];
	const regex = /\*([^*]+)\*|([^*]+)/g;
	let match;

	while ((match = regex.exec(text)) !== null) {
		if (match[1]) {
			entries.push({ type: 'action', prompt: match[1].trim() });
		} else if (match[2]) {
			entries.push({ type: 'dialogue', prompt: match[2].trim() });
		}
	}

	return entries;
};

export const parseEntriesToText = (entries: ChatEntry[]): string => {
	return entries
		.map((entry) => (entry.type === 'action' ? `*${entry.prompt}*` : entry.prompt))
		.join('\n');
};

export const parseChatTurnToMetadata = (turn: ChatTurn) => {
	// In your initChat.ts, update the metadata preparation:
	// In your upsertEnrichedInBatches function, convert rich ChatTurn objects to ChromaDB primitives:
	return {
		// Core metadata
		sessionId: turn.sessionId,
		sequence: turn.sequence,
		chatTurnId: turn.chatTurnId,
		requestMessageId: turn.requestMessageId,
		responseMessageId: turn.responseMessageId,
		createdAt: turn.createdAt,
		updatedAt: turn.updatedAt,
		type: METADATA_TYPES.TURN,
		characterId: turn.characterId,

		// Convert rich objects to ChromaDB primitives
		summary: turn.summary,
		keywords: convertArrayToString(turn.keywords), // Array → String
		topics: convertArrayToString(turn.topics), // Array → String
		entities: convertArrayToString(turn.entities), // Array → String

		// Flatten emotion objects to primitives
		userEmotionPrimary: turn.userEmotion.primary,
		userEmotionIntensity: turn.userEmotion.intensity,
		userEmotionNuances: convertArrayToString(turn.userEmotion.nuances), // Array → String
		characterEmotionPrimary: turn.characterEmotion.primary,
		characterEmotionIntensity: turn.characterEmotion.intensity,
		characterEmotionNuances: convertArrayToString(turn.characterEmotion.nuances), // Array → String

		// Convert other arrays to strings
		dialogueAct: turn.dialogueAct,
		actions: convertArrayToString(turn.actions), // Array → String
		relationshipShifts: convertArrayToString(turn.relationshipShifts), // Array → String
		flags: convertArrayToString(turn.flags), // Array → String
		memoryChunk: turn.memoryChunk,

		// Convert complex objects to JSON strings
		loreReferences: JSON.stringify(turn.loreReferences), // Object Array → JSON String
		historyReferences: JSON.stringify(turn.historyReferences), // Object Array → JSON String
	};
};

export const buildChatMessage = (
	role: ChatRoleType,
	sequence: number,
	showName: string,
	entriesString: string,
	sessionId: string,
	emotion = DEFAULT_EMOTION
): ChatMessage => {
	const entries: ChatEntry[] = parseTextToEntries(entriesString);
	const messageType: ChatMessageType = role === 'user' ? 'request' : 'response';
	return {
		role,
		sequence,
		sessionId,
		entries,
		messageId: '',
		messageType,
		showName,
		emotion,
		createdAt: '',
		updatedAt: '',
		type: METADATA_TYPES.MESSAGE,
	};
};

export const convertMessageContentToString = (content: MessageContent): string => {
	if (typeof content === 'string') {
		return content;
	} else if (Array.isArray(content)) {
		const textContent = content.find((item) => item.type === 'text') as MessageContentText;
		return textContent ? textContent.text : JSON.stringify(content);
	} else {
		return JSON.stringify(content);
	}
};

export const parseSessionId = (
	sessionId: string
): { charName: string; variant: string; uuid: string; characterId: string } => {
	const parts = sessionId.split('_');
	if (parts.length < 3) {
		throw new Error(`Invalid session ID format: ${sessionId}`);
	}
	return {
		charName: parts[0],
		variant: parts[1],
		uuid: parts[2], // In case UUID contains underscores
		characterId: buildCharacterId(parts[0], parts[1]),
	};
};

export const parseMessageId = (
	messageId: string
): { sessionId: string; sequence: number; type: ChatMessageType; index?: number } => {
	const parts = messageId.split('_');
	if (parts.length < 3) {
		throw new Error(`Invalid message ID format: ${messageId}`);
	}

	return { sessionId: parts[0], sequence: parseInt(parts[1]), type: parts[2] as ChatMessageType };
};

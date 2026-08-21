import { ChatMessageType, ChatTurn, ChatTurnMetadata } from '../domain/chat/chat.type.js';
import { DEFAULT_EMOTION, NA } from '../config/index.js';
import { buildCharacterId } from './buildIdUtils.js';

export const convertStringToArray = (input: string): string[] => {
	if (!input || typeof input !== 'string') {
		return [];
	}
	return input.split(',').map((item) => item.trim());
};

export const convertArrayToString = (arr: string[]): string => {
	return arr && arr.length > 0 ? arr.join(',') : '';
};

export const parseChatTurnToMetadata = (turn: ChatTurn): ChatTurnMetadata => {
	const jsonStringifyOrEmpty = (obj: any): string => {
		try {
			return obj && Array.isArray(obj) ? JSON.stringify(obj) : '[]';
		} catch {
			return '[]';
		}
	};

	return {
		// Core metadata
		sessionId: turn.sessionId,
		sequence: turn.sequence,
		chatTurnId: turn.chatTurnId,
		createdAt: turn.createdAt,
		updatedAt: turn.updatedAt,
		type: turn.type,
		characterId: turn.characterId,
		userId: turn.userId,
		profileId: turn.profileId,
		requestJson: JSON.stringify(turn.request),
		responseJson: JSON.stringify(turn.response),

		// Enriched metadata (flattened for the vector store)
		summary: turn.summary || NA,

		// Flattened emotion objects
		userEmotionPrimary: turn.userEmotion?.primary || DEFAULT_EMOTION,
		userEmotionIntensity: turn.userEmotion?.intensity || 0.5,

		characterEmotionPrimary: turn.characterEmotion?.primary || DEFAULT_EMOTION,
		characterEmotionIntensity: turn.characterEmotion?.intensity || 0.5,

		// Other fields
		dialogueAct: turn.dialogueAct || NA,
		memoryChunk: turn.memoryChunk || NA,

		// Complex objects as JSON strings
		loreReferenceList: jsonStringifyOrEmpty(turn.loreReferenceList),
		historyReferenceList: jsonStringifyOrEmpty(turn.historyReferenceList),
	};
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

export const parseProfileId = (profileId: string): { sessionId: string; userId: string } => {
	const parts = profileId.split('_');
	if (parts.length < 4) {
		throw new Error(
			`Invalid profile ID format: Expected at least 4 parts, but got ${parts.length} for ID "${profileId}"`
		);
	}

	return { sessionId: parts.slice(0, 3).join('_'), userId: parts[3] };
};

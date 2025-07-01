import { MessageContent, MessageContentText } from '@langchain/core/messages';
import {
	ChatEntry,
	ChatMessage,
	ChatMessageType,
	ChatRoleType,
	ChatTurn,
} from '../domain/chat/ChatInterfaces.js';
import { DEFAULT_EMOTION } from '../config/emotionWordsMapper.js';
import { buildCharacterId } from '#server/util/buildIdUtils.js';

export const convertStringToArray = (input: string): string[] => {
	if (!input || typeof input !== 'string') {
		return [];
	}
	return input.split(',').map((item) => item.trim());
};

export const convertArrayToString = (arr: string[]): string => {
	return arr && arr.length > 0 ? arr.join(',') : '';
};

export const parseTextToEntries = (text: string) => {
	const starCount = (text.match(/\*/g) || []).length;
	if (starCount % 2 !== 0) {
		throw Error('parsing error: "*" is not closed throughly.');
	}

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

export const parseChatTurnToMetadata = (turn: ChatTurn): any => {
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
		requestMessageId: turn.requestMessageId,
		responseMessageId: turn.responseMessageId,
		createdAt: turn.createdAt,
		updatedAt: turn.updatedAt,
		type: turn.type,
		characterId: turn.characterId,

		// Enriched metadata (flattened for ChromaDB)
		summary: turn.summary || 'N/A',
		keywords: convertArrayToString(turn.keywords),
		topics: convertArrayToString(turn.topics),
		entities: convertArrayToString(turn.entities),

		// Flattened emotion objects
		userEmotionPrimary: turn.userEmotion?.primary || 'neutral',
		userEmotionIntensity: turn.userEmotion?.intensity || 0.5,
		userEmotionNuances: convertArrayToString(turn.userEmotion?.nuances || []),

		characterEmotionPrimary: turn.characterEmotion?.primary || 'neutral',
		characterEmotionIntensity: turn.characterEmotion?.intensity || 0.5,
		characterEmotionNuances: convertArrayToString(turn.characterEmotion?.nuances || []),

		// Other fields
		dialogueAct: turn.dialogueAct || 'N/A',
		actions: convertArrayToString(turn.actions),
		relationshipShifts: convertArrayToString(turn.relationshipShifts),
		flags: convertArrayToString(turn.flags),
		memoryChunk: turn.memoryChunk || 'N/A',

		// Complex objects as JSON strings
		loreReferences: jsonStringifyOrEmpty(turn.loreReferences),
		historyReferences: jsonStringifyOrEmpty(turn.historyReferences),
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
		type: 'message',
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

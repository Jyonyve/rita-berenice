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
		.join(' ');
};

export const buildChatTurnToJsonString = (chatTurn: ChatTurn): string =>
	JSON.stringify(chatTurn, null, 2);

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
		timestamp: '',
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
): { charName: string; variant: string; uuid: string } => {
	const parts = sessionId.split('_');
	if (parts.length < 3) {
		throw new Error(`Invalid session ID format: ${sessionId}`);
	}
	return {
		charName: parts[0],
		variant: parts[1],
		uuid: parts[2], // In case UUID contains underscores
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

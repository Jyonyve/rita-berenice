import { MessageContent, MessageContentText } from '@langchain/core/messages';

import {
	ChatMessage,
	ChatEntry,
	ChatTurn,
	ChatRoleType,
	ChatMessageType,
} from '@shared/domain/index.ts';
import { buildMessageId } from './idUtils.ts';
import { DEFAULT_EMOTION, isValidEmotionKeyword } from '../config/index.ts';

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
	text: string,
	sessionId: string,
	emotion = DEFAULT_EMOTION
): ChatMessage => {
	const entries: ChatEntry[] = parseTextToEntries(text);
	const messageType: ChatMessageType = role === 'user' ? 'request' : 'response';
	return {
		role,
		messageId: buildMessageId(sessionId, sequence, messageType),
		messageType,
		showName,
		entries,
		emotion: isValidEmotionKeyword(emotion) ? emotion : DEFAULT_EMOTION,
		timestamp: new Date().toISOString(),
	};
};

export const parseChatTurnToSimpleLogs = (chatTurn: ChatTurn) => {
	const { request, response } = chatTurn;
	return {
		userName: request.showName,
		userPrompt: parseEntriesToText(request.entries),
		charName: response.showName,
		charPrompt: parseEntriesToText(response.entries),
		emotion: response.emotion,
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

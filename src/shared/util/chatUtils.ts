import { MessageContent, MessageContentText } from '@langchain/core/messages';
import { ChatCompletion } from 'openai/resources/index.mjs';

import { v4 as uuidv4 } from 'uuid';
import {
	ChatMessage,
	ChatEntry,
	ChatTurn,
	ChatRoleType,
	ChatMessageType,
	SUFFIX,
	SuffixType,
} from '@shared/domain/index.ts';

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

export const parseEntryToJson = (entry: ChatEntry) => ({ type: entry.type, prompt: entry.prompt });

export const buildChatTurnToJsonString = (chatTurn: ChatTurn): string => {
	const { request, response, sessionId, sequence, isFixed } = chatTurn;

	const jsonObject = {
		sessionId,
		sequence,
		isFixed,
		request: { ...request, entries: request.entries.map(parseEntryToJson) },
		response: response.map((r) => ({ ...r, entries: r.entries.map(parseEntryToJson) })),
	};

	return JSON.stringify(jsonObject, null, 2);
};

export const buildChatMessage = (
	role: ChatRoleType,
	sequence: number,
	text: string,
	sessionId: string
): ChatMessage => {
	const entries: ChatEntry[] = parseTextToEntries(text);
	const messageType: ChatMessageType = role === 'user' ? 'request' : 'response';
	return {
		role,
		messageId: buildMessageId(sessionId, sequence, messageType),
		messageType,
		entries,
		timestamp: new Date().toISOString(),
	};
};

export const extractValidOpenAiContent = (response: ChatCompletion): string => {
	if (!response?.choices?.length) return '';
	const validChoice = response.choices.find((choice) => choice?.message?.content != null);
	return validChoice?.message?.content || '';
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

export const buildSessionId = (characterName: string, variant: string): string => {
	return `${characterName}_${variant}_${uuidv4()}`;
};

export const parseSessionId = (
	sessionId: string
): { characterName: string; variant: string; uuid: string } => {
	const parts = sessionId.split('_');
	if (parts.length < 3) {
		throw new Error(`Invalid session ID format: ${sessionId}`);
	}
	return {
		characterName: parts[0],
		variant: parts[1],
		uuid: parts.slice(2).join('_'), // In case UUID contains underscores
	};
};

export const buildMessageId = (
	sessionId: string,
	sequence: number,
	messageType: ChatMessageType,
	index?: number
): string => {
	return index !== undefined
		? `${sessionId}_${sequence}_${messageType}_${index}`
		: `${sessionId}_${sequence}_${messageType}`;
};

export const buildTurnId = (sessionId: string, sequence: number): string => {
	return `${sessionId}_${sequence}_${SUFFIX.FULL}`;
};

export const buildSummaryId = (sessionId: string): string => {
	return `${sessionId}_${SUFFIX.SUMMARY}`;
};

export const parseMessageId = (
	messageId: string
): { sessionId: string; sequence: number; type: SuffixType; index?: number } => {
	const parts = messageId.split('_');
	if (parts.length < 3) {
		throw new Error(`Invalid message ID format: ${messageId}`);
	}

	const lastPart = parts[parts.length - 1];
	const secondLastPart = parts[parts.length - 2];

	if (lastPart === SUFFIX.SUMMARY) {
		return {
			sessionId: parts.slice(0, parts.length - 1).join('_'),
			sequence: -1, // No sequence for summaries
			type: SUFFIX.SUMMARY,
		};
	} else if (lastPart === SUFFIX.FULL) {
		return {
			sessionId: parts.slice(0, parts.length - 2).join('_'),
			sequence: parseInt(secondLastPart, 10),
			type: SUFFIX.FULL,
		};
	} else if (lastPart.match(/^\d+$/)) {
		return {
			sessionId: parts.slice(0, parts.length - 3).join('_'),
			sequence: parseInt(parts[parts.length - 3], 10),
			type: SUFFIX.RESPONSE,
			index: parseInt(lastPart, 10),
		};
	} else {
		return {
			sessionId: parts.slice(0, parts.length - 2).join('_'),
			sequence: parseInt(secondLastPart, 10),
			type: lastPart as SuffixType,
		};
	}
};

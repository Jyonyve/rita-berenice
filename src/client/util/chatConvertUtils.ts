import { AiRole } from '#root/src/client/domain/aimodel';
import { ChatEntry, ChatMessage, ChatTurn } from '#root/src/client/domain/chat';
import { MessageContent, MessageContentText } from '@langchain/core/messages';
import { ChatCompletion } from 'openai/resources/chat';
import { v4 as uuidv4 } from 'uuid';

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
	const { request, response, sessionId, sequence, isTemp } = chatTurn;

	const jsonObject = {
		sessionId,
		sequence,
		isTemp,
		request: { ...request, entries: request.entries.map(parseEntryToJson) },
		response: { ...response, entries: response.entries.map(parseEntryToJson) },
	};

	return JSON.stringify(jsonObject, null, 2);
};

export const buildChatTurnToText = (chatTurn: ChatTurn): string => {
	const { request, response } = chatTurn;

	const requestPrompt = `
	speaker: ${request.speaker}\n
	prompt: ${parseEntriesToText(request.entries)}`;

	const responsePrompt = `
	speaker: ${response.speaker}\n	
	prompt: ${parseEntriesToText(response.entries)}`;

	return `${requestPrompt}\n${responsePrompt}`;
};

export const buildChatMessage = (speaker: AiRole, text: string, sessionId: string): ChatMessage => {
	const entries: ChatEntry[] = parseTextToEntries(text);
	return {
		messageId: `${sessionId}_${Date.now()}`,
		speaker,
		entries,
		timestamp: new Date().toISOString(),
	};
};

export const removeLocalPrefix = (localModel: string): string => {
	const prefix = 'local_';
	return localModel.startsWith(prefix) ? localModel.slice(prefix.length) : localModel;
};

export const buildNewSessionId = (characterLabel: string): string => {
	return `${characterLabel}_${uuidv4()}`;
};

export const extractValidOpenAiContent = (response: ChatCompletion): string => {
	if (!response?.choices?.length) return '';

	// Find first valid content from choices
	const validChoice = response.choices.find((choice) => choice?.message?.content != null);

	return validChoice?.message?.content || '';
};

export const convertMessageContentToString = (content: MessageContent): string => {
	let result = '';
	if (typeof content === 'string') {
		result = content;
	} else if (Array.isArray(content)) {
		const textContent = content.find((content) => content.type === 'text') as MessageContentText;
		result = textContent ? textContent.text : JSON.stringify(content);
	} else {
		result = JSON.stringify(content);
	}
	return result;
};

import {
	ChatEntry,
	ChatMessage,
	ChatMessageType,
	ChatRoleType,
} from '#shared/domain/chat/ChatInterfaces.js';
import { DEFAULT_EMOTION, EmotionValue } from '#shared/config/emotionWordsMapper.js';
export const parseEntriesToConversation = (entries: ChatEntry[]): string => {
	return entries
		.map((entry) => (entry.type === 'dialogue' ? `"${entry.prompt}"` : entry.prompt))
		.join('\n');
};

export const parseConversationToEntries = (text: string): ChatEntry[] => {
	const entries: ChatEntry[] = [];

	// For comprehensive quote normalization
	const normalizedText = text
		.replace(/[""‟"]/g, '"') // Double quotes
		.replace(/[''‛']/g, "'"); // Single quotes and apostrophes

	// Use normalizedText instead of text!
	const regex = /"([^"]+)"|([^"]+)/g;
	let match;

	while ((match = regex.exec(normalizedText)) !== null) {
		if (match[1]) {
			// Quoted text is dialogue
			entries.push({ type: 'dialogue', prompt: match[1].trim() });
		} else if (match[2]) {
			// Unquoted text is action
			const actionText = match[2].trim();
			if (actionText) {
				// Only add non-empty text
				entries.push({ type: 'action', prompt: actionText });
			}
		}
	}

	return entries;
};

export const buildChatMessage = (
	role: ChatRoleType,
	sequence: number,
	showName: string,
	entriesString: string,
	sessionId: string,
	emotion?: EmotionValue,
	model?: string
): ChatMessage => {
	const entries: ChatEntry[] = parseConversationToEntries(entriesString);
	const messageType: ChatMessageType = role === 'user' ? 'request' : 'response';
	return {
		role,
		sequence,
		sessionId,
		entries,
		messageId: '',
		messageType,
		showName,
		emotion: emotion || DEFAULT_EMOTION,
		createdAt: '',
		updatedAt: '',
		type: 'message',
		model: model || '',
	};
};

import { EmotionValue, DEFAULT_EMOTION } from '@rita-berenice/shared/config';
import {
	ChatEntry,
	ChatRoleType,
	ChatMessage,
	ChatMessageType,
} from '@rita-berenice/shared/domain';
import { parseChatEntries, serializeChatEntries } from '@rita-berenice/shared/util';

export const parseEntriesToConversation = (entries: ChatEntry[]): string =>
	serializeChatEntries(entries, 'quoted-dialogue');

export const parseConversationToEntries = (text: string): ChatEntry[] =>
	parseChatEntries(text, 'quoted-dialogue');

export const buildChatMessage = (
	role: ChatRoleType,
	sequence: number,
	showName: string,
	entriesString: string,
	sessionId: string,
	emotion?: EmotionValue,
	model?: string
): ChatMessage => {
	const entries = parseConversationToEntries(entriesString);
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

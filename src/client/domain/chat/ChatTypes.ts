export type ChatType = 'dialogue' | 'action';

type DefaultChatEntry = { type: ChatType; prompt: string };
export type ChatEntry = DefaultChatEntry; // expand if needed

export interface ChatMessage {
	messageId: string;
	speaker: string;
	entries: ChatEntry[];
	timestamp: string; // ISO 8601 format
}
export interface ChatTurn {
	sessionId: string;
	sequence: number;
	request: ChatMessage;
	response: ChatMessage;
	isTemp: boolean;
}

export type ChatSession = { sessionId: string; conversations: ChatTurn[] };

export const SUMMARY_ID_SUFFIX = '_summary' as const;

export const CHAT_ROLES = { SYSTEM: 'system', ASSISTANT: 'assistant', USER: 'user' } as const;

export type ChatRole = (typeof CHAT_ROLES)[keyof typeof CHAT_ROLES];

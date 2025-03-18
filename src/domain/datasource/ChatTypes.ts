export type ChatType = 'dialogue' | 'action';

export type ChatEntry = { type: ChatType; text: string };

export interface ChatTurn {
	speaker: string;
	entries: ChatEntry[];
	timestamp: string; // ISO 8601 format
}

export type ChatSession = { sessionId: string; conversation: ChatTurn[] };

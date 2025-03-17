export interface ChatTurn {
  speaker: string;
  entries: Array<{ type: 'dialogue'; text: string } | { type: 'action'; text: string }>;
  timestamp: string; // ISO 8601 format
}

export type ChatSession = {
  sessionId: string;
  conversation: ChatTurn[];
};

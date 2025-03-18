import { Metadata } from 'chromadb';

export interface ChromaDocument {
	id: string;
	text: string;
	metadata?: Record<string, any>;
}

export interface QueryResult {
	ids: string[];
	documents: (string | null)[];
	metadatas: (Metadata | null)[];
	distances: number[];
}

export interface ConversationContext {
	id: string;
	context: string;
	timestamp: string; // ISO 8601 format
}

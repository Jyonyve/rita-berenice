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

export interface GroupedSession {
	character: string;
	variant: string;
	uuId: string;
}

export type SessionGroups = Record<string, GroupedSession[]>;

export const COLLECTIONS = {
	CHARACTER: 'character',
	PROFILE: 'profile',
	CHAT: 'chat',
	TEMP_CHAT: 'tempChat',
	RECAP: 'recap',
	CREDENTIAL: 'credential',
} as const;

export type CollectionType = keyof typeof COLLECTIONS;

export const METADATA_TYPES = {
	CHARACTER: 'character',
	PROFILE: 'profile',
	MESSAGE: 'message',
	SET: 'set',
	RECAP: 'recap',
	TEMP: 'temp',
};

// src/shared/types/credentials.ts (Example path)
export interface CredentialData {
	// Match the structure used in credentialService
	CHROMA_API_URL?: string;
	OPENAI_API_KEY?: string;
	GROQ_API_KEY?: string;
	OPENROUTER_API_KEY?: string;
	PERPLEXITY_API_KEY?: string;
	ANTHROPIC_API_KEY?: string;
	GOOGLE_API_KEY?: string;
	LANGCHAIN_API_KEY?: string; // Include if managed via user secrets
	BEDROCK_CONFIG?: {
		AWS_REGION?: string;
		AWS_ACCESS_KEY_ID?: string;
		AWS_SECRET_ACCESS_KEY?: string;
		AWS_PROFILE?: string;
		AWS_REPO_URL?: string;
	};
	// Add any other user-configurable secrets here
}

export type CredentialDataType = keyof CredentialData;

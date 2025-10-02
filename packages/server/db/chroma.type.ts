// src/server/db/ChromaInterface.ts
// chroma.type.ts - Metadata as ChromaMetadata ONLY here
import type { Metadata as ChromaMetadata } from 'chromadb';
import { Metadata, ChromaResponse } from '@rita-berenice/shared/api';

// ===== SERVER-ONLY TYPES (ChromaDB Specific) =====

/**
 * ChromaDB's native metadata type alias (includes SparseVector and other complex types)
 * This is what ChromaDB actually returns - we import this from 'chromadb' package
 */
export type ChromaDbMetadata = ChromaMetadata;

/**
 * Internal ChromaDB response format (before conversion to shared types)
 * This represents what we create from ChromaDB's GetResult/QueryResult
 */
export interface ChromaDbResponse {
	ids: string[];
	documents: (string | null)[];
	metadatas: (ChromaDbMetadata | null)[];
	distances?: (number | null)[] | null | undefined;
}

/**
 * ChromaDB document structure for internal use
 */
export interface ChromaDocument {
	id: string;
	text: string;
	metadata?: ChromaDbMetadata;
}

// ===== CONVERSION UTILITIES =====

/**
 * Converts ChromaDB's metadata (which may include SparseVector) to shared metadata format
 * Filters out unsupported types like SparseVector, keeping only basic types
 */
export const convertChromaMetadata = (chromaMetadata: ChromaDbMetadata | null): Metadata | null => {
	if (!chromaMetadata) return null;

	const convertedMetadata: Metadata = {};

	for (const [key, value] of Object.entries(chromaMetadata)) {
		// Only include types that match our shared Metadata interface
		if (
			value === null ||
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean'
		) {
			convertedMetadata[key] = value;
		} else {
			// Log unsupported types for debugging
			console.warn(
				`[ChromaInterface] Skipping unsupported metadata type for key '${key}':`,
				typeof value
			);
		}
	}

	return convertedMetadata;
};

/**
 * Converts array of ChromaDB metadata to shared metadata format
 */
export const convertChromaMetadataArray = (
	chromaMetadatas: (ChromaDbMetadata | null)[]
): (Metadata | null)[] => {
	return chromaMetadatas.map(convertChromaMetadata);
};

/**
 * Converts ChromaDB response to shared ChromaResponse format
 * This is the main conversion function that bridges ChromaDB and shared types
 */
export const convertChromaResponse = (chromaDbResponse: ChromaDbResponse): ChromaResponse => {
	return {
		ids: chromaDbResponse.ids,
		metadatas: convertChromaMetadataArray(chromaDbResponse.metadatas),
		documents: chromaDbResponse.documents,
		distances: chromaDbResponse.distances,
	};
};

/**
 * Converts shared Metadata to ChromaDB metadata format for write operations
 * Since shared Metadata is a subset of ChromaDB metadata, this is a safe cast
 */
export const convertToChromaMetadata = (metadata: Metadata): ChromaDbMetadata => {
	return metadata as ChromaDbMetadata;
};

/**
 * Safe converter for any domain object to ChromaDB Metadata
 * Handles all common types explicitly with proper conversions
 */
export const toChromaMetadata = <T extends Record<string, any>>(obj: T): Metadata => {
	const metadata: Metadata = {};

	for (const [key, value] of Object.entries(obj)) {
		if (value === null || value === undefined) {
			metadata[key] = null;
		} else if (typeof value === 'string') {
			metadata[key] = value;
		} else if (typeof value === 'number') {
			metadata[key] = value;
		} else if (typeof value === 'boolean') {
			metadata[key] = value;
		} else if (value instanceof Date) {
			metadata[key] = value.toISOString();
		} else {
			// Handle enums, symbols, objects, etc. by converting to string
			// This covers your GENDER_OPTION, METADATA_TYPES.CHARACTER, etc.
			metadata[key] = String(value);
		}
	}

	return metadata;
};

// ===== BUSINESS LOGIC TYPES =====

/**
 * Conversation context for chat operations
 */
export interface ConversationContext {
	id: string;
	context: string;
	timestamp: string; // ISO 8601 format
}

/**
 * Session grouping structure
 */
export interface GroupedSession {
	character: string;
	variant: string;
	uuId: string;
}

/**
 * Session groups mapping
 */
export type SessionGroups = Record<string, GroupedSession[]>;

// ===== COLLECTION CONFIGURATION =====

/**
 * Collection names used in ChromaDB
 * These are the actual collection names in the database
 */
export const COLLECTIONS = {
	CHARACTER: 'character',
	PROFILE: 'profile',
	CHAT: 'chat',
	SESSION: 'session',
	TEMP: 'temp',
	RECAP: 'recap',
	LORE: 'lore',
	HISTORY: 'history',
	TERM: 'term',
	CREDENTIAL: 'credential',
	USER: 'user',
} as const;

/**
 * Collection type derived from COLLECTIONS
 */
export type CollectionType = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

// ===== CREDENTIAL MANAGEMENT =====

/**
 * Credential data structure for user-configurable secrets
 */
export interface CredentialData {
	// API Keys
	CHROMA_API_URL?: string;
	OPENAI_API_KEY?: string;
	COHERE_API_KEY?: string;
	GROQ_API_KEY?: string;
	OPENROUTER_API_KEY?: string;
	PERPLEXITY_API_KEY?: string;
	ANTHROPIC_API_KEY?: string;
	GOOGLE_API_KEY?: string;
	LANGCHAIN_API_KEY?: string;

	// AWS Bedrock Configuration
	BEDROCK_CONFIG?: {
		AWS_REGION?: string;
		AWS_ACCESS_KEY_ID?: string;
		AWS_SECRET_ACCESS_KEY?: string;
		AWS_PROFILE?: string;
		AWS_REPO_URL?: string;
	};
}

/**
 * Credential data type keys
 */
export type CredentialDataType = keyof CredentialData;

// ===== EMBEDDING CONFIGURATION =====

/**
 * Supported embedding function types
 */
export type EmbeddingFunction = 'openai' | 'cohere' | 'text';

// ===== UTILITY TYPES =====

/**
 * Generic where clause for ChromaDB filtering
 * Represents the structure used in ChromaDB where clauses
 */
export type WhereClause = Record<string, any>;

/**
 * Include options for ChromaDB queries
 * Matches ChromaDB's IncludeEnum values
 */
export type IncludeOptions = 'documents' | 'metadatas' | 'distances' | 'embeddings' | 'uris';

/**
 * ChromaDB query options
 */
export interface ChromaQueryOptions {
	where?: WhereClause;
	whereDocument?: WhereClause;
	limit?: number;
	offset?: number;
	include?: IncludeOptions[];
}

// ===== TYPE GUARDS =====

/**
 * Type guard to check if a response has distances (QueryResult vs GetResult)
 */
export const hasDistances = (
	response: any
): response is ChromaDbResponse & { distances: number[] } => {
	return response && Array.isArray(response.distances);
};

/**
 * Type guard to check if metadata is ChromaDB metadata
 */
export const isChromaMetadata = (metadata: any): metadata is ChromaDbMetadata => {
	return metadata && typeof metadata === 'object';
};

// ===== EXPORT HELPERS =====

/**
 * Helper to create empty ChromaResponse
 */
export const createEmptyChromaResponse = (): ChromaResponse => ({
	ids: [],
	metadatas: [],
	documents: [],
	distances: [],
});

/**
 * Helper to create empty ChromaDbResponse
 */
export const createEmptyChromaDbResponse = (): ChromaDbResponse => ({
	ids: [],
	metadatas: [],
	documents: [],
	distances: [],
});

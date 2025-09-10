// src/shared/domain/glossaryInterfaces.ts

import { METADATA_TYPES } from '../../config/constants.js';

export interface CharacterTermMetadata {
	characterId: string;
	createdAt: string;
	updatedAt: string;
	termId: string; // Unique ID for this glossary entry (e.g., UUID)
	koreanTerm: string; // The Korean proper noun, e.g., "라이타 베르니스"
	englishTerm: string; // The *current* English translation to be used for summarization guidance.
	initialTerm: string; // The very first English translation suggested by an LLM for this koreanTerm
	type: typeof METADATA_TYPES.CHARACTER;
}
export type CharacterTermInfo = CharacterTermMetadata;

export type CharacterTermCdo = Pick<
	CharacterTermInfo,
	'initialTerm' | 'koreanTerm' | 'characterId'
>;

export interface SessionTermMetadata extends Omit<CharacterTermMetadata, 'type'> {
	sessionId: string;
	type: typeof METADATA_TYPES.SESSION;
}
export type SessionTermInfo = SessionTermMetadata;

export type SessionTermCdo = Pick<SessionTermInfo, 'initialTerm' | 'koreanTerm' | 'sessionId'>;

export type TermType = typeof METADATA_TYPES.SESSION | typeof METADATA_TYPES.CHARACTER;

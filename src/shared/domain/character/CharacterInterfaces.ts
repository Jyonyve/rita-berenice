import type { Metadata } from 'chromadb';
import { EmotionKey } from '../../config/emotionWordsMapper.ts';

export interface CharacterMetadata extends Metadata {
	characterId: string;
	name: string; // character name
	variant: string; // specifier (ex: original| uuid)
	description: string;
	instructions: string; // Field for LLM instructions/persona rules
	showName: string; // 한글 이름
	createdAt: string; // should be ISOstring
	updatedAt: string; // should be ISOstring
	type: string; // e.g., METADATA_TYPES.CHARACTER
}

export interface ProfileMetadata extends Metadata {
	profileId: string;
	name: string; // character name
	description: string;
	showName: string;
	createdAt: string;
	updatedAt: string;
	type: string; // e.g., METADATA_TYPES.PROFILE
}

export interface CharacterInfo {
	characterId: string; // e.g., "tarion-original ; ${id}-{variant}"
	name: string;
	showName: string; // 한글 이름
	metadata: CharacterMetadata;
}

export interface ProfileInfo {
	profileId: string; // e.g., "yonyve-${sessionId}"
	name: string;
	showName: string;
	metadata: ProfileMetadata;
}

export type CharacterImages = Record<string, string[]>;

export interface CharacterAsset {
	images: string[];
	defaultImage: string;
}

export interface CharacterAssets {
	[characterId: string]: Partial<Record<EmotionKey, CharacterAsset>>;
}

export interface CharacterHistory {
	characterId: string;
	title: string;
	content: string;
	sequence: number;
	timeline: number;
}

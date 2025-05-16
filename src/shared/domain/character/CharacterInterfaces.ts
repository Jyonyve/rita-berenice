// src/shared/domain/character/CharacterInterfaces.ts
// if type is stored as metadata, it should be premitive type.
import { Metadata } from 'chromadb';
import { EmotionKey } from '../../config/emotionWordsMapper.ts';
import { METADATA_TYPES } from '../chromadb/ChromaInterfaces.ts';

interface BeingMetadata extends Metadata {
	name: string;
	description: string;
	showName: string;
	createdAt: string;
	updatedAt: string;
	creator: string;
	creatorContact: string;
}

export interface CharacterMetadata extends BeingMetadata {
	characterId: string;
	variant: string;
	instruction: string;
	type: typeof METADATA_TYPES.CHARACTER;
}
export type CharacterInfo = CharacterMetadata;

export interface ProfileMetadata extends BeingMetadata {
	profileId: string; //${name}_${sessionId}
	sessionId: string;
	type: typeof METADATA_TYPES.PROFILE;
}
export type ProfileInfo = ProfileMetadata;

export type CharacterImages = Record<string, string[]>;

export interface CharacterAsset {
	images: string[];
	defaultImage: string;
}

export interface CharacterAssets {
	[characterId: string]: Partial<Record<EmotionKey, CharacterAsset>>;
}

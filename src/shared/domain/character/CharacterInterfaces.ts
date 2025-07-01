// src/shared/domain/character/CharacterInterfaces.ts
// if type is stored as metadata, it should be premitive type.
import { METADATA_TYPES } from '../../config/constants.js';
import { EmotionKey } from '../../config/emotionWordsMapper.js';

interface BeingMetadata {
	name: string;
	gender: string;
	description: string;
	showName: string;
	createdAt: string;
	updatedAt: string;
	creator: string;
	creatorContact: string;
}
export type BasicBeingInfo = Pick<BeingMetadata, 'name' | 'showName' | 'gender'>;

export interface CharacterMetadata extends BeingMetadata {
	characterId: string;
	variant: string;
	type: typeof METADATA_TYPES.CHARACTER;
}
export interface CharacterInfo extends CharacterMetadata {
	description: string;
	instruction: string;
}

export interface ProfileMetadata extends BeingMetadata {
	profileId: string; //${name}_${sessionId}
	sessionId: string;
	type: typeof METADATA_TYPES.PROFILE;
}
export interface ProfileInfo extends ProfileMetadata {
	description: string;
}

export type ProfileCdo = Pick<
	ProfileInfo,
	'creatorContact' | 'description' | 'gender' | 'name' | 'showName'
>;

export type CharacterImages = Record<string, string[]>;

export interface CharacterAsset {
	images: string[];
	defaultImage: string;
}

export interface CharacterAssets {
	[characterId: string]: Partial<Record<EmotionKey, CharacterAsset>>;
}

export type CharacterCdo = Pick<
	CharacterInfo,
	'creator' | 'creatorContact' | 'description' | 'instruction' | 'gender' | 'name' | 'showName'
>;

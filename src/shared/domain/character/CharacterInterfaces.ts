// src/shared/domain/character/CharacterInterfaces.ts
// if type is stored as metadata, it should be premitive type.
import { METADATA_TYPES } from '../../config/constants.js';
import { EmotionKey } from '../../config/emotionWordsMapper.js';

export interface BeingMetadata {
	name: string;
	gender: string;
	title: string;
	showName: string;
	createdAt: string;
	updatedAt: string;
	userId: string;
}
export type BasicBeingInfo = Pick<BeingMetadata, 'name' | 'showName' | 'gender'>;

export interface CharacterMetadata extends BeingMetadata {
	characterId: string;
	variant: string;
	contact: string;
	type: typeof METADATA_TYPES.CHARACTER;
}
export interface CharacterInfo extends CharacterMetadata {
	description: string;
	instruction: string;
}

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
	'contact' | 'description' | 'instruction' | 'gender' | 'name' | 'showName' | 'userId'
>;

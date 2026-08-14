// src/shared/domain/character/CharacterInterfaces.ts
// if type is stored as metadata, it should be premitive type.
import { CharacterVisibility, GENDER_OPTION, METADATA_TYPES } from '../../config/constants.js';
import { EmotionKey } from '../../config/emotionConstants.js';

export interface BeingMetadata {
	name: string;
	gender: GENDER_OPTION;
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
	visibility: CharacterVisibility;
}
export interface CharacterDocument {
	description: string; // Public character introduction and baseline LLM context
	worldIntroduction: string; // Public, character-scoped world introduction and baseline LLM context
	instruction: string; // Persona and response instructions for the LLM
	worldLoreId: string;
	firstMessage: string; // optional
}

export type CharacterInfo = CharacterMetadata & CharacterDocument;

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
	| 'title'
	| 'contact'
	| 'description'
	| 'worldIntroduction'
	| 'instruction'
	| 'gender'
	| 'name'
	| 'showName'
	| 'userId'
	| 'worldLoreId'
	| 'firstMessage'
>;

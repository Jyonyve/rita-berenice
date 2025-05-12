import { EmotionKey } from '../../config/emotionWordsMapper.ts';
import { METADATA_TYPES } from '../chromadb/ChromaInterfaces.ts';

export interface BasicBeingInfo {
	name: string;
	description: string;
	showName: string;
	createdAt: string;
	updatedAt: string;
}
export interface CharacterInfo extends BasicBeingInfo {
	characterId: string;
	variant: string; // specifier (ex: original| uuid)
	instruction: string; // Field for LLM instructions/persona rules
	type: typeof METADATA_TYPES.CHARACTER;
	creator: string;
	creatorContact: string;
}

export interface ProfileInfo extends BasicBeingInfo {
	profileId: string; //${name}_${sessionId}
	sessionId: string;
	type: typeof METADATA_TYPES.PROFILE;
}

export type CharacterImages = Record<string, string[]>;

export interface CharacterAsset {
	images: string[];
	defaultImage: string;
}

export interface CharacterAssets {
	[characterId: string]: Partial<Record<EmotionKey, CharacterAsset>>;
}

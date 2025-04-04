import type { Metadata } from 'chromadb';

interface CharacterMetadata extends Metadata {
	id: string; // character name
	variant: string; // specifier (ex: original| uuid)
	description: string;
	createdAt: string;
	updatedAt: string;
}

interface ProfileMetadata extends Metadata {
	id: string; // character name
	description: string;
	createdAt: string;
	updatedAt: string;
}

export interface CharacterInfo {
	id: string; // e.g., "tarion-original ; ${id}-{variant}"
	showName: string; // 한글 이름
	metadata: CharacterMetadata;
}

export interface ProfileInfo {
	id: string; // e.g., "yonyve-${sessionId}"
	showName: string;
	metadata: ProfileMetadata;
}

export interface CharacterImages {
	[key: string]: {
		[key: string]: string[]; // Each type can have multiple images
	};
}

interface CharacterAsset {
	images: string[];
	defaultImage: string;
}

export interface CharacterAssets {
	[character: string]: { [type: string]: CharacterAsset };
}

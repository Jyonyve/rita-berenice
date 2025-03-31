import { Metadata } from 'chromadb';

export interface CharacterMetadata extends Metadata {
	character: string;
	variant: string;
	showName: string; // 한글 이름
}

export interface CharacterInfo {
	id: string; // e.g., "tarion-original"
	metadata: CharacterMetadata;
}

export interface CharacterImages {
	[key: string]: {
		[key: string]: string[]; // Each type can have multiple images
	};
}

export interface CharacterAsset {
	images: string[];
	defaultImage: string;
}

export interface CharacterAssets {
	[character: string]: { [type: string]: CharacterAsset };
}

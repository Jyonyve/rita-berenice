// src/client/util/portraitUtil.ts

import {
	DEFAULT_EMOTION,
	EmotionKey,
	numberToEmotionWordsMap,
	PortraitUrlMap,
	validEmotionKeys,
	validEmotions,
} from '#shared/config/emotionWordsMapper.js';

// --- DATA STORES ---
const allPortraitsMap = new Map<string, PortraitUrlMap>();
const defaultPortraitsMap = new Map<string, string>();

// Flag to track if initialization has happened
let isInitialized = false;

/**
 * Parses the characterId from a given asset file path.
 */
function getCharacterIdFromPath(path: string): string | null {
	const match = path.match(/\/asset\/character\/([^/]+)\//);
	return match ? match[1] : null;
}

/**
 * Lazy initialization function that only runs when first needed.
 * This ensures it runs AFTER React and the CacheProvider are established.
 */
function initializePortraits(): void {
	if (isInitialized) return; // Only run once

	console.log('[PortraitUtil] Initializing all character portraits...');

	// Use Vite's glob import to get all portrait images
	const allImageModules = import.meta.glob<string>(
		['/src/client/asset/character/*/*.webp', '/src/client/asset/character/*/*.avif'],
		{ eager: true, import: 'default' }
	) as Record<string, string>;

	const filenameRegex = /_(\d+)\.(webp|avif)$/;

	for (const path in allImageModules) {
		const characterId = getCharacterIdFromPath(path);
		if (!characterId) continue;

		const match = path.match(filenameRegex);
		if (!match || !match[1]) continue;

		const imageNumber = parseInt(match[1], 10) as EmotionKey;
		if (!validEmotionKeys.has(imageNumber)) continue;

		const portraitMap = allPortraitsMap.get(characterId) || {};
		portraitMap[imageNumber] = allImageModules[path];
		allPortraitsMap.set(characterId, portraitMap);

		if (imageNumber === getImageNumberForEmotion(DEFAULT_EMOTION)) {
			defaultPortraitsMap.set(characterId, allImageModules[path]);
		}
	}

	isInitialized = true;
	console.log(
		`[PortraitUtil] Initialization complete. Loaded portraits for ${allPortraitsMap.size} characters.`
	);
}

function getImageNumberForEmotion(emotion: string): EmotionKey {
	const lowerEmotion = emotion.toLowerCase();
	if (validEmotions.has(lowerEmotion)) {
		for (const [numStr, keywords] of Object.entries(numberToEmotionWordsMap)) {
			if ((keywords as readonly string[]).includes(lowerEmotion)) {
				return Number(numStr) as EmotionKey;
			}
		}
	}
	return 0;
}

// --- PUBLIC API ---
// Each function now calls initializePortraits() to ensure lazy initialization

export function getAllPortraits(characterId: string): PortraitUrlMap | undefined {
	initializePortraits(); // Lazy init on first access
	return allPortraitsMap.get(characterId);
}

export function getDefaultImage(characterId: string) {
	initializePortraits(); // Lazy init on first access
	return defaultPortraitsMap.get(characterId);
}

export function getImageForEmotion(characterId: string, emotion: string): string | undefined {
	initializePortraits(); // Lazy init on first access
	const allPortraits = allPortraitsMap.get(characterId);
	if (!allPortraits) return defaultPortraitsMap.get(characterId);

	const imageNumber = getImageNumberForEmotion(emotion);
	return allPortraits[imageNumber] ?? defaultPortraitsMap.get(characterId);
}

export function getAllDefaultImageMap() {
	initializePortraits(); // Lazy init on first access
	return defaultPortraitsMap;
}

export function getCharacterImages(characterId: string) {
	initializePortraits(); // Lazy init on first access
	return allPortraitsMap.get(characterId);
}

export function getCharacterImageArray(characterId: string): string[] {
	initializePortraits(); // Lazy init on first access
	const portraits = allPortraitsMap.get(characterId);
	if (!portraits) return [];
	return Object.values(portraits).filter(Boolean);
}

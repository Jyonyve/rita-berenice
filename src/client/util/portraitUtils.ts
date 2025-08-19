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
// NEW: Data store for lore-specific images, mapping characterId -> (historyId -> URL)
const lorePortraitsMap = new Map<string, Map<string, string>>();

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
 * NEW: Parses characterId and historyId from a lore image path.
 * Example path: /src/client/asset/character/charId123/lore/historyId456.avif
 */
function getLoreInfoFromPath(path: string): { characterId: string; historyId: string } | null {
	const match = path.match(/\/asset\/character\/([^/]+)\/lore\/([^/.]+)\.\w+$/);
	if (match && match[1] && match[2]) {
		return { characterId: match[1], historyId: match[2] };
	}
	return null;
}

/**
 * Lazy initialization function that now handles both emotion and lore portraits.
 */
function initializePortraits(): void {
	if (isInitialized) return; // Only run once

	console.log('[PortraitUtil] Initializing all character and lore portraits...');

	// UPDATED: Glob pattern now includes the /lore/ subdirectory
	const allImageModules = import.meta.glob<string>(
		[
			'/src/client/asset/character/*/*.{webp,avif}',
			'/src/client/asset/character/*/lore/*.{webp,avif}',
		],
		{ eager: true, import: 'default' }
	) as Record<string, string>;

	const emotionFilenameRegex = /_(\d+)\.(webp|avif)$/;

	for (const path in allImageModules) {
		// First, check if it's a lore image by matching the path structure
		const loreInfo = getLoreInfoFromPath(path);
		if (loreInfo) {
			const { characterId, historyId } = loreInfo;
			// Get or create the inner map for the character
			const loreMap = lorePortraitsMap.get(characterId) || new Map<string, string>();
			loreMap.set(historyId, allImageModules[path]);
			lorePortraitsMap.set(characterId, loreMap);
			continue; // Skip to the next file
		}

		// If not a lore image, process it as a standard emotion portrait
		const characterId = getCharacterIdFromPath(path);
		if (!characterId) continue;

		const match = path.match(emotionFilenameRegex);
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
		`[PortraitUtil] Initialization complete. Loaded emotion portraits for ${allPortraitsMap.size} characters and lore images for ${lorePortraitsMap.size} characters.`
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
	return 0; // Default emotion key (e.g., 'neutral')
}

// --- PUBLIC API (Emotion Portraits) ---
// All existing functions work as before and use lazy initialization.

export function getAllPortraits(characterId: string): PortraitUrlMap | undefined {
	initializePortraits();
	return allPortraitsMap.get(characterId);
}

export function getDefaultImage(characterId: string): string | undefined {
	initializePortraits();
	return defaultPortraitsMap.get(characterId);
}

export function getImageForEmotion(characterId: string, emotion: string): string | undefined {
	initializePortraits();
	const allPortraits = allPortraitsMap.get(characterId);
	if (!allPortraits) return defaultPortraitsMap.get(characterId);

	const imageNumber = getImageNumberForEmotion(emotion);
	return allPortraits[imageNumber] ?? defaultPortraitsMap.get(characterId);
}

export function getAllDefaultImageMap(): Map<string, string> {
	initializePortraits();
	return defaultPortraitsMap;
}

export function getCharacterImageArray(characterId: string): string[] {
	initializePortraits();
	const portraits = allPortraitsMap.get(characterId);
	if (!portraits) return [];
	return Object.values(portraits).filter(Boolean);
}

// --- NEW PUBLIC API (Lore Images) ---

/**
 * Retrieves a specific lore image for a character given a historyId.
 * @param characterId - The ID of the character.
 * @param historyId - The ID of the lore/history item (filename without extension).
 * @returns The URL of the image, or undefined if not found.
 */
export function getLoreImage(characterId: string, historyId: string): string | undefined {
	initializePortraits(); // Ensures all images are loaded before access
	const loreMap = lorePortraitsMap.get(characterId);
	return loreMap ? loreMap.get(historyId) : undefined;
}

/**
 * Retrieves all lore images for a given character.
 * @param characterId - The ID of the character.
 * @returns A Map where keys are historyIds and values are image URLs, or undefined if none exist.
 */
export function getAllLoreImages(characterId: string): Map<string, string> | undefined {
	initializePortraits(); // Ensures all images are loaded before access
	return lorePortraitsMap.get(characterId);
}

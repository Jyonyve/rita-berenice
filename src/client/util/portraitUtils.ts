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
// 1. Stores all portraits for every character, keyed by characterId.
const allPortraitsMap = new Map<string, PortraitUrlMap>();
// 2. Stores only the default portrait URL for each character, for quick access.
const defaultPortraitsMap = new Map<string, string>();

/**
 * Parses the characterId from a given asset file path.
 * e.g., "/src/client/asset/character/my-char-id/my-char-id_1.webp" -> "my-char-id"
 */
function getCharacterIdFromPath(path: string): string | null {
	const match = path.match(/\/asset\/character\/([^/]+)\//);
	return match ? match[1] : null;
}

/**
 * IIFE (Immediately Invoked Function Expression) to initialize portraits on app startup.
 * This runs only once when the module is first imported.
 */
(() => {
	console.log('[PortraitUtil] Initializing all character portraits...');
	// Use Vite's glob import to get all portrait images.
	const allImageModules = import.meta.glob<string>(
		['/src/client/asset/character/*/*.webp', '/src/client/asset/character/*/*.avif'],
		{ eager: true, import: 'default' }
	) as Record<string, string>;

	// Regex to extract the emotion number from the filename (e.g., "my-char-id_5.webp")
	const filenameRegex = /_(\d+)\.(webp|avif)$/;

	for (const path in allImageModules) {
		const characterId = getCharacterIdFromPath(path);
		if (!characterId) continue;

		const match = path.match(filenameRegex);
		if (!match || !match[1]) continue;

		const imageNumber = parseInt(match[1], 10) as EmotionKey;
		if (!validEmotionKeys.has(imageNumber)) continue;

		// Get or create the portrait map for this character
		const portraitMap = allPortraitsMap.get(characterId) || {};
		portraitMap[imageNumber] = allImageModules[path];
		allPortraitsMap.set(characterId, portraitMap);

		// If this is the default emotion, also store it in the separate default map
		if (imageNumber === getImageNumberForEmotion(DEFAULT_EMOTION)) {
			defaultPortraitsMap.set(characterId, allImageModules[path]);
		}
	}

	console.log(
		`[PortraitUtil] Initialization complete. Loaded portraits for ${allPortraitsMap.size} characters.`
	);
})();

// --- PUBLIC API ---

function getImageNumberForEmotion(emotion: string): EmotionKey {
	const lowerEmotion = emotion.toLowerCase();
	if (validEmotions.has(lowerEmotion)) {
		for (const [numStr, keywords] of Object.entries(numberToEmotionWordsMap)) {
			if ((keywords as readonly string[]).includes(lowerEmotion)) {
				return Number(numStr) as EmotionKey;
			}
		}
	}
	return 0; // Fallback to default
}

/**
 * Retrieves the map of all portraits for a given character.
 * @param characterId The ID of the character.
 * @returns A PortraitUrlMap or undefined if the character is not found.
 */
export function getAllPortraits(characterId: string): PortraitUrlMap | undefined {
	return allPortraitsMap.get(characterId);
}

/**
 * Retrieves the default portrait image URL for a given character.
 * @param characterId The ID of the character.
 * @returns The image URL string or undefined if not found.
 */
export function getDefaultImage(characterId: string) {
	return defaultPortraitsMap.get(characterId);
}

/**
 * Retrieves a specific portrait for a character based on an emotion keyword.
 * @param characterId The ID of the character.
 * @param emotion The emotion keyword (e.g., "happy", "surprised").
 * @returns The image URL string or the default portrait if the emotion is not found.
 */
export function getImageForEmotion(characterId: string, emotion: string): string | undefined {
	const allPortraits = allPortraitsMap.get(characterId);
	if (!allPortraits) return defaultPortraitsMap.get(characterId);

	const imageNumber = getImageNumberForEmotion(emotion);
	return allPortraits[imageNumber] ?? defaultPortraitsMap.get(characterId);
}

export function getAllDefaultImageMap() {
	return defaultPortraitsMap;
}

export function getCharacterImages(characterId: string) {
	return allPortraitsMap.get(characterId);
}

export function getCharacterImageArray(characterId: string): string[] {
	const portraits = allPortraitsMap.get(characterId);
	if (!portraits) {
		return []; // Return an empty array if the character has no portraits
	}
	// Get all values from the record and filter out any falsy ones (null, undefined, '')
	return Object.values(portraits).filter(Boolean);
}

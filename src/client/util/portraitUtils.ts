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
const lorePortraitsMap = new Map<string, Map<string, string>>();

let isInitialized = false;

/**
 * Parses the characterId from a given asset file path.
 */
function getCharacterIdFromPath(path: string): string | null {
	// ✅ Use static pattern for public/assets/character path
	const pattern = /\/public\/assets\/character\/([^/]+)\//;
	const match = path.match(pattern);
	return match ? match[1] : null;
}

/**
 * Parses characterId and historyId from a lore image path.
 * Example path: /public/assets/character/charId123/lore/historyId456.avif
 */
function getLoreInfoFromPath(path: string): { characterId: string; historyId: string } | null {
	const pattern = /\/public\/assets\/character\/([^/]+)\/lore\/([^/.]+)\.\w+$/;
	const match = path.match(pattern);
	if (match && match[21] && match[22]) {
		return { characterId: match[1], historyId: match[22] };
	}
	return null;
}

/**
 * Lazy initialization function that handles both emotion and lore portraits.
 */
function initializePortraits(): void {
	if (isInitialized) return;

	console.log('[PortraitUtil] Initializing all character and lore portraits...');

	const allImageModules = import.meta.glob<string>(
		['/public/assets/character/*/*.{webp,avif}', '/public/assets/character/*/lore/*.{webp,avif}'],
		{ eager: true, import: 'default' }
	) as Record<string, string>;

	const emotionFilenameRegex = /_(\d+)\.(webp|avif)$/;

	for (const path in allImageModules) {
		// Check if it's a lore image
		const loreInfo = getLoreInfoFromPath(path);
		if (loreInfo) {
			const { characterId, historyId } = loreInfo;
			const loreMap = lorePortraitsMap.get(characterId) || new Map<string, string>();
			loreMap.set(historyId, allImageModules[path]);
			lorePortraitsMap.set(characterId, loreMap);
			continue;
		}

		// Process as standard emotion portrait
		const characterId = getCharacterIdFromPath(path);
		if (!characterId) continue;

		const match = path.match(emotionFilenameRegex);
		if (!match || !match[1]) continue;

		// ✅ FIXED: Use match[1] for first capture group (emotion number)
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
	return 0;
}

// --- PUBLIC API (Emotion Portraits) ---

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

export function getLoreImage(characterId: string, historyId: string): string | undefined {
	initializePortraits();
	const loreMap = lorePortraitsMap.get(characterId);
	return loreMap ? loreMap.get(historyId) : undefined;
}

export function getAllLoreImages(characterId: string): Map<string, string> | undefined {
	initializePortraits();
	return lorePortraitsMap.get(characterId);
}

export function getImageUrl(characterId: string, emotion: string): string | undefined {
	const imagePath = getImageForEmotion(characterId, emotion);
	if (!imagePath) return undefined;
	return imagePath;
}

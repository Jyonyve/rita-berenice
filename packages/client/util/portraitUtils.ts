// src/client/util/portraitUtil.ts

import {
	DEFAULT_EMOTION,
	EmotionKey,
	numberToEmotionWordsMap,
	PortraitUrlMap,
	validEmotionKeys,
	validEmotions,
} from '@rita-berenice/shared/config/emotionConstants.js';

// --- DATA STORES ---
const allPortraitsMap = new Map<string, PortraitUrlMap>();
const defaultPortraitsMap = new Map<string, string>();
const lorePortraitsMap = new Map<string, Map<string, string>>();

let isInitialized = false;

// Parses characterId from a URL like /assets/character/charId123/...
function getCharacterIdFromPath(path: string): string | null {
	const pattern = /^\/assets\/character\/([^/]+)\//;
	const match = path.match(pattern);
	return match ? match[1] : null;
}

// Parses characterId and historyId from a lore image URL.
function getLoreInfoFromPath(path: string): { characterId: string; historyId: string } | null {
	const pattern = /^\/assets\/character\/([^/]+)\/lore\/([^/.]+)\.\w+$/;
	const match = path.match(pattern);
	if (match && match[1] && match[2]) {
		return { characterId: match[1], historyId: match[2] };
	}
	return null;
}

function initializePortraits(): void {
	if (isInitialized) return;
	console.log('[PortraitUtil] Initializing all character and lore portraits...');

	// This glob pattern is more explicit and reliable for finding files in subdirectories.
	const allImageModules = import.meta.glob<string>('/public/assets/character/**/*.{webp,avif}', {
		eager: true,
		import: 'default',
	}) as Record<string, string>;

	const emotionFilenameRegex = /_(\d+)\.(webp|avif)$/;

	for (const path in allImageModules) {
		// Create the correct web-accessible URL by removing the '/public' prefix.
		const finalImageUrl = path.replace('/public', '');

		// ✅ RESTORED: First, check if the path is for a lore image.
		const loreInfo = getLoreInfoFromPath(finalImageUrl);
		if (loreInfo) {
			const { characterId, historyId } = loreInfo;
			const loreMap = lorePortraitsMap.get(characterId) || new Map<string, string>();
			loreMap.set(historyId, finalImageUrl);
			lorePortraitsMap.set(characterId, loreMap);
			// continue to the next file, as this is not an emotion portrait.
			continue;
		}

		// If it's not a lore image, process it as a standard emotion portrait.
		const characterId = getCharacterIdFromPath(finalImageUrl);
		if (!characterId) continue;

		const match = finalImageUrl.match(emotionFilenameRegex);
		if (!match || !match[1]) continue;

		const imageNumber = parseInt(match[1], 10) as EmotionKey;
		if (!validEmotionKeys.has(imageNumber)) continue;

		const portraitMap = allPortraitsMap.get(characterId) || {};
		portraitMap[imageNumber] = finalImageUrl;
		allPortraitsMap.set(characterId, portraitMap);

		if (imageNumber === getImageNumberForEmotion(DEFAULT_EMOTION)) {
			defaultPortraitsMap.set(characterId, finalImageUrl);
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

// --- (All your PUBLIC API functions remain the same) ---

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

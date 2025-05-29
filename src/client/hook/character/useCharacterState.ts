// src/client/hooks/useCharacterState.ts

import { useState, useEffect, useRef } from 'react';
import {
	validEmotions,
	DEFAULT_IMAGE_NUMBER,
	EmotionKey,
	numberToEmotionWordsMap,
	PortraitUrlMap,
	validEmotionKeys,
} from '@shared/config/index.ts';
import { convertStringToArray } from '#root/src/shared/index.ts';

function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * Hook to load and manage numbered portrait images for a specific character.
 * Assumes assets are bundled client-side and uses loadNumberedPortraits.
 *
 * @param characterId The ID of the character (e.g., "monday-original"). Can be null/undefined.
 * @returns Object containing the portrait map, loading state, and any error message.
 */
// Ensure types for state are set correctly
export const useCharacterState = (characterId?: string) => {
	// --- Hooks called at TOP LEVEL (Correct) ---
	const [portraitMap, setPortraitMap] = useState<PortraitUrlMap>({}); // Use PortraitMap type
	const [isLoading, setIsLoading] = useState(false);
	const [portraitError, setPortraitError] = useState<string>();
	const loadingRef = useRef<string | null>(null);

	// --- functions  ---
	/**
	 * Loads portrait images for a given characterId from the asset directory.
	 * Images are expected to be named like: {characterId}_{NUMBER}.webp or .avif,
	 * where {NUMBER} corresponds to an EmotionKey (e.g., 0, 1, 2...).
	 */
	const initPortraitMap = async (characterId: string): Promise<PortraitUrlMap> => {
		console.log(`[loadNumberedPortraits] Loading portraits for character: ${characterId}`);
		const imageMap: PortraitUrlMap = {};

		// Vite's import.meta.glob for dynamic bulk import of image URLs
		const imageModules = import.meta.glob<{ default: string }>(
			[
				'/src/client/asset/character/*/*.webp', // .webp files
				'/src/client/asset/character/*/*.avif', // .avif files
			],
			{
				eager: true,
				import: 'default', // must be a literal string, not a variable
			}
		) as Record<string, { default: string }>;

		const characterAssetPathPrefix = `/src/client/asset/character/${characterId}/`;
		const characterFilenamePrefix = `${characterId}_`;
		// Support both .webp and .avif extensions
		const filenameRegex = new RegExp(
			`^${escapeRegExp(characterFilenamePrefix)}(\\d+)\\.(webp|avif)$`
		);

		for (const originalPath in imageModules) {
			if (originalPath.startsWith(characterAssetPathPrefix)) {
				const filenameWithExt = originalPath.substring(characterAssetPathPrefix.length);
				const match = filenameWithExt.match(filenameRegex);

				if (match && match[1]) {
					const imageNumber = parseInt(match[1], 10);

					if (validEmotionKeys.has(imageNumber as EmotionKey)) {
						imageMap[imageNumber as EmotionKey] = imageModules[originalPath].default;
					} else {
						console.warn(
							`[loadNumberedPortraits] Parsed image number ${imageNumber} from "${originalPath}" is not a valid EmotionKey. Skipping.`
						);
					}
				} else {
					if (!filenameWithExt.includes('thumbnail') && !filenameWithExt.startsWith('.')) {
						console.warn(
							`[loadNumberedPortraits] File "${originalPath}" in character folder for ${characterId} does not match expected portrait naming pattern (${characterFilenamePrefix}{NUMBER}.webp|avif).`
						);
					}
				}
			}
		}

		if (Object.keys(imageMap).length === 0) {
			console.warn(
				`[loadNumberedPortraits] No valid portraits loaded for ${characterId}. ` +
					`Please check filenames in ${characterAssetPathPrefix} match the pattern: ${characterFilenamePrefix}{NUMBER}.webp or .avif, ` +
					`where {NUMBER} is a key in numberToEmotionWordsMap (e.g., 0, 1, ...).`
			);
		} else {
			console.log(
				`[loadNumberedPortraits] Loaded ${Object.keys(imageMap).length} portraits for ${characterId}. Keys: ${convertStringToArray(Object.keys(imageMap)))}`
			);
		}

		return imageMap;
	};

	// --- useEffect Hook (Correct) ---
	useEffect(() => {
		// Reset state if characterId is cleared
		if (!characterId) {
			setPortraitMap({});
			setIsLoading(false);
			setPortraitError(undefined);
			loadingRef.current = null;
			console.log('[useCharacterState] Character ID cleared, resetting state.');
			return;
		}

		// --- Fetch portraits logic remains ---
		const loadPortraits = async () => {
			if (loadingRef.current === characterId) {
				console.log(
					`[useCharacterState] Load already in progress for ${characterId}, skipping duplicate request.`
				);
				return;
			}
			console.log(`[useCharacterState] Initiating portrait load for ${characterId}`);
			loadingRef.current = characterId;
			setIsLoading(true);
			setPortraitError(undefined);
			setPortraitMap({});

			try {
				// Correctly call the imported utility function
				const images = await initPortraitMap(characterId);
				console.log(images);
				// Race Condition Check
				if (loadingRef.current === characterId) {
					setPortraitMap(images);
					if (Object.keys(images).length === 0) {
						const errMsg = `No portrait images found for character ID: ${characterId}. Check asset path/naming.`;
						console.warn(`[useCharacterState] ${errMsg}`);
						setPortraitError(errMsg);
					} else {
						console.log(
							`[useCharacterState] Successfully loaded ${Object.keys(images).length} portraits for ${characterId}.`
						);
						setPortraitError(undefined);
					}
					setIsLoading(false);
					loadingRef.current = null;
				} else {
					console.log(
						`[useCharacterState] Discarding stale portrait results for ${characterId} (now loading ${loadingRef.current}).`
					);
				}
			} catch (err) {
				console.error(`[useCharacterState] Failed to load portraits for ${characterId}`, err);
				if (loadingRef.current === characterId) {
					setPortraitError(err instanceof Error ? err.message : 'Failed to load character images.');
					setIsLoading(false);
					setPortraitMap({});
					loadingRef.current = null;
				} else {
					console.log(
						`[useCharacterState] Discarding stale error for ${characterId} (now loading ${loadingRef.current}).`
					);
				}
			}
		};

		loadPortraits();
	}, [characterId]); // Dependency array is correct

	function getImageNumberForEmotion(emotion: string): EmotionKey {
		const lowerEmotion = emotion.toLowerCase();

		if (_isValidEmotion(lowerEmotion)) {
			for (const [numStr, keywords] of Object.entries(numberToEmotionWordsMap)) {
				if ((keywords as readonly string[]).includes(lowerEmotion)) {
					return Number(numStr) as EmotionKey;
				}
			}
		}
		console.warn(
			`Emotion keyword "${emotion}" not found. Returning default image number ${DEFAULT_IMAGE_NUMBER}.`
		);
		return DEFAULT_IMAGE_NUMBER;
	}

	function _isValidEmotion(emotion?: string): boolean {
		if (!emotion) return false;
		if (validEmotions.has(emotion)) return true;
		console.warn(`Invalid or unmapped emotion keyword: "${emotion}".`);
		return false;
	}
	// --- Return statement (Correct) ---
	return { portraitMap, isLoadingPortraits: isLoading, portraitError, getImageNumberForEmotion };
};

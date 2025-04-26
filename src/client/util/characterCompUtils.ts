// src/client/utils/characterCompUtils.ts

// Import shared constants/types
import {
	DEFAULT_IMAGE_NUMBER,
	EmotionKey, // Assuming this type (0 | 1 | ... | 8) is exported from your shared index
	numberToEmotionWordsMap,
} from '@shared/config/index.ts'; // Use your project's path alias or adjust path

// Type for the portrait map (number key -> image URL string)
export type PortraitMap = Record<number, string>;

/**
 * Dynamically loads numbered portrait images for a specific character using Vite's glob import.
 * Assumes assets are located at `/src/client/asset/character/{characterId}/{characterId}_{number}.webp`.
 *
 * @param characterId - The identifier for the character (e.g., "monday-original").
 * @returns A promise resolving to a map where keys are image numbers and values are resolved image URLs.
 */
export const loadNumberedPortraits = async (characterId: string): Promise<PortraitMap> => {
	console.log(`[loadNumberedPortraits] Loading for: ${characterId}`);
	const imageMap: PortraitMap = {};

	// 1. Use import.meta.glob with eager loading for direct URL access.
	//    Target the specific folder structure and filename pattern.
	//    The glob pattern MUST be a literal string.
	//    Cast via 'unknown' because TS inference is stricter than Vite's runtime behavior here.
	const imageModules = import.meta.glob<{ default: string }>( // Type hint for the module's default export
		'/src/client/asset/character/*/*.webp', // Matches /{charId}/{anyName}.webp
		{
			eager: true, // Load URLs immediately
			import: 'default', // Import the resolved URL string directly
		}
		// Assert to the expected runtime type: Record<originalPath, resolvedUrlString>
	) as unknown as Record<string, string>;

	// 2. Define the expected path prefix for filtering
	const characterAssetPrefix = `/src/client/asset/character/${characterId}/`;
	const characterFilenamePrefix = `${characterId}_`; // e.g., "monday_original_"

	// 3. Filter and process the modules
	for (const originalPath in imageModules) {
		// Ensure the file is within the correct character's folder
		if (originalPath.startsWith(characterAssetPrefix)) {
			const filenameWithExt = originalPath.substring(characterAssetPrefix.length); // e.g., "monday_original_1.webp"

			// Ensure the filename starts correctly (optional extra check)
			if (!filenameWithExt.startsWith(characterFilenamePrefix)) continue;

			// Extract the number part
			const filenameStem = filenameWithExt.replace(/\.webp$/, ''); // e.g., "monday-original-1"
			const numberStr = filenameStem.substring(characterFilenamePrefix.length); // e.g., "1"

			const imageNumber = parseInt(numberStr, 10);

			// Validate the parsed number
			if (!isNaN(imageNumber)) {
				imageMap[imageNumber] = imageModules[originalPath]; // Store resolved URL
			} else {
				console.warn(`[loadNumberedPortraits] Could not parse image number from path: ${originalPath}`);
			}
		}
	}

	if (Object.keys(imageMap).length === 0) {
		console.warn(
			`[loadNumberedPortraits] No portraits loaded for ${characterId}. Check path/naming: ${characterAssetPrefix}${characterFilenamePrefix}{NUMBER}.webp`
		);
	} else {
		console.log(
			`[loadNumberedPortraits] Loaded ${Object.keys(imageMap).length} portraits for ${characterId}.`
		);
	}

	return imageMap;
};

/**
 * A reverse lookup map generated from numberToEmotionWordsMap.
 * Key: Lowercase emotion keyword.
 * Value: A readonly array of image numbers (EmotionKey) associated with that keyword.
 */
export const emotionToNumberArrayMap: Readonly<Record<string, ReadonlyArray<EmotionKey>>> = (() => {
	const map: Record<string, EmotionKey[]> = {};

	// Iterate through the source map (ensure keys are treated as EmotionKey)
	for (const numStr in numberToEmotionWordsMap) {
		// Ensure the key is a valid number defined in our EmotionKey type
		const num = parseInt(numStr, 10) as EmotionKey;

		// Skip if the key isn't actually one of the defined numeric keys
		// (handles potential non-numeric keys if the source type isn't strict enough)
		if (!(num in numberToEmotionWordsMap)) {
			console.error(
				`[emotionToNumberArrayMap] Invalid key found in numberToEmotionWordsMap: ${numStr}`
			);
			continue;
		}

		const words = numberToEmotionWordsMap[num];
		for (const word of words) {
			const lowerWord = word.toLowerCase();
			if (!map[lowerWord]) {
				map[lowerWord] = [];
			}
			// Avoid duplicates within the same keyword's array
			if (!map[lowerWord].includes(num)) {
				map[lowerWord].push(num);
			}
		}
	}

	// Ensure 'default' keyword maps correctly (Defensive Check)
	const defaultKeyword = 'default';
	const defaultWordsInMap = numberToEmotionWordsMap[DEFAULT_IMAGE_NUMBER];

	// Check if the default number actually lists 'default' as a keyword
	if (defaultWordsInMap?.map((w) => w.toLowerCase()).includes(defaultKeyword)) {
		if (!map[defaultKeyword]) {
			map[defaultKeyword] = []; // Initialize if somehow missed
		}
		// Ensure the default number is present for the 'default' keyword
		if (!map[defaultKeyword].includes(DEFAULT_IMAGE_NUMBER)) {
			map[defaultKeyword].push(DEFAULT_IMAGE_NUMBER);
			console.log(
				`[emotionToNumberArrayMap] Ensured '${defaultKeyword}' includes default image number ${DEFAULT_IMAGE_NUMBER}.`
			);
		}
	} else {
		// If 'default' wasn't listed for the default number, add a fallback mapping
		console.warn(
			`[emotionToNumberArrayMap] The keyword 'default' is not listed for the default image number (${DEFAULT_IMAGE_NUMBER}) in numberToEmotionWordsMap. Adding fallback mapping.`
		);
		if (!map[defaultKeyword]) {
			map[defaultKeyword] = [DEFAULT_IMAGE_NUMBER];
		} else if (!map[defaultKeyword].includes(DEFAULT_IMAGE_NUMBER)) {
			map[defaultKeyword].push(DEFAULT_IMAGE_NUMBER);
		}
	}

	// Make the final map deeply readonly
	const finalMap: Record<string, ReadonlyArray<EmotionKey>> = {};
	for (const key in map) {
		finalMap[key] = Object.freeze(map[key]); // Freeze inner arrays
	}

	// Final verification (optional but recommended)
	if (!finalMap['default']?.includes(DEFAULT_IMAGE_NUMBER)) {
		console.error(
			`[emotionToNumberArrayMap] CRITICAL: Post-generation check failed. The keyword 'default' does not map to the default image number (${DEFAULT_IMAGE_NUMBER}).`
		);
	}

	// console.log('[emotionToNumberArrayMap] Generated Map:', finalMap); // Debugging
	return Object.freeze(finalMap); // Freeze the outer map
})();

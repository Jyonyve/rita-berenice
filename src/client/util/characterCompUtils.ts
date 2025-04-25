// src/utils/characterCompUtils.ts (Example path)

// Import DEFAULT_IMAGE_NUMBER from the shared file now
import { DEFAULT_IMAGE_NUMBER, numberToEmotionWordsMap } from '@shared/index.ts'; // Adjust import path

// --- loadNumberedPortraits function remains the same ---
export const loadNumberedPortraits = async (
	characterId: string
): Promise<Record<number, string>> => {
	// ... (implementation as before) ...
	const imageModules = import.meta.glob('/src/asset/character/*/*.webp');
	const imageMap: Record<number, string> = {};
	const characterPathPrefix = `/src/asset/character/${characterId}/`;
	// ... (loop and processing logic) ...
	for (const path in imageModules) {
		if (path.startsWith(characterPathPrefix)) {
			try {
				const filenameWithExt = path.substring(characterPathPrefix.length);
				const filenameStem = filenameWithExt.replace(/\.webp$/, '');
				const lastHyphenIndex = filenameStem.lastIndexOf('-');
				if (lastHyphenIndex === -1 || lastHyphenIndex === filenameStem.length - 1) continue;
				const numberStr = filenameStem.substring(lastHyphenIndex + 1);
				const imageNumber = parseInt(numberStr, 10);
				if (isNaN(imageNumber)) continue;

				const mod = await imageModules[path]();
				if (mod && typeof mod === 'object' && 'default' in mod && typeof mod.default === 'string') {
					imageMap[imageNumber] = mod.default;
				}
			} catch (error) {
				console.error(`Error processing image module at path ${path}:`, error);
			}
		}
	}
	// ... (logging) ...
	return imageMap;
};

/**
 * A reverse lookup map generated from numberToEmotionWordsMap.
 * Key: Lowercase emotion keyword.
 * Value: An array of image numbers associated with that keyword.
 */
export const emotionToNumberArrayMap: Readonly<Record<string, readonly number[]>> = (() => {
	// Temporary map to build the arrays
	const map: Record<string, number[]> = {};

	for (const [numStr, words] of Object.entries(numberToEmotionWordsMap)) {
		const num = parseInt(numStr, 10);
		if (isNaN(num)) {
			console.error(`Invalid key found in numberToEmotionWordsMap: ${numStr}`);
			continue;
		}

		for (const word of words) {
			const lowerWord = word.toLowerCase();
			if (!map[lowerWord]) {
				map[lowerWord] = [];
			}
			if (!map[lowerWord].includes(num)) {
				map[lowerWord].push(num);
			}
		}
	}

	// --- Safety Check for 'default' keyword ONLY ---
	// Ensure the primary fallback keyword 'default' maps correctly to DEFAULT_IMAGE_NUMBER,
	// assuming 'default' is listed for that number in the source map.
	const defaultKeyword = 'default';
	if (
		numberToEmotionWordsMap[DEFAULT_IMAGE_NUMBER]?.map((w) => w.toLowerCase()).includes(
			defaultKeyword
		)
	) {
		if (!map[defaultKeyword]) {
			map[defaultKeyword] = []; // Initialize if missing
		}
		if (!map[defaultKeyword].includes(DEFAULT_IMAGE_NUMBER)) {
			// Add the default number if it's missing from the 'default' keyword's array
			map[defaultKeyword].push(DEFAULT_IMAGE_NUMBER);
			console.log(
				`Ensured '${defaultKeyword}' includes default image number ${DEFAULT_IMAGE_NUMBER}.`
			);
		}
	}
	// Convert arrays to readonly for the final exported map
	const finalMap: Record<string, readonly number[]> = {};
	for (const key in map) {
		finalMap[key] = Object.freeze(map[key]);
	}

	// console.log('Generated Emotion->Number Array Map:', finalMap); // Debugging
	return Object.freeze(finalMap);
})();

// Verify that the 'default' keyword is mapped correctly
if (!emotionToNumberArrayMap['default']?.includes(DEFAULT_IMAGE_NUMBER)) {
	console.error(
		`CRITICAL: The keyword 'default' does not map to the default image number (${DEFAULT_IMAGE_NUMBER}). Check numberToEmotionWordsMap.`
	);
}

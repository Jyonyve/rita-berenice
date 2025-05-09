import {
	BASE_IMAGE_DIR,
	DEFAULT_EMOTION,
	EmotionKey,
	PortraitMap,
	validEmotionKeyNumbers,
} from '@shared/config/index.ts';

// Helper function to escape string for use in RegExp constructor
function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * Loads portrait images for a given characterId from the asset directory.
 * Images are expected to be named like: {characterId}_{NUMBER}.webp,
 * where {NUMBER} corresponds to an EmotionKey (e.g., 0, 1, 2...).
 */
export const loadNumberedPortraits = async (characterId: string): Promise<PortraitMap> => {
	console.log(`[loadNumberedPortraits] Loading portraits for character: ${characterId}`);
	const imageMap: PortraitMap = {};

	// Vite's import.meta.glob for dynamic bulk import of image URLs
	const imageModules = import.meta.glob<{ default: string }>(
		[`${BASE_IMAGE_DIR}/*/*.webp`, `${BASE_IMAGE_DIR}/*/*.avif`], // Glob pattern for character images
		{
			eager: true, // Load modules immediately (provides URLs directly)
			import: DEFAULT_EMOTION, // Import the default export, which is the resolved URL string
		}
	) as unknown as Record<string, string>; // Cast to expected runtime type

	const characterAssetPathPrefix = `${BASE_IMAGE_DIR}/${characterId}/`;
	const characterFilenamePrefix = `${characterId}_`; // e.g., "monday_original_"
	// Regex to match filenames like: {characterFilenamePrefix}{NUMBER}.webp and capture NUMBER
	const filenameRegex = new RegExp(`^${escapeRegExp(characterFilenamePrefix)}(\\d+)\\.webp$`);

	for (const originalPath in imageModules) {
		// Ensure the file is within the correct character's asset folder
		if (originalPath.startsWith(characterAssetPathPrefix)) {
			const filenameWithExt = originalPath.substring(characterAssetPathPrefix.length);
			const match = filenameWithExt.match(filenameRegex);

			if (match && match[1]) {
				// If regex matches and captures the number part
				const imageNumber = parseInt(match[1], 10);

				// Validate if the parsed number is a defined EmotionKey
				if (validEmotionKeyNumbers.has(imageNumber as EmotionKey)) {
					imageMap[imageNumber as EmotionKey] = imageModules[originalPath];
				} else {
					console.warn(
						`[loadNumberedPortraits] Parsed image number ${imageNumber} from path "${originalPath}" ` +
							`is not a valid EmotionKey (not defined in numberToEmotionWordsMap). Skipping.`
					);
				}
			} else {
				// Optional: Log if a file in the character's folder doesn't match the expected naming pattern.
				// This avoids warnings for common non-portrait files like 'thumbnail.webp' if they might exist.
				if (!filenameWithExt.includes('thumbnail') && !filenameWithExt.startsWith('.')) {
					// Avoid .DS_Store etc.
					console.warn(
						`[loadNumberedPortraits] File "${originalPath}" in character folder for ${characterId} ` +
							`does not match expected portrait naming pattern (${characterFilenamePrefix}{NUMBER}.webp).`
					);
				}
			}
		}
	}

	if (Object.keys(imageMap).length === 0) {
		console.warn(
			`[loadNumberedPortraits] No valid portraits loaded for ${characterId}. ` +
				`Please check filenames in ${characterAssetPathPrefix} match the pattern: ${characterFilenamePrefix}{NUMBER}.webp, ` +
				`where {NUMBER} is a key in numberToEmotionWordsMap (e.g., 0, 1, ...).`
		);
	} else {
		console.log(
			`[loadNumberedPortraits] Loaded ${Object.keys(imageMap).length} portraits for ${characterId}. Keys: ${Object.keys(imageMap).join(', ')}`
		);
	}

	return imageMap;
};

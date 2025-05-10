import { EmotionKey, PortraitMap, validEmotionKeyNumbers } from '@shared/config/index.ts';

// Helper function to escape string for use in RegExp constructor
function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}
/**
 * Loads portrait images for a given characterId from the asset directory.
 * Images are expected to be named like: {characterId}_{NUMBER}.webp or .avif,
 * where {NUMBER} corresponds to an EmotionKey (e.g., 0, 1, 2...).
 */
export const loadNumberedPortraits = async (characterId: string): Promise<PortraitMap> => {
	console.log(`[loadNumberedPortraits] Loading portraits for character: ${characterId}`);
	const imageMap: PortraitMap = {};

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
	const filenameRegex = new RegExp(`^${escapeRegExp(characterFilenamePrefix)}(\\d+)\\.(webp|avif)$`);

	for (const originalPath in imageModules) {
		if (originalPath.startsWith(characterAssetPathPrefix)) {
			const filenameWithExt = originalPath.substring(characterAssetPathPrefix.length);
			const match = filenameWithExt.match(filenameRegex);

			if (match && match[1]) {
				const imageNumber = parseInt(match[1], 10);

				if (validEmotionKeyNumbers.has(imageNumber as EmotionKey)) {
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
			`[loadNumberedPortraits] Loaded ${Object.keys(imageMap).length} portraits for ${characterId}. Keys: ${Object.keys(imageMap).join(', ')}`
		);
	}

	return imageMap;
};

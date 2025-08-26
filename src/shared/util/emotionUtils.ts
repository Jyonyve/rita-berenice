import {
	numberToEmotionWordsMap,
	EmotionKey,
	EmotionValue,
	DEFAULT_EMOTION,
} from '#shared/config/emotionWordsMapper.js';

// Create reverse mapping: specific emotion -> emotion category number
const emotionToCategoryMap = new Map<string, EmotionKey>();

// Build the reverse mapping from your existing numberToEmotionWordsMap
Object.entries(numberToEmotionWordsMap).forEach(([categoryNumber, emotions]) => {
	const categoryKey = parseInt(categoryNumber) as EmotionKey;
	emotions.forEach((emotion) => {
		emotionToCategoryMap.set(emotion.toLowerCase(), categoryKey);
	});
});

// Category names mapping for human-readable output
export const EMOTION_CATEGORY_NAMES: Record<EmotionKey, string> = {
	0: 'neutral',
	1: 'happy',
	2: 'angry',
	3: 'sad',
	4: 'fear',
	5: 'curious',
	6: 'affectionate',
	7: 'excited',
	8: 'disgusted',
	9: 'confident',
	10: 'ashamed',
	11: 'amazed',
	12: 'bored',
	13: 'romantic',
	14: 'conflicted', // Added category 14
} as const;

/**
 * Maps specific emotion keywords to their broader category names
 * @param emotion - The specific emotion keyword (e.g., "melancholy", "ecstatic")
 * @returns The broader emotion category name (e.g., "sad", "happy")
 */
export const mapEmotionToCategory = (emotion: string): string => {
	if (!emotion) return DEFAULT_EMOTION;

	const normalized = emotion.toLowerCase().trim();
	const categoryNumber = emotionToCategoryMap.get(normalized);

	if (categoryNumber !== undefined) {
		return EMOTION_CATEGORY_NAMES[categoryNumber];
	}

	// Fallback for unknown emotions - return 'neutral'
	console.warn(`[EmotionMapping] Unknown emotion: "${emotion}", defaulting to neutral`);
	return DEFAULT_EMOTION;
};

/**
 * Maps specific emotion keywords to their category numbers
 * @param emotion - The specific emotion keyword
 * @returns The emotion category number (0-14) - Updated range
 */
export const mapEmotionToCategoryNumber = (emotion: string): EmotionKey => {
	if (!emotion) return 0;

	const normalized = emotion.toLowerCase().trim();
	const categoryNumber = emotionToCategoryMap.get(normalized);

	return categoryNumber !== undefined ? categoryNumber : 0;
};

/**
 * Gets all emotions in a specific category
 * @param categoryNumber - The emotion category number (0-14) - Updated range
 * @returns Array of emotion keywords in that category
 */
export const getEmotionsInCategory = (categoryNumber: EmotionKey): readonly string[] => {
	return numberToEmotionWordsMap[categoryNumber] || [];
};

/**
 * Checks if an emotion is valid (exists in the mapping)
 * @param emotion - The emotion keyword to validate
 * @returns True if the emotion exists in the mapping
 */
export const isValidEmotion = (emotion: string): boolean => {
	if (!emotion) return false;
	const normalized = emotion.toLowerCase().trim();
	return emotionToCategoryMap.has(normalized);
};

/**
 * Gets similar emotions in the same category
 * @param emotion - The base emotion
 * @param excludeSelf - Whether to exclude the original emotion from results
 * @returns Array of similar emotions in the same category
 */
export const getSimilarEmotions = (
	emotion: string,
	excludeSelf: boolean = true
): readonly string[] => {
	const categoryNumber = mapEmotionToCategoryNumber(emotion);
	const allInCategory = getEmotionsInCategory(categoryNumber);

	if (excludeSelf) {
		const normalized = emotion.toLowerCase().trim();
		return allInCategory.filter((e) => e !== normalized);
	}

	return allInCategory;
};

/**
 * Enhanced emotion compatibility matrix for Rita-Berenice character system
 * Maps how emotionally similar different categories are (0.0 - 1.0)
 */
export const EMOTION_COMPATIBILITY_MATRIX: Record<
	EmotionKey,
	Partial<Record<EmotionKey, number>>
> = {
	// Neutral (0) - low compatibility with intense emotions
	0: { 5: 0.6, 6: 0.4, 12: 0.7, 14: 0.5 },

	// Happy (1) - compatible with positive emotions
	1: { 6: 0.7, 7: 0.8, 9: 0.6, 11: 0.5, 13: 0.6 },

	// Angry (2) - compatible with other negative intense emotions
	2: { 3: 0.4, 4: 0.5, 8: 0.6, 10: 0.3 },

	// Sad (3) - compatible with other vulnerable emotions
	3: { 2: 0.4, 4: 0.6, 10: 0.7, 12: 0.5, 14: 0.6 },

	// Fear (4) - compatible with anxiety-related emotions
	4: { 2: 0.5, 3: 0.6, 5: 0.4, 10: 0.6 },

	// Curious (5) - compatible with engaged states
	5: { 0: 0.6, 1: 0.4, 7: 0.5, 11: 0.7 },

	// Affectionate (6) - compatible with warm emotions
	6: { 1: 0.7, 7: 0.5, 9: 0.4, 13: 0.9 },

	// Excited (7) - compatible with high-energy emotions
	7: { 1: 0.8, 6: 0.5, 9: 0.6, 13: 0.7 },

	// Disgusted (8) - compatible with rejection emotions
	8: { 2: 0.6, 12: 0.4 },

	// Confident (9) - compatible with positive assertive emotions
	9: { 1: 0.6, 7: 0.6, 11: 0.5 },

	// Ashamed (10) - compatible with vulnerable emotions
	10: { 2: 0.3, 3: 0.7, 4: 0.6 },

	// Amazed (11) - compatible with positive discovery
	11: { 1: 0.5, 5: 0.7, 9: 0.5 },

	// Bored (12) - compatible with low-energy states
	12: { 0: 0.7, 3: 0.5, 8: 0.4 },

	// Romantic (13) - compatible with warm, intimate emotions
	13: { 1: 0.6, 6: 0.9, 7: 0.7 },

	// Conflicted (14) - compatible with complex states
	14: { 0: 0.5, 3: 0.6, 5: 0.4, 10: 0.5 },
};

/**
 * Calculates emotional compatibility between two emotions
 * @param emotion1 - First emotion keyword
 * @param emotion2 - Second emotion keyword
 * @returns Compatibility score (0.0 - 1.0)
 */
export const calculateEmotionCompatibility = (emotion1: string, emotion2: string): number => {
	if (!emotion1 || !emotion2) return 0;

	// Exact match
	if (emotion1.toLowerCase() === emotion2.toLowerCase()) return 1.0;

	const category1 = mapEmotionToCategoryNumber(emotion1);
	const category2 = mapEmotionToCategoryNumber(emotion2);

	// Same category
	if (category1 === category2) return 0.8;

	// Check compatibility matrix
	const compatibility =
		EMOTION_COMPATIBILITY_MATRIX[category1]?.[category2] ||
		EMOTION_COMPATIBILITY_MATRIX[category2]?.[category1] ||
		0;

	return compatibility;
};

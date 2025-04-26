// src/shared/emotionWordsMapper.ts (Example path)

/**
 * Defines the mapping from image number index to associated emotion keywords.
 * Key: Image number (as referenced in filenames like ..._N.webp)
 * Value: Array of lowercase emotion keywords associated with that image.
 * IMPORTANT: Ensure keyword 'default' and/or 'neutral' maps to DEFAULT_IMAGE_NUMBER.
 */
export const numberToEmotionWordsMap: Readonly<Record<number, readonly string[]>> = {
	0: [
		// Defaults & Neutral
		'default',
		'neutral',
		'normal',
		'standard',
		'calm',
		'content',
		'contentment',
		'relaxed',
		'at ease',
		'peaceful',
		'satisfied', // Generally calm/neutral states
	],
	1: [
		// POSITIVE EMOTIONS
		'happy',
		'glad',
		'pleased',
		'joyful',
		'cheerful',
		'smiling',
		'grinning',
		'laughing',
		'amused',
		'delighted',
		'upbeat',
		'positive',
	],
	2: [
		// Anger & Related Negative
		'angry',
		'mad',
		'furious',
		'irate',
		'annoyed',
		'irritated',
		'frustrated',
		'rage',
		'outraged',
		'resentful',
		'bitter',
		'shouting',
		'yelling',
	],
	3: [
		// Sadness & Related Negative
		'sad',
		'unhappy',
		'sorrowful',
		'depressed',
		'gloomy',
		'glum',
		'melancholy',
		'despair',
		'hopeless',
		'crying',
		'tearful',
		'grief',
		'heartbroken',
		'worried',
		'anxious',
		'nervous',
		'concerned',
	],
	4: [
		// Fear & Surprise
		'fear',
		'scared',
		'afraid',
		'terrified',
		'panicked',
		'horror',
		'surprised',
		'startled',
		'astonished',
		'shocked',
		'amazed',
	],
	5: [
		// Thinking & Confusion
		'thinking',
		'pondering',
		'considering',
		'curious',
		'questioning',
		'confused',
		'puzzled',
		'uncertain',
		'doubtful',
		'skeptical',
	],
	6: [
		// Affection & Shyness
		'love',
		'affectionate',
		'caring',
		'fond',
		'loving',
		'shy',
		'bashful',
		'embarrassed',
		'blushing',
		'flustered',
	],
	7: [
		// Excitement & Eagerness
		'excited',
		'eager',
		'enthusiastic',
		'thrilled',
		'elated',
		'energetic',
	],
	8: [
		// Disgust & Contempt
		'disgusted',
		'repulsed',
		'sickened',
		'contempt',
		'scornful',
		'disdainful',
	],
	// Add more numbers and associated keyword arrays as needed
} as const; // Using 'as const' provides stronger typing

/**
 * A flattened, unique list of all defined emotion keywords in lowercase.
 * Useful for validation or providing hints to the LLM.
 */
export const allEmotionKeywords: readonly string[] = Array.from(
	new Set(
		Object.values(numberToEmotionWordsMap)
			.flat()
			.map((word) => word.toLowerCase())
	)
);

// Default portrait number
export const DEFAULT_IMAGE_NUMBER = 0;
export type EmotionKey = keyof typeof numberToEmotionWordsMap;

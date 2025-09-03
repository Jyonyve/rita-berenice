// Create a new file: src/shared/util/translateUtils.ts

import {
	alertToastConstants,
	DEFAULT_LANG,
	LANG_KEYS,
	LangCode,
	langConstants,
	LangKey,
} from '#shared/config/langConstants.js';
import { EmotionValue } from '#shared/config/emotionConstants.js';
import { EMOTION_CATEGORY_NAMES } from '#shared/util/emotionUtils.js';
import { GENDER_OPTIONS } from '#shared/config/constants.js';

/**
 * Retrieves the appropriate text for a given key based on the selected language.
 * Defaults to the DEFAULT_LANG if the specified language or text is not found.
 *
 * @param key The key of the text to retrieve from langConstants.
 * @param lang The desired language. Defaults to DEFAULT_LANG.
 * @returns The localized string.
 */
export const getLangText = (key: LangKey, lang: LangCode = DEFAULT_LANG): string => {
	const record = langConstants[key];

	if (!record) {
		console.warn(`Language constant not found for key: ${key}`);
		return key; // Return the key as a fallback for missing entries
	}

	return record[lang] || record[DEFAULT_LANG];
};

/**
 * Retrieves the appropriate text for a given key based on the selected language.
 * Defaults to the DEFAULT_LANG if the specified language or text is not found.
 *
 * @param key The key of the text to retrieve from langConstants.
 * @param lang The desired language. Defaults to DEFAULT_LANG.
 * @returns The localized string.
 */
export const getLangAlertText = (key: LangKey, lang: LangCode = DEFAULT_LANG): string => {
	const record = alertToastConstants[key];

	if (!record) {
		console.warn(`Language constant not found for key: ${key}`);
		return key; // Return the key as a fallback for missing entries
	}

	return record[lang] || record[DEFAULT_LANG];
};

export const emotionToLangKey = (emotion: EmotionValue): LangKey =>
	emotion.toUpperCase() as LangKey;

export const EMOTION_SELECT_MENUITEM = Object.entries(EMOTION_CATEGORY_NAMES).map(
	([key, value]) => ({
		key: value,
		label: getLangText(emotionToLangKey(value)),
		emotionKey: parseInt(key),
	})
);

export const GENDER_SELECT_MENUITEM = GENDER_OPTIONS.map((option) => ({
	key: option,
	label: getLangText(LANG_KEYS[option.toUpperCase() as keyof typeof LANG_KEYS]),
}));

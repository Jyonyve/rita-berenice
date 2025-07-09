// Create a new file: src/server/util/languageUtils.ts

import {
	alertConstants,
	DEFAULT_LANG,
	LangCode,
	langConstants,
	LangKey,
} from '#shared/config/langConstants.js';
import { franc } from 'franc';

/**
 * Detects the language of a given text string using the 'franc' library.
 * It's optimized for your use case, defaulting to Korean for short or ambiguous text.
 *
 * @param text The input string from the user.
 * @returns 'kor' for Korean, or 'eng' for English. Defaults to 'kor'.
 */
export const detectLanguage = (text: string): LangCode => {
	// For very short inputs (e.g., "ok", "no"), franc can be unreliable.
	// Defaulting to Korean is a safe bet for your primary user base.
	if (!text || text.trim().length < 5) {
		// Increased threshold slightly for robustness
		return 'kor';
	}

	// franc returns a 3-letter ISO 639-3 code, which is exactly what we need.
	const langCode = franc(text, { minLength: 3 });

	switch (langCode) {
		case 'kor':
			return 'kor';
		case 'eng':
			return 'eng';
		default:
			// If the language is something else or undetectable ('und'), default to Korean.
			return 'kor';
	}
};
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
	const record = alertConstants[key];

	if (!record) {
		console.warn(`Language constant not found for key: ${key}`);
		return key; // Return the key as a fallback for missing entries
	}

	return record[lang] || record[DEFAULT_LANG];
};

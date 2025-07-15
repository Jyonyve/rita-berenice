// Create a new file: src/shared/util/translateUtils.ts

import {
	alertConstants,
	DEFAULT_LANG,
	LangCode,
	langConstants,
	LangKey,
} from '#shared/config/langConstants.js';

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
export const notFoundMessage = (noWhat: string) => `No ${noWhat} found.`;

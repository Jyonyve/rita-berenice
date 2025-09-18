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
import { GENDER_OPTION, GENDER_OPTIONS } from '#shared/config/constants.js';

// 🎯 Global current language state
let currentLang: LangCode = (() => {
	if (typeof window !== 'undefined' && (window as any).__INITIAL_LANG__) {
		return (window as any).__INITIAL_LANG__;
	}
	return DEFAULT_LANG;
})();

// 🎯 Function for LanguageProvider to update global state
export const setCurrentLang = (lang: LangCode): void => {
	currentLang = lang;
};

// 🎯 Function to get current language
export const getCurrentLang = (): LangCode => {
	return currentLang;
};

/**
 * Retrieves the appropriate text for a given key based on the selected language.
 * Defaults to the DEFAULT_LANG if the specified language or text is not found.
 *
 * @param key The key of the text to retrieve from langConstants.
 * @param lang The desired language. Defaults to DEFAULT_LANG.
 * @returns The localized string.
 */
export const getLangText = (key: LangKey, lang?: LangCode): string => {
	const useLang = lang || currentLang;
	const record = langConstants[key];

	if (!record) {
		console.warn(`Language constant not found for key: ${key}`);
		return key; // Return the key as a fallback for missing entries
	}

	return record[useLang] || record[DEFAULT_LANG];
};

/**
 * Retrieves the appropriate text for a given key based on the selected language.
 * Defaults to the DEFAULT_LANG if the specified language or text is not found.
 *
 * @param key The key of the text to retrieve from langConstants.
 * @param lang The desired language. Defaults to DEFAULT_LANG.
 * @returns The localized string.
 */
export const getLangAlertText = (key: LangKey, lang?: LangCode): string => {
	const useLang = lang || currentLang;
	const record = alertToastConstants[key];

	if (!record) {
		return key; // Return the key as a fallback for missing entries
	}

	return record[useLang] || record[DEFAULT_LANG];
};

export const emotionToLangKey = (emotion: EmotionValue): LangKey =>
	emotion.toUpperCase() as LangKey;

export const genderToLangKey = (gender: GENDER_OPTION): LangKey => gender.toUpperCase() as LangKey;

export const getEmotionSelectLabel = () => {
	return Object.entries(EMOTION_CATEGORY_NAMES).map(([key, value]) => ({
		key: value,
		label: getLangText(emotionToLangKey(value)),
		emotionKey: parseInt(key),
	}));
};

export const getGenderSelectLabel = () => {
	return GENDER_OPTIONS.map((option) => ({
		key: option,
		label: getLangText(genderToLangKey(option)),
	}));
};

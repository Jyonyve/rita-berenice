// Create a new file: src/shared/util/languageUtils.ts

import { LangCode } from '@rita-berenice/shared/config/langConstants.js';
import { franc } from 'franc';
import { Term } from '@rita-berenice/shared/api/ModuleResponse.js';

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

export const mapTerms = (terms: Term[]) => {
	const termMap: Map<string, string> = new Map();
	terms.forEach((term) => termMap.set(term.koreanTerm, term.englishTerm));
	return termMap;
};

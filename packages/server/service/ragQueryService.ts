// src/server/services/ragQueryService.ts

import { z } from 'zod';
import { llmService } from './llmService.js';
import { termStore } from '../store/termStore.js';
import { AiModelInfo, DEFAULT_EXTRACTION_MODEL } from '@rita-berenice/shared/domain/aimodel/AiInfoTypes.js';
import { buildChatCompletion } from '../util/llmUtils.js';
import { FilterCriteria, FilterCriteriaSchema } from '../util/schemaUtils.js';
import { logFlow } from '../util/jsonlLogger.js';
import { buildFilterCriteriaPrompt } from '../util/templateUtils.js';

// The service output interface, returning query texts and structured filter criteria.
export interface TransformedQuery {
	queryTexts: string[];
	filterCriteria?: FilterCriteria;
	criticalTerm?: string;
}

export const ragQueryService = {
	/**
	 * Transforms a raw user query into an all-English set of search terms and structured
	 * filter criteria for the RAG system.
	 */
	async transformQuery(
		userInput: string,
		sessionId: string,
		userId: string,
		userName: string,
		charName: string
	): Promise<TransformedQuery> {
		console.log('[ragQueryService] Transforming query with translation-first approach...');

		try {
			const termRes = await termStore.getTermsBySessionId(sessionId);
			const termGuidanceMap = new Map<string, string>();
			termRes.terms.forEach((t) => termGuidanceMap.set(t.koreanTerm, t.englishTerm));

			const [translatedUserInput, extractedData] = await Promise.allSettled([
				ragQueryService._translateToEnglish(userInput, termGuidanceMap, userId),
				ragQueryService._extractAndTranslateData(
					userInput, // Raw Korean for better term mapping
					termGuidanceMap,
					DEFAULT_EXTRACTION_MODEL,
					userId,
					userName,
					charName
				),
			]);

			// Handle translation result
			const finalTranslation =
				translatedUserInput.status === 'fulfilled' ? translatedUserInput.value : userInput; // Fallback to original

			// Handle extraction result
			const finalExtraction =
				extractedData.status === 'fulfilled' ? extractedData.value : ({} as FilterCriteria); // Fallback to empty

			const expandedQueries = ragQueryService._expandQuery(finalExtraction);
			const result = {
				queryTexts: [finalTranslation, ...expandedQueries],
				filterCriteria: finalExtraction,
				criticalTerm: finalExtraction.criticalTerm,
			};

			logFlow('ragQueryService', 'transformQuery', { result });
			return result;
		} catch (error) {
			console.error(error, 'Query transformation failed. Falling back to raw query.');
			return { queryTexts: [userInput] };
		}
	},

	/**
	 * @private
	 * Uses an LLM guided by termStore to extract and translate query information.
	 */
	async _extractAndTranslateData(
		userInput: string,
		termGuidanceMap: Map<string, string>,
		modelInfo: AiModelInfo,
		userId: string,
		userName: string,
		charName: string
	): Promise<FilterCriteria> {
		const prompt = buildFilterCriteriaPrompt(userInput, termGuidanceMap, userName, charName);
		const messages = [buildChatCompletion('user', prompt)];

		const jsonString = await llmService.invokeLlm(
			messages,
			modelInfo,
			userId,
			undefined,
			FilterCriteriaSchema
		);

		// --- RE-INSTATED AND CORRECTED ---
		// Since invokeLlm returns a JSON string, we must parse it to get the object.
		return JSON.parse(jsonString) as FilterCriteria;
	},

	/**
	 * @private
	 * Generates expanded English queries from the extracted data. No LLM call is needed.
	 */
	_expandQuery(data: FilterCriteria): string[] {
		const expanded = new Set<string>();
		(data.topics || []).forEach((topic) => expanded.add(topic));
		(data.keywords || []).forEach((keyword) => expanded.add(keyword));
		(data.entities?.characters || []).forEach((c) => expanded.add(c));
		if (data.criticalTerm) {
			expanded.add(data.criticalTerm);
		}
		return Array.from(expanded);
	},

	// **NEW: Add translation method**
	async _translateToEnglish(
		koreanText: string,
		termGuidanceMap: Map<string, string>,
		userId: string
	): Promise<string> {
		// First, apply known term mappings
		let processedText = koreanText;
		termGuidanceMap.forEach((english, korean) => {
			const regex = new RegExp(korean, 'g');
			processedText = processedText.replace(regex, english);
		});

		// Use LLM for comprehensive translation
		const translationPrompt = `Translate the following Korean text to English, focusing on preserving semantic meaning and emotional nuance. Pay special attention to relationship terms, emotions, and cultural concepts:

Korean text: ${koreanText}

Provide only the English translation:`;

		const messages = [buildChatCompletion('user', translationPrompt)];

		try {
			const translatedText = await llmService.invokeLlm(messages, DEFAULT_EXTRACTION_MODEL, userId);

			// **FIXED: Return plain text, not JSON.parse**
			return translatedText.trim() || processedText;
		} catch (error) {
			console.warn('Translation failed, using term mapping only:', error);
			return processedText;
		}
	},
};

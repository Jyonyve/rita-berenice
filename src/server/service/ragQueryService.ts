// src/server/services/ragQueryService.ts

import { z } from 'zod';
import { llmService } from './llmService.js';
import { termStore } from '../store/termStore.js';
import { AiModelInfo, DEFAULT_EXTRACTION_MODEL } from '#shared/domain/aimodel/AiInfoTypes.js';
import { buildChatCompletion } from '../util/llmUtils.js';
import { FilterCriteria, FilterCriteriaSchema } from '../util/schemaUtils.js';
import { logFlow } from '../util/jsonlLogger.js';

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
		langCode: 'kor' | 'eng' = 'kor'
	): Promise<TransformedQuery> {
		console.log('[ragQueryService] Transforming query with schema-aware extraction...');
		if (langCode === 'eng') {
			return { queryTexts: [userInput] };
		}

		try {
			const termRes = await termStore.getTermsBySessionId(sessionId);
			const termGuidanceMap = new Map<string, string>();
			termRes.terms.forEach((t) => termGuidanceMap.set(t.koreanTerm, t.englishTerm));

			const extractedData = await ragQueryService._extractAndTranslateData(
				userInput,
				termGuidanceMap,
				DEFAULT_EXTRACTION_MODEL,
				userId
			);
			logFlow('ragQueryService', 'extractedData', extractedData);

			const expandedQueries = ragQueryService._expandQuery(extractedData);
			logFlow('ragQueryService', 'expandedQueries', expandedQueries);

			return {
				queryTexts: [userInput, ...expandedQueries],
				filterCriteria: extractedData,
				criticalTerm: extractedData.criticalTerm,
			};
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
		userId: string
	): Promise<FilterCriteria> {
		let termGuidanceInstruction = '';
		if (termGuidanceMap.size > 0) {
			const rulesList = Array.from(termGuidanceMap.entries())
				.map(
					([korean, english]) =>
						`  - For the Korean term "${korean}", you MUST use the English term: "${english}"`
				)
				.join('\n');

			termGuidanceInstruction = `
**Terminology Guidance (CRITICAL):**
You MUST adhere to the following terminology rules when generating English metadata.
${rulesList}
`;
		}

		const prompt = `You are an expert data analyst. Analyze the following Korean user query and extract key information into a structured JSON object. ALL string values in the JSON output MUST be in English.
${termGuidanceInstruction}
**User Query:** "${userInput}"`;

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
};

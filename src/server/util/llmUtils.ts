import OpenAI from 'openai';
import { ChatCompletion } from 'openai/resources/index.mjs';
import { LlmResponseParseError } from './serviceHelpers.js';
import { ChromaResponse } from '#shared/api/ModuleResponse.js';

export function isDirectOpenAIClient(llm: any): llm is OpenAI {
	// Check for a unique property or method of the OpenAI client instance
	// that Langchain BaseChatModel instances won't have.
	// '.chat.completions.create' is a reasonably safe indicator.
	return llm && typeof llm === 'object' && llm.chat?.completions?.create;
}

export const extractValidOpenAiContent = (response: ChatCompletion): string => {
	if (!response?.choices?.length) return '';
	const validChoice = response.choices.find((choice) => choice?.message?.content != null);
	return validChoice?.message?.content || '';
};

/**
 * Safely extracts a JSON object from a raw LLM string response, which might be
 * wrapped in markdown code blocks (e.g., ``````).
 *
 * This function is generic and can be typed by the caller to ensure the parsed
 * object matches an expected interface.
 *
 * @param llmResponse The raw string response from the LLM.
 * @param callerContext A string to identify the calling function for better error logging.
 * @returns A parsed object of type T, or null if parsing fails.
 */

/**
 * Safely extracts a JSON object from a raw LLM string response.
 * Throws a specific, catchable error if the response is empty, malformed,
 * or cannot be parsed.
 *
 * @param llmResponse The raw string response from the LLM.
 * @param callerContext A string to identify the calling function for better error logging.
 * @returns A parsed object of type T.
 * @throws {LlmResponseParseError} If parsing fails at any stage.
 */

export const parseLlmJsonResponse = <T>(
	llmResponse: string,
	callerContext: string = 'LLM Parser'
): T => {
	if (!llmResponse) {
		throw new LlmResponseParseError('NOT_FOUND', callerContext, 'Empty or null response.');
	}

	const JSON_REGEX = /``````/;
	let extractedJson = '';

	const match = llmResponse.match(JSON_REGEX);
	if (match && match[1]) {
		extractedJson = match[1];
	} else if (llmResponse.trim().startsWith('{')) {
		extractedJson = llmResponse;
	} else {
		throw new LlmResponseParseError('NOT_FOUND', callerContext, llmResponse);
	}

	try {
		return JSON.parse(extractedJson) as T;
	} catch (error: any) {
		// Pass the specific JSON.parse error message for the corrective prompt
		console.log(`[parseLlmJsonResponse] : ${llmResponse}`);
		throw new LlmResponseParseError('MALFORMED_SYNTAX', callerContext, llmResponse);
	}
};

/**
 * Re-ranks ChromaDB results based on a combination of semantic distance and recency.
 * @param response The raw response from a ChromaDB query.
 * @param decayRate A factor controlling how quickly older items lose relevance (e.g., 0.1).
 * @returns The same ChromaResponse object, but with its contents sorted by the new combined score.
 */
export function reRankByRecency<T extends { updatedAt: string }>(
	response: ChromaResponse & { contents?: T[] }, // Assuming a generic response with a content array
	decayRate: number = 0.05
): ChromaResponse & { contents?: T[] } {
	if (!response.documents || !response.distances || !response.contents) {
		return response; // Not enough data to rank
	}

	const now = Date.now();
	const rankedItems = (response.distances[0] || [])
		.map((distance, index) => {
			const item = response.contents![index];
			const ageInDays = (now - Date.parse(item.updatedAt)) / (1000 * 60 * 60 * 24);

			// 1. Normalize semantic distance (lower is better) to a score (higher is better)
			const semanticScore = 1 / (1 + distance);

			// 2. Calculate recency score using exponential decay
			const recencyScore = Math.exp(-decayRate * ageInDays);

			// 3. Combine the scores. Adjust weighting as needed.
			const combinedScore = semanticScore * 0.7 + recencyScore * 0.3;

			return {
				id: response.ids[index],
				document: response.documents![index],
				metadata: response.metadatas![index],
				content: item,
				combinedScore,
			};
		})
		.sort((a, b) => b.combinedScore - a.combinedScore); // Sort descending by combined score

	// Reconstruct the ChromaResponse object with the sorted data
	return {
		ids: rankedItems.map((item) => item.id),
		documents: rankedItems.map((item) => item.document),
		metadatas: rankedItems.map((item) => item.metadata),
		contents: rankedItems.map((item) => item.content),
		// Note: distances are no longer meaningful after re-ranking
	};
}

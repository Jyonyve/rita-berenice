import OpenAI from 'openai';
import { ChatCompletion } from 'openai/resources/index.mjs';
import { LlmResponseParseError } from '../index.ts';

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
		throw new LlmResponseParseError('MALFORMED_SYNTAX', callerContext, llmResponse);
	}
};

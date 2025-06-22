// src/client/hooks/useAiApi.ts

import { useState, useCallback } from 'react';
import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	ApiError,
	AiModelInfo,
	ChatRoleType,
} from '#shared/index.ts';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs'; // This type is needed client-side
import { useToast } from '../../component/index.ts';

/**
 * A client-side hook for interacting with the AI (LLM) API endpoints.
 * It encapsulates API logic, loading/error states, and user notifications via a toast system.
 */
export const useAiApi = () => {
	const MODULE_NAME = MODULE_NAMES.LLM; // Assuming LLM is the module name for AI routes

	// --- Hooks ---
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<ApiError | null>(null);
	const { addToast } = useToast();

	/**
	 * Invokes a language model with a single prompt and returns the raw string response.
	 * @returns The assistant's response string, or null on failure.
	 */
	const invokeLlm = useCallback(
		async (role: ChatRoleType, prompt: string, aiModelInfo: AiModelInfo): Promise<string | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'invokeLlm');
				// Expecting { response: string } from the API
				const response = await apiClient.post<{ response: string }>(url, { role, prompt, aiModelInfo });
				return response.data.response;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to get LLM response.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Invokes a language model with a sequence of messages and returns the raw string response.
	 * @returns The assistant's response string, or null on failure.
	 */
	const invokeLlmFromMessages = useCallback(
		async (
			messages: ChatCompletionMessageParam[],
			aiModelInfo: AiModelInfo
		): Promise<string | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'invokeLlmFromMessages');
				// Expecting { response: string } from the API
				const response = await apiClient.post<{ response: string }>(url, { messages, aiModelInfo });
				return response.data.response;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to get chat completion.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Translates a single Korean term to English using a language model.
	 * @returns The translated English term, or null on failure.
	 */
	const translateProperNoun = useCallback(
		async (koreanTerm: string): Promise<string | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAMES.LLM, 'translateProperNoun');
				// Expecting { translation: string } from the API
				const response = await apiClient.post<{ translation: string }>(url, { koreanTerm });
				return response.data.translation;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Translation failed.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Extracts an array of proper nouns from a given block of text.
	 * @returns An array of extracted nouns, or an empty array on failure.
	 */
	const extractProperNouns = useCallback(
		async (textToAnalyze: string): Promise<string[]> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAMES.LLM, 'extractProperNouns');
				// Expecting { nouns: string[] } from the API
				const response = await apiClient.post<{ nouns: string[] }>(url, { textToAnalyze });
				return response.data.nouns;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Noun extraction failed.', 'error');
				setError(apiError);
				return [];
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	return {
		loading,
		error,
		invokeLlm,
		invokeLlmFromMessages,
		translateProperNoun,
		extractProperNouns,
	};
};

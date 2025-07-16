// src/client/hooks/useAiApi.ts
import { useMutation } from '@tanstack/react-query';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs'; // This type is needed client-side

import { apiClient } from '../../util/clientApiHelpers.ts';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { ChatRoleType } from '#shared/domain/chat/ChatInterfaces.js';
import { AiModelInfo } from '#shared/domain/aimodel/AiInfoTypes.js';
import { genApiUrl } from '#shared/util/apiHelpers.js';

/**
 * A client-side hook for interacting with the AI (LLM) API endpoints.
 * It encapsulates API logic, loading/error states, and user notifications via a toast system.
 */
export const useLlmApi = () => {
	const MODULE_NAME = MODULE_NAMES.LLM; // Assuming LLM is the module name for AI routes

	const invokeLlm = useMutation<
		string, // Return type on success
		Error, // Error type
		{ role: ChatRoleType; prompt: string; aiModelInfo: AiModelInfo } // Variables type
	>({
		mutationFn: async ({ role, prompt, aiModelInfo }) => {
			const url = genApiUrl(MODULE_NAME, 'invokeLlm');
			const response = await apiClient.post<{ response: string }>(url, { role, prompt, aiModelInfo });
			return response.data.response;
		},
	});
	/**
	 * Invokes a language model with a sequence of messages and returns the raw string response.
	 * @returns The assistant's response string, or null on failure.
	 */
	const invokeLlmFromMessages = useMutation<
		string, // Return type on success
		Error, // Error type
		{ messages: ChatCompletionMessageParam[]; aiModelInfo: AiModelInfo } // Variables type
	>({
		mutationFn: async ({ messages, aiModelInfo }) => {
			const url = genApiUrl(MODULE_NAME, 'invokeLlmFromMessages');
			const response = await apiClient.post<{ response: string }>(url, { messages, aiModelInfo });
			return response.data.response;
		},
	});

	/**
	 * Translates a single Korean term to English using a language model.
	 * @returns The translated English term, or null on failure.
	 */
	const translateProperNoun = useMutation<
		string, // Return type on success
		Error, // Error type
		string // Variables type (koreanTerm)
	>({
		mutationFn: async (koreanTerm) => {
			const url = genApiUrl(MODULE_NAMES.LLM, 'translateProperNoun');
			const response = await apiClient.post<{ translation: string }>(url, { koreanTerm });
			return response.data.translation;
		},
	});

	/**
	 * Extracts an array of proper nouns from a given block of text.
	 * @returns An array of extracted nouns, or an empty array on failure.
	 */
	const extractProperNouns = useMutation<
		string[], // Return type on success
		Error, // Error type
		string // Variables type (textToAnalyze)
	>({
		mutationFn: async (textToAnalyze) => {
			const url = genApiUrl(MODULE_NAMES.LLM, 'extractProperNouns');
			const response = await apiClient.post<{ nouns: string[] }>(url, { textToAnalyze });
			return response.data.nouns;
		},
	});

	return { invokeLlm, invokeLlmFromMessages, translateProperNoun, extractProperNouns };
};

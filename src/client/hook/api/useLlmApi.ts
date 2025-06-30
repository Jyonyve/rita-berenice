// src/client/hooks/useAiApi.ts
import { useMutation } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { genApiUrl, MODULE_NAMES, AiModelInfo, ChatRoleType } from '#shared/index.js';
import { ChatCompletionMessageParam } from 'openai/resources/index.mjs'; // This type is needed client-side
import { useToast } from '../../style/index.js';
import { ApiError } from '#server/util/serviceHelpers.js';
import { apiClient } from '../../util/index.js';

/**
 * A client-side hook for interacting with the AI (LLM) API endpoints.
 * It encapsulates API logic, loading/error states, and user notifications via a toast system.
 */
export const useAiApi = () => {
	const MODULE_NAME = MODULE_NAMES.LLM; // Assuming LLM is the module name for AI routes
	const { addToast } = useToast();

	const invokeLlm = useMutation<
		string, // Return type on success
		ApiError, // Error type
		{ role: ChatRoleType; prompt: string; aiModelInfo: AiModelInfo } // Variables type
	>({
		mutationFn: async ({ role, prompt, aiModelInfo }) => {
			const url = genApiUrl(MODULE_NAME, 'invokeLlm');
			const response = await apiClient.post<{ response: string }>(url, { role, prompt, aiModelInfo });
			return response.data.response;
		},
		onError: (error: ApiError) => {
			addToast(error.clientMessage || 'Failed to get LLM response.', 'error');
		},
	});
	/**
	 * Invokes a language model with a sequence of messages and returns the raw string response.
	 * @returns The assistant's response string, or null on failure.
	 */
	const invokeLlmFromMessages = useMutation<
		string, // Return type on success
		ApiError, // Error type
		{ messages: ChatCompletionMessageParam[]; aiModelInfo: AiModelInfo } // Variables type
	>({
		mutationFn: async ({ messages, aiModelInfo }) => {
			const url = genApiUrl(MODULE_NAME, 'invokeLlmFromMessages');
			const response = await apiClient.post<{ response: string }>(url, { messages, aiModelInfo });
			return response.data.response;
		},
		onError: (error: ApiError) => {
			addToast(error.clientMessage || 'Failed to get chat completion.', 'error');
		},
	});

	/**
	 * Translates a single Korean term to English using a language model.
	 * @returns The translated English term, or null on failure.
	 */
	const translateProperNoun = useMutation<
		string, // Return type on success
		ApiError, // Error type
		string // Variables type (koreanTerm)
	>({
		mutationFn: async (koreanTerm) => {
			const url = genApiUrl(MODULE_NAMES.LLM, 'translateProperNoun');
			const response = await apiClient.post<{ translation: string }>(url, { koreanTerm });
			return response.data.translation;
		},
		onError: (error: ApiError) => {
			addToast(error.clientMessage || 'Translation failed.', 'error');
		},
	});

	/**
	 * Extracts an array of proper nouns from a given block of text.
	 * @returns An array of extracted nouns, or an empty array on failure.
	 */
	const extractProperNouns = useMutation<
		string[], // Return type on success
		ApiError, // Error type
		string // Variables type (textToAnalyze)
	>({
		mutationFn: async (textToAnalyze) => {
			const url = genApiUrl(MODULE_NAMES.LLM, 'extractProperNouns');
			const response = await apiClient.post<{ nouns: string[] }>(url, { textToAnalyze });
			return response.data.nouns;
		},
		onError: (error: ApiError) => {
			addToast(error.clientMessage || 'Noun extraction failed.', 'error');
		},
	});

	return { invokeLlm, invokeLlmFromMessages, translateProperNoun, extractProperNouns };
};

// src/client/hooks/usePersonaApi.ts

import {
	genApiUrl,
	MODULE_NAMES,
	PersonaResponse,
	MemoryResponse,
	CharacterInfo,
	ProfileInfo,
	ChatMessage,
} from '#shared/index.js';
import { apiClient } from '../../util/index.js';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '../../style/index.js';
import { ApiError } from '#server/util/serviceHelpers.js';

/**
 * Type for the request body of the generateResponse API call.
 */
type GenerateResponseRequestBody = {
	recalledMemories: MemoryResponse;
	characterInfo: CharacterInfo;
	profileInfo: ProfileInfo;
	currentUserRequest: ChatMessage;
};

/**
 * A client-side hook for interacting with the PERSONA API endpoints, refactored for TanStack Query.
 */
export const usePersonaApi = () => {
	const MODULE_NAME = MODULE_NAMES.PERSONA;

	/**
	 * Generates a character's conversational response using recalled memory context.
	 * Mutation key: 'generateResponse'
	 */
	const generateResponse = useMutation<
		PersonaResponse | null,
		ApiError,
		GenerateResponseRequestBody
	>({
		mutationFn: async (requestBody) => {
			const url = genApiUrl(MODULE_NAME, 'generateResponse');
			const response = await apiClient.post<PersonaResponse>(url, requestBody);
			return response.data;
		},
	});

	return { generateResponse };
};

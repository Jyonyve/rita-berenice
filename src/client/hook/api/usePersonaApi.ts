// src/client/hooks/usePersonaApi.ts

import { apiClient } from '../../util/clientApiHelpers.ts';
import { useMutation } from '@tanstack/react-query';
import { MemoryResponse, PersonaResponse } from '#shared/api/ModuleResponse.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';

import { ChatMessage } from '@langchain/core/messages';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { genApiUrl } from '#shared/util/apiHelpers.js';

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
	const generateResponse = useMutation<PersonaResponse | null, Error, GenerateResponseRequestBody>({
		mutationFn: async (requestBody) => {
			const url = genApiUrl(MODULE_NAME, 'generateResponse');
			const response = await apiClient.post<PersonaResponse>(url, requestBody);
			return response.data;
		},
	});

	return { generateResponse };
};

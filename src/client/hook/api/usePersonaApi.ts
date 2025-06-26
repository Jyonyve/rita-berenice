// src/client/hooks/usePersonaApi.ts

import { useState, useCallback } from 'react';
import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	ApiError,
	PersonaResponse,
	MemoryResponse,
	CharacterInfo,
	ProfileInfo,
	ChatMessage,
} from '#shared/index.ts';
import { useToast } from '../../component/index.ts';

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
 * A client-side hook for interacting with the PERSONA API endpoints.
 * It encapsulates API logic, loading/error states, and user notifications via a toast system.
 */
export const usePersonaApi = () => {
	const MODULE_NAME = MODULE_NAMES.PERSONA;

	// --- Hooks ---
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<ApiError | null>(null);
	const { addToast } = useToast();

	/**
	 * Generates a character's conversational response using recalled memory context.
	 * @param recalledMemories The payload of context recalled by memoryEngine.
	 * @param characterInfo The full metadata for the character persona.
	 * @param profileInfo The full user profile info object.
	 * @param currentUserRequest The user's most recent message.
	 * @returns The character's response and emotion (PersonaResponse), or null on failure.
	 */
	const generateResponse = useCallback(
		async (
			recalledMemories: MemoryResponse,
			characterInfo: CharacterInfo,
			profileInfo: ProfileInfo,
			currentUserRequest: ChatMessage
		): Promise<PersonaResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'generateResponse');
				const requestBody: GenerateResponseRequestBody = {
					recalledMemories,
					characterInfo,
					profileInfo,
					currentUserRequest,
				};
				const response = await apiClient.post<PersonaResponse>(url, requestBody);
				// No success toast here, as this is a core chat function.
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to generate character response.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	return { loading, error, generateResponse };
};

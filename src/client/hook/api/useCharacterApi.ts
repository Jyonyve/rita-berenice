// src/client/hooks/useCharacter.ts
import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	CharacterResponse,
	CharacterInfo,
	CharacterCdo,
} from '@shared/index.ts';
import { useToast } from '../../style/ToastProvider.tsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '#server/util/serviceHelpers.ts';

export const useCharacterApi = () => {
	const { addToast } = useToast();
	const MODULE_NAME = MODULE_NAMES.CHARACTER;
	const queryClient = useQueryClient();

	/**
	 * Fetches all characters.
	 * Query key: ['getAllCharacters']
	 */
	const getAllCharacters = useQuery<CharacterResponse, ApiError>({
		queryKey: ['getAllCharacters'],
		queryFn: async () => {
			const url = genApiUrl(MODULE_NAME, 'getAllCharacters');
			const response = await apiClient.get<CharacterResponse>(url);
			return response.data;
		},
		enabled: true,
	});

	/**
	 * Fetches a single character by ID.
	 * Query key: ['getCharacter', characterId]
	 */
	const getCharacter = (characterId: string) =>
		useQuery<CharacterResponse, ApiError>({
			queryKey: ['getCharacter', characterId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getCharacter', [characterId]);
				const response = await apiClient.get<CharacterResponse>(url);
				return response.data;
			},
			enabled: !!characterId,
		});

	/**
	 * Fetches characters by show name.
	 * Query key: ['getCharactersByShowName', showName]
	 */
	const getCharactersByShowName = (showName: string) =>
		useQuery<CharacterResponse, ApiError>({
			queryKey: ['getCharactersByShowName', showName],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getCharactersByShowName', [showName]);
				const response = await apiClient.get<CharacterResponse>(url);
				return response.data;
			},
			enabled: !!showName,
		});

	/**
	 * Creates or updates a character.
	 * Mutation key: 'storeCharacter'
	 */
	const storeCharacter = useMutation<string, ApiError, CharacterCdo | CharacterInfo>({
		mutationFn: async (character) => {
			const url = genApiUrl(MODULE_NAME, 'storeCharacter');
			const response = await apiClient.post<string>(url, character);
			return JSON.parse(response.data);
		},
		onSuccess: () => {
			addToast('Character saved successfully.', 'success');
			queryClient.invalidateQueries({ queryKey: ['getAllCharacters'] });
		},
		onError: (error: ApiError) => {
			addToast(error.clientMessage || 'Failed to save character.', 'error');
		},
	});

	return { getAllCharacters, getCharacter, getCharactersByShowName, storeCharacter };
};

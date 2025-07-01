// src/client/hooks/useCharacter.ts
import {
	genApiUrl,
	MODULE_NAMES,
	CharacterResponse,
	CharacterInfo,
	CharacterCdo,
} from '#shared/index.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '#server/util/serviceHelpers.js';
import { apiClient } from '../../util/AppInitializer.ts';

export const useCharacterApi = () => {
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
			queryClient.invalidateQueries({ queryKey: ['getAllCharacters'] });
		},
	});

	return { getAllCharacters, getCharacter, getCharactersByShowName, storeCharacter };
};

// src/client/hooks/useCharacter.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from '../../util/clientHelpers.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { CharacterResponse } from '#shared/api/ModuleResponse.js';
import { genApiUrl } from '#shared/util/apiHelpers.js';
import { CharacterCdo, CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';

export const useCharacterApi = () => {
	const MODULE_NAME = MODULE_NAMES.CHARACTER;
	const queryClient = useQueryClient();

	/**
	 * Fetches all characters.
	 * Query key: ['getAllCharacters']
	 */
	const getAllCharacters = () =>
		useQuery<CharacterResponse, Error>({
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
		useQuery<CharacterResponse, Error>({
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
		useQuery<CharacterResponse, Error>({
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
	const storeCharacter = useMutation<string, Error, CharacterCdo | CharacterInfo>({
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

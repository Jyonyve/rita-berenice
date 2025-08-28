// src/client/hooks/useCharacter.ts

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, decompressData, genApiUrl } from '../../util/clientApiHelpers.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { CharacterResponse } from '#shared/api/ModuleResponse.js';
import { CharacterCdo, CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { Payload } from '#shared/util/apiHelpers.js';

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
				const response = await apiClient.get<Payload>(url);
				return decompressData<CharacterResponse>(response.data.payload);
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
				const response = await apiClient.get<Payload>(url);
				return decompressData<CharacterResponse>(response.data.payload);
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
				const response = await apiClient.get<Payload>(url);
				return decompressData<CharacterResponse>(response.data.payload);
			},
			enabled: !!showName,
		});

	/**
	 * Fetches characters by userId.
	 * Query key: ['getCharactersByUserId', userId]
	 */
	const getCharactersByUserId = (userId: string) =>
		useQuery<CharacterResponse, Error>({
			queryKey: ['getCharactersByUserId', userId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getCharactersByUserId', [userId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<CharacterResponse>(response.data.payload);
			},
			enabled: !!userId,
		});

	/**
	 * Creates or updates a character.
	 * Mutation key: 'storeCharacter'
	 */
	const storeCharacter = useMutation<string, Error, CharacterCdo | CharacterInfo>({
		mutationFn: async (character) => {
			const url = genApiUrl(MODULE_NAME, 'storeCharacter');
			const response = await apiClient.post<string>(url, character);
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['getAllCharacters'] });
		},
	});

	/**
	 * Uploads a character image
	 */
	const uploadCharacterImage = useMutation<any, Error, FormData>({
		mutationFn: async (formData) => {
			const url = genApiUrl(MODULE_NAME, 'uploadCharacterImage');
			const response = await apiClient.post(url, formData, {
				headers: { 'Content-Type': 'multipart/form-data' },
			});
			return response.data;
		},
	});

	/**
	 * Creates a character folder
	 */
	const createCharacterFolder = useMutation<any, Error, { characterId: string }>({
		mutationFn: async (data) => {
			const url = genApiUrl(MODULE_NAME, 'createCharacterFolder');
			const response = await apiClient.post(url, data);
			return response.data;
		},
	});

	return {
		getAllCharacters,
		getCharacter,
		getCharactersByShowName,
		getCharactersByUserId,
		storeCharacter: storeCharacter.mutateAsync,
		uploadCharacterImage: uploadCharacterImage.mutateAsync,
		createCharacterFolder: createCharacterFolder.mutateAsync,
	};
};

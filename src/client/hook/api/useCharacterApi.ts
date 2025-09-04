import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, decompressData, genApiUrl } from '../../util/clientApiHelpers.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { CharacterResponse } from '#shared/api/ModuleResponse.js';
import { CharacterCdo, CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { Payload } from '#shared/util/apiHelpers.js';

export const useCharacterApi = () => {
	const MODULE_NAME = MODULE_NAMES.CHARACTER;
	const queryClient = useQueryClient();

	const getAllCharacters = () =>
		useQuery<CharacterResponse, Error>({
			queryKey: ['getAllCharacters'],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getAllCharacters');
				const response = await apiClient.get<Payload>(url);
				return decompressData<CharacterResponse>(response.data.payload);
			},
		});

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
	 * REFACTORED: Now expects an object { characterId: string } from the server.
	 */
	const storeCharacter = useMutation<{ characterId: string }, Error, CharacterCdo | CharacterInfo>({
		mutationFn: async (character) => {
			const url = genApiUrl(MODULE_NAME, 'storeCharacter');
			// Expect the server to return a JSON object, not a raw string
			const response = await apiClient.post<{ characterId: string }>(url, character);
			return response.data;
		},
		onSuccess: (data, variables) => {
			// Invalidate all queries that could be affected by this change
			Promise.all([
				queryClient.invalidateQueries({ queryKey: ['getAllCharacters'] }),
				queryClient.invalidateQueries({ queryKey: ['getCharacter', data.characterId] }),
				queryClient.invalidateQueries({ queryKey: ['getCharactersByShowName', variables.showName] }),
				queryClient.invalidateQueries({ queryKey: ['getCharactersByUserId', variables.userId] }),
			]);
		},
	});

	/**
	 * Uploads a character image. No invalidation needed as it's a file system change,
	 * but the UI should refetch character data if image paths are stored in the character document.
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
	 * Deletes a character image.
	 */
	const deleteCharacterImage = useMutation<any, Error, { characterId: string; emotionKey: number }>({
		mutationFn: async (data) => {
			const url = genApiUrl(MODULE_NAME, 'deleteCharacterImage');
			const response = await apiClient.delete(url, { data });
			return response.data;
		},
		// Invalidate the specific character to update its image list
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ['getCharacter', variables.characterId] });
		},
	});

	/**
	 * Creates a character folder on the server.
	 * This is a pure side-effect and likely doesn't need to invalidate any data queries.
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
		deleteCharacterImage: deleteCharacterImage.mutateAsync,
		createCharacterFolder: createCharacterFolder.mutateAsync,
	};
};

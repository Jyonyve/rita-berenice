import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, decompressData, genApiUrl } from '../../util/clientApiHelpers.js';
import { MODULE_NAMES } from '@rita-berenice/shared/config';
import { CharacterResponse } from '@rita-berenice/shared/api';
import { CharacterCdo, CharacterInfo } from '@rita-berenice/shared/domain';
import { Payload } from '@rita-berenice/shared/util';

export const useCharacterApi = () => {
	const MODULE_NAME = MODULE_NAMES.CHARACTER;
	const queryClient = useQueryClient();

	const getAllCharacters = () =>
		useQuery<CharacterResponse, Error>({
			queryKey: ['characters', 'list', 'getAllCharacters'], // Hierarchical structure
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getAllCharacters');
				const response = await apiClient.get<Payload>(url);
				return decompressData<CharacterResponse>(response.data.payload);
			},
		});

	const getCharacter = (characterId: string) =>
		useQuery<CharacterResponse, Error>({
			queryKey: ['characters', 'detail', 'getCharacter', characterId], // Hierarchical structure
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getCharacter', [characterId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<CharacterResponse>(response.data.payload);
			},
			enabled: !!characterId,
		});

	const getCharactersByShowName = (showName: string) =>
		useQuery<CharacterResponse, Error>({
			queryKey: ['characters', 'list', 'getCharactersByShowName', showName], // Hierarchical structure
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getCharactersByShowName', [showName]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<CharacterResponse>(response.data.payload);
			},
			enabled: !!showName,
		});

	const getCharactersByUserId = (userId: string) =>
		useQuery<CharacterResponse, Error>({
			queryKey: ['characters', 'list', 'getCharactersByUserId', userId], // Hierarchical structure
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
			const response = await apiClient.post<{ characterId: string }>(url, character);
			return response.data;
		},
		onSuccess: (data, variables) => {
			// Invalidate the specific character detail
			queryClient.invalidateQueries({
				queryKey: ['characters', 'detail', 'getCharacter', data.characterId],
			});

			// Invalidate all character lists since a new/updated character affects all lists
			queryClient.invalidateQueries({ queryKey: ['characters', 'list'] });
		},
	});

	/**
	 * Uploads a character image.
	 * This affects the character's data (image paths), so we invalidate the character detail.
	 */
	const uploadCharacterImage = useMutation<any, Error, FormData>({
		mutationFn: async (formData) => {
			const url = genApiUrl(MODULE_NAME, 'uploadCharacterImage');
			const response = await apiClient.post(url, formData, {
				headers: { 'Content-Type': 'multipart/form-data' },
			});
			return response.data;
		},
		onSuccess: (data, variables) => {
			// If the response includes characterId, invalidate that specific character
			if (data?.characterId) {
				queryClient.invalidateQueries({
					queryKey: ['characters', 'detail', 'getCharacter', data.characterId],
				});
			}
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
		onSuccess: (_, variables) => {
			// Invalidate the specific character to update its image list
			queryClient.invalidateQueries({
				queryKey: ['characters', 'detail', 'getCharacter', variables.characterId],
			});
		},
	});

	/**
	 * Creates a character folder on the server.
	 * This is a pure side-effect and doesn't affect character data queries.
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, genApiUrl, type ApiRequestConfig } from '../../util/clientApiHelpers.js';
import { MODULE_NAMES } from '@rita-berenice/shared/config';
import { CharacterResponse } from '@rita-berenice/shared/api';
import { CharacterCdo, CharacterInfo } from '@rita-berenice/shared/domain';

export const useCharacterApi = () => {
  const MODULE_NAME = MODULE_NAMES.CHARACTER;
  const queryClient = useQueryClient();

  const getAllCharacters = () =>
    useQuery<CharacterResponse, Error>({
      queryKey: ['characters', 'list', 'getAllCharacters'], // Hierarchical structure
      queryFn: async () => {
        const url = genApiUrl(MODULE_NAME, 'getAllCharacters');
        const response = await apiClient.get<CharacterResponse>(url);
        return response.data;
      },
    });

  const getCharacter = (characterId: string) =>
    useQuery<CharacterResponse, Error>({
      queryKey: ['characters', 'detail', 'getCharacter', characterId], // Hierarchical structure
      queryFn: async () => {
        const url = genApiUrl(MODULE_NAME, 'getCharacter', [characterId]);
        const response = await apiClient.get<CharacterResponse>(url);
        return response.data;
      },
      enabled: !!characterId,
    });

  const getCharactersByShowName = (showName: string) =>
    useQuery<CharacterResponse, Error>({
      queryKey: ['characters', 'list', 'getCharactersByShowName', showName], // Hierarchical structure
      queryFn: async () => {
        const url = genApiUrl(MODULE_NAME, 'getCharactersByShowName', [showName]);
        const response = await apiClient.get<CharacterResponse>(url);
        return response.data;
      },
      enabled: !!showName,
    });

  const getCharactersByUserId = (userId: string) =>
    useQuery<CharacterResponse, Error>({
      queryKey: ['characters', 'list', 'getCharactersByUserId', userId], // Hierarchical structure
      queryFn: async () => {
        const url = genApiUrl(MODULE_NAME, 'getCharactersByUserId', [userId]);
        const response = await apiClient.get<CharacterResponse>(url);
        return response.data;
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
      const requestConfig: ApiRequestConfig = { _suppressToast: true };
      const response = await apiClient.post<{ characterId: string }>(url, character, requestConfig);
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
   * The form refreshes character queries once after its upload/delete batch finishes.
   */
  const uploadCharacterImage = useMutation<any, Error, FormData>({
    mutationFn: async (formData) => {
      const url = genApiUrl(MODULE_NAME, 'uploadCharacterImage');
      const requestConfig: ApiRequestConfig = {
        _suppressToast: true,
        // Override apiClient's JSON default. Axios/browser will add the required
        // multipart boundary for this FormData body.
        headers: { 'Content-Type': undefined },
      };
      const response = await apiClient.post(url, formData, requestConfig);
      return response.data;
    },
  });

  /**
   * Deletes a character image.
   */
  const deleteCharacterImage = useMutation<any, Error, { characterId: string; emotionKey: number }>({
    mutationFn: async (data) => {
      const url = genApiUrl(MODULE_NAME, 'deleteCharacterImage');
      const requestConfig: ApiRequestConfig = { _suppressToast: true, data };
      const response = await apiClient.delete(url, requestConfig);
      return response.data;
    },
  });

  const refreshCharacterImages = async (characterId: string): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['characters', 'detail', 'getCharacter', characterId],
      }),
      queryClient.invalidateQueries({ queryKey: ['characters', 'list'] }),
    ]);
  };

  /**
   * Creates a character folder on the server.
   * This is a pure side-effect and doesn't affect character data queries.
   */
  const createCharacterFolder = useMutation<any, Error, { characterId: string }>({
    mutationFn: async (data) => {
      const url = genApiUrl(MODULE_NAME, 'createCharacterFolder');
      const requestConfig: ApiRequestConfig = { _suppressToast: true };
      const response = await apiClient.post(url, data, requestConfig);
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
    refreshCharacterImages,
    createCharacterFolder: createCharacterFolder.mutateAsync,
  };
};

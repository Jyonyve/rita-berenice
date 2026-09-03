// src/client/hook/api/useCredentialApi.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, genApiUrl, type ApiRequestConfig } from '../../util/clientApiHelpers.js';
import { CredentialMetadataResponse, CredentialValidationResponse } from '@rita-berenice/shared/api';
import { MODULE_NAMES } from '@rita-berenice/shared/config';
import { UserApiKeys } from '@rita-berenice/shared/domain';

export const useCredentialApi = () => {
  const MODULE_NAME = MODULE_NAMES.CREDENTIAL;
  const queryClient = useQueryClient();

  // GET - Returns stored user API key metadata
  const getUserApiKeyMetadata = (userId: string) =>
    useQuery<CredentialMetadataResponse, Error>({
      queryKey: ['credentials', 'getUserApiKeys', userId],
      queryFn: async () => {
        const url = genApiUrl(MODULE_NAME, 'getUserApiKeys', [userId]);
        const response = await apiClient.get<CredentialMetadataResponse>(url);
        return response.data;
      },
      enabled: !!userId,
    });

  // POST - Returns void, just invalidates GET
  const storeUserApiKeys = useMutation<void, Error, { userId: string; apiKeys: UserApiKeys }>({
    mutationFn: async ({ userId, apiKeys }) => {
      const url = genApiUrl(MODULE_NAME, 'storeUserApiKeys');
      await apiClient.post(url, { userId, apiKeys }); // No return, no type needed
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['credentials', 'getUserApiKeys', variables.userId] });
    },
  });

  // PUT - Returns void, just invalidates GET
  const updateUserApiKey = useMutation<void, Error, { userId: string; keyType: keyof UserApiKeys; keyValue: string }>({
    mutationFn: async ({ userId, keyType, keyValue }) => {
      const url = genApiUrl(MODULE_NAME, 'updateUserApiKey');
      const requestConfig: ApiRequestConfig = { _suppressToast: true };
      await apiClient.put(url, { userId, keyType, keyValue }, requestConfig);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['credentials', 'getUserApiKeys', variables.userId] });
    },
  });

  const validateUserApiKeys = useMutation<CredentialValidationResponse, Error, { apiKeys: UserApiKeys }>({
    mutationFn: async ({ apiKeys }) => {
      const url = genApiUrl(MODULE_NAME, 'validateApiKeys');
      const response = await apiClient.post<CredentialValidationResponse>(url, { apiKeys });
      return response.data;
    },
  });

  return {
    getUserApiKeyMetadata,
    storeUserApiKeys: storeUserApiKeys.mutateAsync,
    updateUserApiKey: updateUserApiKey.mutateAsync,
    validateUserApiKeys: validateUserApiKeys.mutateAsync,
  };
};

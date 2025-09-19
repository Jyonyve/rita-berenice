// src/client/hook/api/useCredentialApi.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, decompressData, genApiUrl } from '../../util/clientApiHelpers.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { CredentialResponse } from '#shared/api/ModuleResponse.js';
import { Payload } from '#shared/util/apiHelpers.js';
import { UserApiKeys } from '#shared/domain/credential/CredentialInterfaces.js';

export const useCredentialApi = () => {
	const MODULE_NAME = MODULE_NAMES.CREDENTIAL;
	const queryClient = useQueryClient();

	// GET - Returns compressed UserApiKeys
	const getUserApiKeys = (userId: string) =>
		useQuery<CredentialResponse, Error>({
			queryKey: ['credentials', 'getUserApiKeys', userId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getUserApiKeys', [userId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<CredentialResponse>(response.data.payload);
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
	const updateUserApiKey = useMutation<
		void,
		Error,
		{ userId: string; keyType: keyof UserApiKeys; keyValue: string }
	>({
		mutationFn: async ({ userId, keyType, keyValue }) => {
			const url = genApiUrl(MODULE_NAME, 'updateUserApiKey');
			await apiClient.put(url, { userId, keyType, keyValue }); // No return, no type needed
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ['credentials', 'getUserApiKeys', variables.userId] });
		},
	});

	return {
		getUserApiKeys,
		storeUserApiKeys: storeUserApiKeys.mutateAsync,
		updateUserApiKey: updateUserApiKey.mutateAsync,
	};
};

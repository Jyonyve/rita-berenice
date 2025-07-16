// src/client/hooks/useUserApi.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../util/clientApiHelpers.ts';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { UserInfo } from '#shared/domain/user/UserInterfaces.js';
import { genApiUrl } from '#shared/util/apiHelpers.js';
import { UserResponse } from '#shared/api/ModuleResponse.js';

export const useUserApi = () => {
	const MODULE_NAME = MODULE_NAMES.USER;
	const queryClient = useQueryClient();

	// Create or update a user (POST returns void)
	const storeUser = useMutation<void, Error, UserInfo>({
		mutationFn: async (userInfo: UserInfo) => {
			const url = genApiUrl(MODULE_NAME, 'storeUser');
			await apiClient.post<void>(url, userInfo);
			// No return value needed
		},
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: ['getAllUsers'] });
			if (variables.userId) {
				queryClient.invalidateQueries({ queryKey: ['getUser', variables.userId] });
			}
		},
	});

	// Update sessionIds for a user (POST returns void)
	const updateUserSessionIds = useMutation<void, Error, { userId: string; sessionId: string }>({
		mutationFn: async ({ userId, sessionId }) => {
			const url = genApiUrl(MODULE_NAME, 'updateUserSessionIds');
			await apiClient.post<void>(url, { userId, sessionId });
			// No return value needed
		},
		onSuccess: (_data, variables) => {
			if (variables.userId) {
				queryClient.invalidateQueries({ queryKey: ['getUser', variables.userId] });
			}
		},
	});

	// Fetch all users
	const getAllUsers = () =>
		useQuery<UserResponse, Error>({
			queryKey: ['getAllUsers'],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getAllUsers');
				const response = await apiClient.get<UserResponse>(url);
				return response.data;
			},
			enabled: true,
		});

	// Fetch a single user by userId
	const getUser = (userId: string) =>
		useQuery<UserResponse, Error>({
			queryKey: ['getUser', userId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getUser', [userId]);
				const response = await apiClient.get<UserResponse>(url);
				return response.data;
			},
			enabled: !!userId,
		});

	// Fetch a user by contact
	const getUserByContact = (contact: string) =>
		useQuery<UserResponse, Error>({
			queryKey: ['getUserByContact', contact],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getUserByContact', [contact]);
				const response = await apiClient.get<UserResponse>(url);
				return response.data;
			},
			enabled: !!contact,
		});

	// Fetch a user by email
	const getUserByEmail = (email: string) =>
		useQuery<UserResponse, Error>({
			queryKey: ['getUserByEmail', email],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getUserByEmail', [email]);
				const response = await apiClient.get<UserResponse>(url);
				return response.data;
			},
			enabled: !!email,
		});

	return { storeUser, updateUserSessionIds, getAllUsers, getUser, getUserByContact, getUserByEmail };
};

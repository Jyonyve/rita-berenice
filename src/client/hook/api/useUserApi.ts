// src/client/hooks/useUserApi.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, genApiUrl } from '../../util/clientApiHelpers.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { UserCdo, UserInfo } from '#shared/domain/user/UserInterfaces.js';
import { UserResponse } from '#shared/api/ModuleResponse.js';
import { isUserInfo } from '#shared/util/typeGuardUtils.js';

export const useUserApi = () => {
	const MODULE_NAME = MODULE_NAMES.USER;
	const queryClient = useQueryClient();

	// Create or update a user
	const storeUser = useMutation<{ userId: string }, Error, UserCdo | UserInfo>({
		mutationFn: async (user) => {
			const url = genApiUrl(MODULE_NAME, 'storeUser');
			const response = await apiClient.post<{ userId: string }>(url, user);
			return response.data;
		},
		onSuccess: (_data, variables) => {
			Promise.all([
				queryClient.invalidateQueries({ queryKey: ['getAllUsers'] }),
				queryClient.invalidateQueries({ queryKey: ['getUser', variables.userId] }),
				queryClient.invalidateQueries({ queryKey: ['getUserByEmail', variables.email] }),
			]);

			if (isUserInfo(variables)) {
				queryClient.invalidateQueries({ queryKey: ['getUserByShowName', variables.showName] });
				queryClient.invalidateQueries({ queryKey: ['checkShowNameExists', variables.showName] });
			}
		},
	});

	// Check showName uniqueness - NEW METHOD
	const checkShowNameExists = (showName: string) =>
		useQuery<{ exists: boolean; available: boolean; showName: string }, Error>({
			queryKey: ['checkShowNameExists', showName],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'checkShowNameExists', [showName]);
				const response = await apiClient.get(url);
				return response.data;
			},
			enabled: !!showName && showName.trim().length > 0,
			// Cache for a short time since availability can change quickly
			staleTime: 30000, // 30 seconds
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

	// Fetch a user by showName - UPDATED METHOD NAME
	const getUserByShowName = (showName: string) =>
		useQuery<UserResponse, Error>({
			queryKey: ['getUserByShowName', showName],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getUserByShowName', [showName]);
				const response = await apiClient.get<UserResponse>(url);
				return response.data;
			},
			enabled: !!showName,
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

	return {
		storeUser: storeUser.mutateAsync,
		checkShowNameExists, // NEW: For username validation
		getAllUsers,
		getUser,
		getUserByShowName, // UPDATED: Renamed from getUserByContact
		getUserByEmail,
	};
};

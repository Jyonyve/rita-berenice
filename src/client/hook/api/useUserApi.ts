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
		onSuccess: () => {
			// Simple invalidation - covers all cases
			queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
			queryClient.invalidateQueries({ queryKey: ['users', 'detail'] });
			queryClient.invalidateQueries({ queryKey: ['users', 'validation'] });
		},
	});

	// Check showName uniqueness - Validation operation
	const checkShowNameExists = (showName: string) =>
		useQuery<{ exists: boolean; available: boolean; showName: string }, Error>({
			queryKey: ['users', 'validation', 'checkShowNameExists', showName],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'checkShowNameExists', [showName]);
				const response = await apiClient.get(url);
				return response.data;
			},
			enabled: !!showName && showName.trim().length > 0,
			// Cache for a short time since availability can change quickly
			staleTime: 30000, // 30 seconds
		});

	// Fetch all users - List operation
	const getAllUsers = () =>
		useQuery<UserResponse, Error>({
			queryKey: ['users', 'list', 'getAllUsers'],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getAllUsers');
				const response = await apiClient.get<UserResponse>(url);
				return response.data;
			},
		});

	// Fetch a single user by userId - Detail operation
	const getUser = (userId: string) =>
		useQuery<UserResponse, Error>({
			queryKey: ['users', 'detail', 'getUser', userId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getUser', [userId]);
				const response = await apiClient.get<UserResponse>(url);
				return response.data;
			},
			enabled: !!userId,
		});

	// Fetch a user by showName - Lookup operation
	const getUserByShowName = (showName: string) =>
		useQuery<UserResponse, Error>({
			queryKey: ['users', 'detail', 'getUserByShowName', showName],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getUserByShowName', [showName]);
				const response = await apiClient.get<UserResponse>(url);
				return response.data;
			},
			enabled: !!showName,
		});

	// Fetch a user by email - Lookup operation
	const getUserByEmail = (email: string) =>
		useQuery<UserResponse, Error>({
			queryKey: ['users', 'detail', 'getUserByEmail', email],
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

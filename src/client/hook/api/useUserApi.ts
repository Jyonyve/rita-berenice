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
			queryClient.invalidateQueries({ queryKey: ['users'] });
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

	/**
	 * Uploads a user avatar image and returns the public URL.
	 * This is intended to be called BEFORE storeUser.
	 */
	const uploadUserAvatar = useMutation<{ avatarUrl: string }, Error, FormData>({
		mutationFn: async (formData: FormData) => {
			// This endpoint should handle file saving and return the new public URL.
			const url = genApiUrl(MODULE_NAME, 'uploadUserAvatar');
			const response = await apiClient.post<{ avatarUrl: string }>(url, formData, {
				headers: { 'Content-Type': 'multipart/form-data' },
			});
			return response.data;
		},
	});

	/**
	 * Deletes a user's avatar image.
	 */
	const deleteUserAvatar = useMutation<void, Error, { userId: string }>({
		mutationFn: async ({ userId }) => {
			const url = genApiUrl(MODULE_NAME, 'deleteUserAvatar');
			const response = await apiClient.delete(url, { data: { userId } });
			return response.data;
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ['users', 'detail', 'getUser', variables.userId] });
		},
	});

	/**
	 * Creates a character folder on the server.
	 * This is a pure side-effect and doesn't affect character data queries.
	 */
	const createUserFolder = useMutation<any, Error, { userId: string }>({
		mutationFn: async (data) => {
			const url = genApiUrl(MODULE_NAME, 'createUserFolder');
			const response = await apiClient.post(url, data);
			return response.data;
		},
	});

	return {
		checkShowNameExists,
		getAllUsers,
		getUser,
		getUserByShowName,
		getUserByEmail,
		storeUser: storeUser.mutateAsync,
		createUserFolder: createUserFolder.mutateAsync,
		uploadUserAvatar: uploadUserAvatar.mutateAsync,
		deleteUserAvatar: deleteUserAvatar.mutateAsync,
	};
};

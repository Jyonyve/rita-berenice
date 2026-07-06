import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, genApiUrl } from '../../util/clientApiHelpers.js';
import { UserResponse } from '@rita-berenice/shared/api';
import { MODULE_NAMES } from '@rita-berenice/shared/config';
import { UserCdo, UserInfo } from '@rita-berenice/shared/domain';

export const useUserApi = () => {
	const MODULE_NAME = MODULE_NAMES.USER;
	const queryClient = useQueryClient();

	// === QUERIES ===

	const getMe = (enabled = true) =>
		useQuery<UserResponse, Error>({
			queryKey: ['users', 'detail', 'me'],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getMe');
				const response = await apiClient.get<UserResponse>(url);
				return response.data;
			},
			enabled,
		});

	/**
	 * Fetch all users - List operation
	 */
	const getAllUsers = () =>
		useQuery<UserResponse, Error>({
			queryKey: ['users', 'list', 'getAllUsers'], // Hierarchical structure
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getAllUsers');
				const response = await apiClient.get<UserResponse>(url);
				return response.data;
			},
		});

	/**
	 * Fetch a single user by userId - Detail operation
	 */
	const getUser = (userId: string) =>
		useQuery<UserResponse, Error>({
			queryKey: ['users', 'detail', 'getUser', userId], // Hierarchical structure
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getUser', [userId]);
				const response = await apiClient.get<UserResponse>(url);
				return response.data;
			},
			enabled: !!userId,
		});

	/**
	 * Fetch a user by showName - Lookup operation
	 */
	const getUserByShowName = (showName: string) =>
		useQuery<UserResponse, Error>({
			queryKey: ['users', 'detail', 'getUserByShowName', showName], // Hierarchical structure
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getUserByShowName', [showName]);
				const response = await apiClient.get<UserResponse>(url);
				return response.data;
			},
			enabled: !!showName,
		});

	/**
	 * Fetch a user by email - Lookup operation
	 */
	const getUserByEmail = (email: string) =>
		useQuery<UserResponse, Error>({
			queryKey: ['users', 'detail', 'getUserByEmail', email], // Hierarchical structure
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getUserByEmail', [email]);
				const response = await apiClient.get<UserResponse>(url);
				return response.data;
			},
			enabled: !!email,
		});

	/**
	 * Check showName uniqueness - Validation operation
	 */
	const checkShowNameExists = (showName: string) =>
		useQuery<{ exists: boolean; available: boolean; showName: string }, Error>({
			queryKey: ['users', 'validation', 'checkShowNameExists', showName], // Hierarchical structure
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'checkShowNameExists', [showName]);
				const response = await apiClient.get(url);
				return response.data;
			},
			enabled: !!showName && showName.trim().length > 0,
			staleTime: 30000, // 30 seconds - cache for short time since availability can change quickly
		});

	// === MUTATIONS ===

	/**
	 * Creates or updates a user.
	 * REFACTORED: Now expects an object { userId: string } from the server.
	 */
	const storeUser = useMutation<{ userId: string }, Error, UserCdo | UserInfo>({
		mutationFn: async (user) => {
			const url = genApiUrl(MODULE_NAME, 'storeUser');
			const response = await apiClient.post<{ userId: string }>(url, user);
			return response.data;
		},
		onSuccess: (data, variables) => {
			// Invalidate the specific user detail
			queryClient.invalidateQueries({ queryKey: ['users', 'detail', 'getUser', data.userId] });
			queryClient.invalidateQueries({ queryKey: ['users', 'detail', 'me'] });

			// Invalidate all user lists since a new/updated user affects all lists
			queryClient.invalidateQueries({ queryKey: ['users', 'list'] });

			// Invalidate validation queries as well
			queryClient.invalidateQueries({ queryKey: ['users', 'validation'] });
		},
	});

	/**
	 * Uploads a user avatar image.
	 * This affects the user's data (avatar URL), so we invalidate the user detail.
	 */
	const uploadUserAvatar = useMutation<
		{ avatarUrl: string; success: boolean; message: string },
		Error,
		FormData
	>({
		mutationFn: async (formData) => {
			const url = genApiUrl(MODULE_NAME, 'uploadUserAvatar');
			const response = await apiClient.post<{ avatarUrl: string; success: boolean; message: string }>(
				url,
				formData,
				{ headers: { 'Content-Type': 'multipart/form-data' } }
			);
			return response.data;
		},
		onSuccess: (data, variables) => {
			// Extract userId from FormData to invalidate the correct user
			const userId = variables.get('userId') as string;
			if (userId) {
				queryClient.invalidateQueries({ queryKey: ['users', 'detail', 'getUser', userId] });
			}
		},
	});

	/**
	 * Deletes a user's avatar image.
	 */
	const deleteUserAvatar = useMutation<
		{ success: boolean; message: string },
		Error,
		{ userId: string }
	>({
		mutationFn: async (data) => {
			const url = genApiUrl(MODULE_NAME, 'deleteUserAvatar');
			const response = await apiClient.delete(url, { data });
			return response.data;
		},
		onSuccess: (_, variables) => {
			// Invalidate the specific user to update their avatar
			queryClient.invalidateQueries({ queryKey: ['users', 'detail', 'getUser', variables.userId] });
		},
	});

	/**
	 * Creates a user folder on the server.
	 * This is a pure side-effect and doesn't affect user data queries.
	 */
	const createUserFolder = useMutation<
		{ success: boolean; message: string; path: string },
		Error,
		{ userId: string }
	>({
		mutationFn: async (data) => {
			const url = genApiUrl(MODULE_NAME, 'createUserFolder');
			const response = await apiClient.post(url, data);
			return response.data;
		},
	});

	return {
		// Queries
		getMe,
		getAllUsers,
		getUser,
		getUserByShowName,
		getUserByEmail,
		checkShowNameExists,

		// Mutations (exposed as async functions for consistency with character API)
		storeUser: storeUser.mutateAsync,
		uploadUserAvatar: uploadUserAvatar.mutateAsync,
		deleteUserAvatar: deleteUserAvatar.mutateAsync,
		createUserFolder: createUserFolder.mutateAsync,
	};
};

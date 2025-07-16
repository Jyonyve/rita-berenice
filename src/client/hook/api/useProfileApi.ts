// src/client/hooks/useProfileApi.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../util/clientApiHelpers.ts';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { ProfileCdo, ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { genApiUrl } from '#shared/util/apiHelpers.js';
import { ProfileResponse } from '#shared/api/ModuleResponse.js';

/**
 * A client-side hook for interacting with the PROFILE API endpoints, refactored for TanStack Query.
 */
export const useProfileApi = () => {
	const MODULE_NAME = MODULE_NAMES.PROFILE;
	const queryClient = useQueryClient();

	/**
	 * Creates or updates a user profile.
	 */
	const storeProfile = useMutation<string, Error, ProfileInfo | ProfileCdo>({
		mutationFn: async (profileInfo: ProfileInfo | ProfileCdo) => {
			const url = genApiUrl(MODULE_NAME, 'storeProfile');
			const response = await apiClient.post<string>(url, profileInfo);
			return JSON.parse(response.data);
		},
		onSuccess: (data, variables) => {
			// Invalidate queries that are now stale
			queryClient.invalidateQueries({ queryKey: ['getAllProfilesByUserId'] });
			if (variables.sessionId) {
				queryClient.invalidateQueries({ queryKey: ['getProfileBySessionId', variables.sessionId] });
			}
		},
	});

	/**
	 * Fetches all user profiles.
	 * TODO: add user Id to the query key if needed for multi-user support.
	 */
	const getAllProfilesByUserId = (userId: string) =>
		useQuery<ProfileResponse, Error>({
			queryKey: ['getAllProfilesByUserId', userId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getAllProfilesByUserId', [userId]);
				const response = await apiClient.get<ProfileResponse>(url);
				return response.data;
			},
			// This query can run by default if needed on app load
			enabled: !!userId, // Only run if userId is provided
		});

	/**
	 * Fetches a single profile by its unique ID.
	 */
	const getProfile = (profileId: string) =>
		useQuery<ProfileResponse, Error>({
			queryKey: ['getProfile', profileId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getProfile', [profileId]);
				const response = await apiClient.get<ProfileResponse>(url);
				return response.data;
			},
			enabled: !!profileId, // Only run if profileId is provided
		});

	/**
	 * Fetches a profile by its associated session ID.
	 * Handles 404 errors gracefully by not showing a toast.
	 */
	const getProfileBySessionId = (sessionId: string) =>
		useQuery<ProfileResponse, Error>({
			queryKey: ['getProfileBySessionId', sessionId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getProfileBySessionId', [sessionId]);
				const response = await apiClient.get<ProfileResponse>(url);
				return response.data;
			},
			enabled: !!sessionId,
			retry: (failureCount, error) => {
				// Don't retry if the error is a 404 Not Found
				if (error.name === '404') {
					return false;
				}
				// Otherwise, use default retry logic (e.g., 3 times)
				return failureCount < 3;
			},
		});

	/**
	 * Fetches all profiles associated with a specific show name.
	 */
	const getProfilesByShowName = (showName: string) =>
		useQuery<ProfileResponse, Error>({
			queryKey: ['getProfilesByShowName', showName],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getProfilesByShowName', [showName]);
				const response = await apiClient.get<ProfileResponse>(url);
				return response.data;
			},
			enabled: !!showName,
		});

	// The hook returns the React Query hooks directly.
	// `loading` and `error` states are now part of the individual hook results.
	return {
		storeProfile: storeProfile.mutateAsync,
		getAllProfilesByUserId,
		getProfile,
		getProfileBySessionId,
		getProfilesByShowName,
	};
};

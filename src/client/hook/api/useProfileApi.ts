// src/client/hooks/useProfileApi.ts

import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	ProfileResponse,
	ProfileMetadata,
} from '#shared/index.ts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../style/ToastProvider.tsx';
import { ApiError } from '#server/util/serviceHelpers.ts';

// Define a type for the structured response from the storeProfile endpoint
interface StoreProfileResponse {
	message: string;
	characterId: string; // The key is characterId in the store response
	updatedAt: string;
}

/**
 * A client-side hook for interacting with the PROFILE API endpoints, refactored for TanStack Query.
 */
export const useProfileApi = () => {
	const MODULE_NAME = MODULE_NAMES.PROFILE;
	const { addToast } = useToast();
	const queryClient = useQueryClient();

	/**
	 * Creates or updates a user profile.
	 */
	const storeProfile = useMutation<StoreProfileResponse, ApiError, ProfileMetadata>({
		mutationFn: async (profileInfo: ProfileMetadata) => {
			const url = genApiUrl(MODULE_NAME, 'storeProfile');
			const response = await apiClient.post<string>(url, profileInfo);
			return JSON.parse(response.data) as StoreProfileResponse;
		},
		onSuccess: (data, variables) => {
			addToast('Profile saved successfully.', 'success');
			// Invalidate queries that are now stale
			queryClient.invalidateQueries({ queryKey: ['getAllProfiles'] });
			if (variables.sessionId) {
				queryClient.invalidateQueries({ queryKey: ['getProfileBySessionId', variables.sessionId] });
			}
		},
		onError: (error: ApiError) => {
			addToast(error.clientMessage || 'Failed to save profile.', 'error');
		},
	});

	/**
	 * Fetches all user profiles.
	 * TODO: add user Id to the query key if needed for multi-user support.
	 */
	const getAllProfiles = (userId?: string) =>
		useQuery<ProfileResponse, ApiError>({
			queryKey: ['getAllProfiles'],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getAllProfiles');
				const response = await apiClient.get<ProfileResponse>(url);
				return response.data;
			},
			// This query can run by default if needed on app load
			enabled: true,
		});

	/**
	 * Fetches a single profile by its unique ID.
	 */
	const getProfile = (profileId: string) =>
		useQuery<ProfileResponse, ApiError>({
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
		useQuery<ProfileResponse, ApiError>({
			queryKey: ['getProfileBySessionId', sessionId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getProfileBySessionId', [sessionId]);
				const response = await apiClient.get<ProfileResponse>(url);
				return response.data;
			},
			enabled: !!sessionId,
			retry: (failureCount, error) => {
				// Don't retry if the error is a 404 Not Found
				if (error.status === 404) {
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
		useQuery<ProfileResponse, ApiError>({
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
	return { storeProfile, getAllProfiles, getProfile, getProfileBySessionId, getProfilesByShowName };
};

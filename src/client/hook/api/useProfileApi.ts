// src/client/hooks/useProfileApi.ts

import { useState, useCallback } from 'react';
import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	ApiError,
	ProfileResponse,
	ProfileMetadata,
} from '#shared/index.ts';
import { useToast } from '../../component/index.ts';

// Define a type for the structured response from the storeProfile endpoint
interface StoreProfileResponse {
	message: string;
	characterId: string; // The key is characterId in the store response
	updatedAt: string;
}

/**
 * A client-side hook for interacting with the PROFILE API endpoints.
 * It encapsulates API logic, loading/error states, and user notifications via a toast system.
 */
export const useProfileApi = () => {
	const MODULE_NAME = MODULE_NAMES.PROFILE;

	// --- Hooks ---
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<ApiError | null>(null);
	const { addToast } = useToast();

	/**
	 * Creates or updates a user profile.
	 * @param profileInfo The profile data to save.
	 * @returns A confirmation object on success, or null on failure.
	 */
	const storeProfile = useCallback(
		async (profileInfo: ProfileMetadata): Promise<StoreProfileResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'storeProfile');
				// The server returns a JSON string, so we expect a string response
				const response = await apiClient.post<string>(url, profileInfo);
				addToast('Profile saved successfully.', 'success');
				// Parse the string into our structured response type
				return JSON.parse(response.data) as StoreProfileResponse;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to save profile.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Fetches all user profiles.
	 * @returns A ProfileResponse object, or null on failure.
	 */
	const getAllProfiles = useCallback(async (): Promise<ProfileResponse | null> => {
		setLoading(true);
		setError(null);
		try {
			const url = genApiUrl(MODULE_NAME, 'getAllProfiles');
			const response = await apiClient.get<ProfileResponse>(url);
			return response.data;
		} catch (err) {
			const apiError = err as ApiError;
			addToast(apiError.clientMessage || 'Failed to load profiles.', 'error');
			setError(apiError);
			return null;
		} finally {
			setLoading(false);
		}
	}, [addToast]);

	/**
	 * Fetches a single profile by its unique ID.
	 * @param profileId The ID of the profile.
	 * @returns A ProfileResponse object, or null on failure.
	 */
	const getProfile = useCallback(
		async (profileId: string): Promise<ProfileResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'getProfile', [profileId]);
				const response = await apiClient.get<ProfileResponse>(url);
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to load profile.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Fetches a profile by its associated session ID.
	 * @param sessionId The ID of the session.
	 * @returns A ProfileResponse object, or null on failure.
	 */
	const getProfileBySessionId = useCallback(
		async (sessionId: string): Promise<ProfileResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'getProfileBySessionId', [sessionId]);
				const response = await apiClient.get<ProfileResponse>(url);
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				// A 404 is common here (e.g., new session), so we don't show a toast for it.
				if (apiError.status !== 404) {
					addToast(apiError.clientMessage || 'Failed to load user profile.', 'error');
				}
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Fetches all profiles associated with a specific show name.
	 * @param showName The name of the show.
	 * @returns A ProfileResponse object, or null on failure.
	 */
	const getProfilesByShowName = useCallback(
		async (showName: string): Promise<ProfileResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'getProfilesByShowName', [showName]);
				const response = await apiClient.get<ProfileResponse>(url);
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to load profiles by show.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	return {
		loading,
		error,
		storeProfile,
		getAllProfiles,
		getProfile,
		getProfileBySessionId,
		getProfilesByShowName,
	};
};

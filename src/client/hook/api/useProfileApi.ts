import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, decompressData, genApiUrl } from '../../util/clientApiHelpers.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { ProfileCdo, ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { Payload } from '#shared/util/apiHelpers.js';
import { ProfileResponse } from '#shared/api/ModuleResponse.js';

/**
 * A client-side hook for interacting with the PROFILE API endpoints.
 */
export const useProfileApi = () => {
	const MODULE_NAME = MODULE_NAMES.PROFILE;
	const queryClient = useQueryClient();

	/**
	 * Creates or updates a user profile.
	 * The mutationFn already correctly expects an object: { profileId: string }.
	 */
	const storeProfile = useMutation<{ profileId: string }, Error, ProfileInfo | ProfileCdo>({
		mutationFn: async (profileData) => {
			const url = genApiUrl(MODULE_NAME, 'storeProfile');
			const response = await apiClient.post<{ profileId: string }>(url, profileData);
			return response.data;
		},
		onSuccess: (data, variables) => {
			// This mutation affects multiple queries, so we use Promise.all
			// to invalidate them concurrently.
			const invalidations = [
				queryClient.invalidateQueries({ queryKey: ['getAllProfilesByUserId', variables.userId] }),
				queryClient.invalidateQueries({ queryKey: ['getProfile', data.profileId] }),
			];

			if (variables.sessionId) {
				invalidations.push(
					queryClient.invalidateQueries({ queryKey: ['getProfileBySessionId', variables.sessionId] })
				);
			}

			Promise.all(invalidations);
		},
	});

	const getAllProfilesByUserId = (userId: string) =>
		useQuery<ProfileResponse, Error>({
			queryKey: ['getAllProfilesByUserId', userId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getAllProfilesByUserId', [userId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<ProfileResponse>(response.data.payload);
			},
			enabled: !!userId,
		});

	const getProfile = (profileId: string) =>
		useQuery<ProfileResponse, Error>({
			queryKey: ['getProfile', profileId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getProfile', [profileId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<ProfileResponse>(response.data.payload);
			},
			enabled: !!profileId,
		});

	const getProfileBySessionId = (sessionId: string) =>
		useQuery<ProfileResponse, Error>({
			queryKey: ['getProfileBySessionId', sessionId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getProfileBySessionId', [sessionId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<ProfileResponse>(response.data.payload);
			},
			enabled: !!sessionId,
		});

	const getProfilesByShowName = (showName: string) =>
		useQuery<ProfileResponse, Error>({
			queryKey: ['getProfilesByShowName', showName],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getProfilesByShowName', [showName]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<ProfileResponse>(response.data.payload);
			},
			enabled: !!showName,
		});

	return {
		storeProfile: storeProfile.mutateAsync,
		getAllProfilesByUserId,
		getProfile,
		getProfileBySessionId,
		getProfilesByShowName,
	};
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, genApiUrl, type ApiRequestConfig } from '../../util/clientApiHelpers.js';
import { MODULE_NAMES } from '@rita-berenice/shared/config';
import { ProfileCdo, ProfileInfo } from '@rita-berenice/shared/domain';
import { ProfileResponse } from '@rita-berenice/shared/api';

/**
 * A client-side hook for interacting with the PROFILE API endpoints.
 */
export const useProfileApi = () => {
  const MODULE_NAME = MODULE_NAMES.PROFILE;
  const queryClient = useQueryClient();

  /**
   * Creates or updates a user profile.
   */
  const storeProfile = useMutation<{ profileId: string }, Error, ProfileInfo | ProfileCdo>({
    mutationFn: async (profileData) => {
      const url = genApiUrl(MODULE_NAME, 'storeProfile');
      const response = await apiClient.post<{ profileId: string }>(url, profileData);
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate the specific profile
      queryClient.invalidateQueries({
        queryKey: ['profiles', 'detail', 'getProfile', data.profileId],
      });

      // Invalidate all profile lists since a new/updated profile affects all lists
      queryClient.invalidateQueries({ queryKey: ['profiles', 'list'] });
    },
  });

  const uploadProfileImage = useMutation<
    { profileId: string; portraitPath: string; avatarPath: string },
    Error,
    FormData
  >({
    mutationFn: async (formData) => {
      const url = genApiUrl(MODULE_NAME, 'uploadProfileImage');
      const requestConfig: ApiRequestConfig = {
        _suppressToast: true,
        headers: { 'Content-Type': undefined },
      };
      const response = await apiClient.post<{
        profileId: string;
        portraitPath: string;
        avatarPath: string;
      }>(url, formData, requestConfig);
      return response.data;
    },
    onSuccess: ({ profileId }) => {
      queryClient.invalidateQueries({ queryKey: ['profiles', 'detail', 'getProfile', profileId] });
      queryClient.invalidateQueries({ queryKey: ['profiles', 'detail'] });
      queryClient.invalidateQueries({ queryKey: ['profiles', 'list'] });
    },
  });

  const getAllProfilesByUserId = (userId: string) =>
    useQuery<ProfileResponse, Error>({
      queryKey: ['profiles', 'list', 'getAllProfilesByUserId', userId], // Hierarchical structure
      queryFn: async () => {
        const url = genApiUrl(MODULE_NAME, 'getAllProfilesByUserId', [userId]);
        const response = await apiClient.get<ProfileResponse>(url);
        return response.data;
      },
      enabled: !!userId,
    });

  const getProfile = (profileId: string) =>
    useQuery<ProfileResponse, Error>({
      queryKey: ['profiles', 'detail', 'getProfile', profileId], // Hierarchical structure
      queryFn: async () => {
        const url = genApiUrl(MODULE_NAME, 'getProfile', [profileId]);
        const response = await apiClient.get<ProfileResponse>(url);
        return response.data;
      },
      enabled: !!profileId,
    });

  const getProfileBySessionId = (sessionId: string) =>
    useQuery<ProfileResponse, Error>({
      queryKey: ['profiles', 'detail', 'getProfileBySessionId', sessionId], // Hierarchical structure
      queryFn: async () => {
        const url = genApiUrl(MODULE_NAME, 'getProfileBySessionId', [sessionId]);
        const response = await apiClient.get<ProfileResponse>(url);
        return response.data;
      },
      enabled: !!sessionId,
    });

  const getProfilesByShowName = (showName: string) =>
    useQuery<ProfileResponse, Error>({
      queryKey: ['profiles', 'list', 'getProfilesByShowName', showName], // Hierarchical structure
      queryFn: async () => {
        const url = genApiUrl(MODULE_NAME, 'getProfilesByShowName', [showName]);
        const response = await apiClient.get<ProfileResponse>(url);
        return response.data;
      },
      enabled: !!showName,
    });

  return {
    storeProfile: storeProfile.mutateAsync,
    uploadProfileImage: uploadProfileImage.mutateAsync,
    getAllProfilesByUserId,
    getProfile,
    getProfileBySessionId,
    getProfilesByShowName,
  };
};

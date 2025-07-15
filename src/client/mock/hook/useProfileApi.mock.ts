// src/mock/hook/useProfileApi.mock.ts

import { ProfileCdo, ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';
import { ProfileResponse } from '#shared/api/ModuleResponse.js';
import { mockMondayProfile } from '../data/mockProfileData.js';

export const useProfileApiMock = () => {
	/**
	 * Mocks creating or updating a user profile.
	 * Logs the action and returns a resolved promise with a mock profile ID.
	 */
	const storeProfile = async (profileInfo: ProfileInfo | ProfileCdo): Promise<string> => {
		console.log('[MOCK] storeProfile called with:', profileInfo);
		return Promise.resolve('mock-profile-id-12345');
	};

	/**
	 * Mocks fetching all user profiles by userId.
	 */
	const getAllProfilesByUserId = (userId: string) => ({
		data: mockMondayProfile,
		isLoading: false,
		isError: false,
		error: null,
	});

	/**
	 * Mocks fetching a single profile by profileId.
	 */
	const getProfile = (profileId: string) => {
		return { data: mockMondayProfile, isLoading: false, isError: false, error: null };
	};

	/**
	 * Mocks fetching a profile by sessionId.
	 */
	const getProfileBySessionId = (sessionId: string) => {
		return { data: mockMondayProfile, isLoading: false, isError: false, error: null };
	};

	/**
	 * Mocks fetching all profiles by show name.
	 */
	const getProfilesByShowName = (showName: string) => ({
		data: mockMondayProfile,
		isLoading: false,
		isError: false,
		error: null,
	});

	return {
		storeProfile,
		getAllProfilesByUserId,
		getProfile,
		getProfileBySessionId,
		getProfilesByShowName,
	};
};

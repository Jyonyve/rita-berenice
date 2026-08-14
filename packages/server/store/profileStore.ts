import { ProfileResponse } from '@rita-berenice/shared/api';
import { ApiError, ProfileCdo, ProfileInfo } from '@rita-berenice/shared/domain';
import { buildProfileId, createBasicProfileInfo, isProfileInfo } from '@rita-berenice/shared/util';
import { eq, ilike } from 'drizzle-orm';
import { getDatabase } from '../db/postgresClient.js';
import { profiles } from '../db/schema.js';
import { handleServiceError } from '../util/serviceHelpers.js';
import { getProfileImageUrls } from '../util/imageStorageUtils.js';

const toResponse = async (profileInfos: ProfileInfo[]): Promise<ProfileResponse> => {
	const imagePairs = await Promise.all(
		profileInfos.map(async ({ profileId }) => ({
			profileId,
			...(await getProfileImageUrls(profileId)),
		}))
	);

	return {
		ids: profileInfos.map((profile) => profile.profileId),
		documents: profileInfos.map((profile) => profile.description),
		metadatas: profileInfos.map(() => null),
		profileInfos,
		profileInfo: profileInfos[0] || null,
		profilePortraits: Object.fromEntries(
			imagePairs.flatMap(({ profileId, portraitUrl }) =>
				portraitUrl ? [[profileId, portraitUrl]] : []
			)
		),
		profileAvatars: Object.fromEntries(
			imagePairs.flatMap(({ profileId, avatarUrl }) => (avatarUrl ? [[profileId, avatarUrl]] : []))
		),
	};
};

export const profileStore = {
	getAllProfilesByUserId: async (userId: string): Promise<ProfileResponse> => {
		try {
			const rows = await getDatabase()
				.select({ data: profiles.data })
				.from(profiles)
				.where(eq(profiles.userId, userId));
			return await toResponse(rows.map((row) => row.data));
		} catch (error) {
			handleServiceError(error, `Failed to get profiles for user '${userId}'`);
		}
	},

	getProfile: async (profileId: string): Promise<ProfileResponse> => {
		try {
			const [row] = await getDatabase()
				.select({ data: profiles.data })
				.from(profiles)
				.where(eq(profiles.profileId, profileId))
				.limit(1);
			if (!row) throw new ApiError(404, `Profile '${profileId}' not found.`);
			return await toResponse([row.data]);
		} catch (error) {
			handleServiceError(error, `Failed to get profile with ID ${profileId}`);
		}
	},

	getProfileBySessionId: async (sessionId: string): Promise<ProfileResponse> => {
		try {
			const [row] = await getDatabase()
				.select({ data: profiles.data })
				.from(profiles)
				.where(eq(profiles.sessionId, sessionId))
				.limit(1);
			if (!row) throw new ApiError(404, `Profile for session '${sessionId}' not found.`);
			return await toResponse([row.data]);
		} catch (error) {
			handleServiceError(error, `Failed to get profile with sessionId ${sessionId}`);
		}
	},

	getProfilesByShowName: async (showName: string): Promise<ProfileResponse> => {
		try {
			const rows = await getDatabase()
				.select({ data: profiles.data })
				.from(profiles)
				.where(ilike(profiles.showName, `%${showName}%`));
			return await toResponse(rows.map((row) => row.data));
		} catch (error) {
			handleServiceError(error, `Failed to get profiles by showName '${showName}'`);
		}
	},

	storeProfile: async (profile: ProfileCdo | ProfileInfo): Promise<{ profileId: string }> => {
		const now = new Date().toISOString();
		const baseProfile = isProfileInfo(profile) ? profile : createBasicProfileInfo(profile);
		const updatedProfile: ProfileInfo = {
			...baseProfile,
			profileId: baseProfile.profileId || buildProfileId(baseProfile.sessionId, baseProfile.userId),
			createdAt: baseProfile.createdAt || now,
			updatedAt: now,
		};

		try {
			await getDatabase()
				.insert(profiles)
				.values({
					profileId: updatedProfile.profileId,
					sessionId: updatedProfile.sessionId,
					userId: updatedProfile.userId,
					showName: updatedProfile.showName,
					data: updatedProfile,
					createdAt: updatedProfile.createdAt,
					updatedAt: updatedProfile.updatedAt,
				})
				.onConflictDoUpdate({
					target: profiles.profileId,
					set: {
						sessionId: updatedProfile.sessionId,
						userId: updatedProfile.userId,
						showName: updatedProfile.showName,
						data: updatedProfile,
						updatedAt: updatedProfile.updatedAt,
					},
				});
			return { profileId: updatedProfile.profileId };
		} catch (error) {
			handleServiceError(error, `Failed to store profile '${updatedProfile.profileId}'`);
		}
	},

	clearCollectionCache: (): void => {},
};

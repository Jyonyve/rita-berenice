import { Collection, IncludeEnum, Where } from 'chromadb';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import {
	ProfileInfo,
	ProfileMetadata,
	ProfileCdo,
} from '#shared/domain/profile/ProfileInterfaces.js';
import { ChromaResponse, ProfileResponse } from '#shared/api/ModuleResponse.js';
import { handleServiceError, validateChromaResponse } from '../util/serviceHelpers.js';
import { buildProfileId } from '../../shared/util/buildIdUtils.js';
import { flatProfileToDoc, inflateProfileDoc } from '../util/documentUtils.js';
import { metadataToProfile } from '#shared/util/dbConvertUtils.js';
import { createBasicProfileInfo, isProfileInfo } from '#shared/util/typeGuardUtils.js';

const { getProfileCollection, upsertRecord, getRecordById, getRecords } = chromaDbClient;
const collectionType = COLLECTIONS.PROFILE;

export const profileStore = {
	// Cache for profile collection
	_profileCollection: null as Collection | null,

	// Get collection with caching
	_getCollection: async (): Promise<Collection> => {
		// First check if it's in the cache (non-async operation)
		if (profileStore._profileCollection) {
			return profileStore._profileCollection;
		}

		// If not in cache, fetch it (async operation)
		const collection = await getProfileCollection();
		profileStore._profileCollection = collection;
		return collection;
	},

	_constructProfile: (results: ChromaResponse): ProfileResponse => {
		const { ids, documents, metadatas } = results;
		const profileInfos = ids.map((id, index) => {
			const metadata = metadatas[index] as unknown as ProfileMetadata;
			const document = documents[index];
			const inflatedDoc = inflateProfileDoc(document!);
			const profileInfo = metadataToProfile(metadata!, inflatedDoc.description);
			return profileInfo;
		});
		return { ids, documents, metadatas, profileInfos, profileInfo: profileInfos[0] || null };
	},

	// Profile Operations
	getAllProfilesByUserId: async (userId: string): Promise<ProfileResponse> => {
		const collection = await profileStore._getCollection();
		try {
			const where: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.PROFILE } }, { userId: { $eq: userId } }],
			};

			const rawResults = await collection.get({
				include: [IncludeEnum.documents, IncludeEnum.metadatas],
				where,
			});

			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			return profileStore._constructProfile(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getAllProfilesByUserId].',
				'Failed to get all profiles:'
			);
		}
	},

	getProfile: async (profileId: string): Promise<ProfileResponse> => {
		const collection = await profileStore._getCollection();
		try {
			const rawResult = await getRecordById(collection, profileId);
			const results = validateChromaResponse(rawResult, 'getOne', collectionType);
			return profileStore._constructProfile(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getProfile].',
				`Failed to get profile with ID ${profileId}:`
			);
		}
	},

	getProfileBySessionId: async (sessionId: string): Promise<ProfileResponse> => {
		const collection = await profileStore._getCollection();

		try {
			const where: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.PROFILE } }, { sessionId: { $eq: sessionId } }],
			};

			const rawResults = await getRecords(collection, where, undefined, 1);
			const results = validateChromaResponse(rawResults, 'getOne', collectionType);
			return profileStore._constructProfile(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getProfileBySessionId].',
				`Failed to get profile with sessionId ${sessionId}:`
			);
		}
	},

	getProfilesByShowName: async (showName: string): Promise<ProfileResponse> => {
		const collection = await profileStore._getCollection();
		const where: Where = {
			$and: [
				{ type: { $eq: METADATA_TYPES.PROFILE } },
				{ showName: { $like: `%${showName}%` } as any }, //NOTE: TS issue
			],
		};
		try {
			const rawResults = await getRecords(collection, where);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			return profileStore._constructProfile(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getProfilesByShowName].',
				`Failed to get profiles by showName '${showName}'`
			);
		}
	},

	// In profileService
	storeProfile: async (profile: ProfileCdo | ProfileInfo): Promise<string> => {
		const collection = await profileStore._getCollection();
		const now = new Date().toISOString();
		const updatedProfile: ProfileInfo = isProfileInfo(profile)
			? profile
			: createBasicProfileInfo(profile);

		const updatedMetadata: ProfileMetadata = {
			...updatedProfile,
			profileId:
				updatedProfile.profileId || buildProfileId(updatedProfile.sessionId, updatedProfile.userId),
			createdAt: updatedProfile.createdAt || now,
			updatedAt: now,
		};

		const documentForEmbedding = flatProfileToDoc(updatedProfile);

		try {
			await upsertRecord(collection, updatedMetadata.profileId, documentForEmbedding, updatedMetadata);
			return JSON.stringify({ profileId: updatedMetadata.profileId });
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [storeProfile].',
				`Failed to store profile: ${updatedMetadata.profileId}`
			);
		}
	},

	// Method to clear the cache
	clearCollectionCache: (): void => {
		profileStore._profileCollection = null;
	},
};

import {
	COLLECTIONS,
	METADATA_TYPES,
	ProfileInfo,
	ProfileMetadata,
} from '#root/src/shared/index.ts';
import { Collection, IncludeEnum, Document, Where } from 'chromadb';
import { chromaDbClient } from '../db/chromaDbClient.ts';
import { ProfileResponse } from '#shared/api/index.ts';

import {
	validateChromaResponse,
	buildProfileId,
	flatProfileToDoc,
	handleServiceError,
} from '../util/index.ts';

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

	_parseDocToBasicProfileInfo: (documents: (Document | null)[]) => {
		return documents
			.map((doc, index) => {
				if (doc === null) return null;
				try {
					return JSON.parse(doc);
				} catch (e) {
					console.error(`Error parsing character info: ${index}`, e);
					return null;
				}
			})
			.filter((char): char is ProfileInfo => char !== null);
	},

	// Profile Operations
	getAllProfiles: async (): Promise<ProfileResponse> => {
		const collection = await profileStore._getCollection();
		try {
			const rawResults = await collection.get({
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
				where: { type: METADATA_TYPES.PROFILE },
			});

			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			const { ids, documents, metadatas } = results;
			const parsedInfos = profileStore._parseDocToBasicProfileInfo(rawResults.documents);
			return { ids, documents, metadatas, profileInfos: parsedInfos, profileInfo: parsedInfos[0] };
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getAllProfiles].',
				'Failed to get all profiles:'
			);
		}
	},

	getProfile: async (profileId: string): Promise<ProfileResponse> => {
		const collection = await profileStore._getCollection();
		try {
			const rawResult = await getRecordById(collection, profileId);
			const results = validateChromaResponse(rawResult, 'getOne', collectionType);
			const { ids, documents, metadatas } = results;
			const parsedInfos = profileStore._parseDocToBasicProfileInfo(results.documents);
			return { ids, documents, metadatas, profileInfo: parsedInfos[0], profileInfos: parsedInfos };
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
			const rawResults = await collection.get({
				where: { sessionId },
				include: [IncludeEnum.Metadatas],
				limit: 1,
			});
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			const { ids, documents, metadatas } = results;
			const parsedBasicInfos = profileStore._parseDocToBasicProfileInfo(documents);
			return {
				ids,
				documents,
				metadatas,
				profileInfos: parsedBasicInfos,
				profileInfo: parsedBasicInfos[0],
			};
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
			$and: [{ type: { $eq: METADATA_TYPES.PROFILE } }, { showName: { $in: showName } }],
		};
		try {
			const rawResults = await getRecords(collection, where);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			const { ids, documents, metadatas } = results;
			const parsedBasicInfos = profileStore._parseDocToBasicProfileInfo(documents);
			return {
				ids,
				documents,
				metadatas,
				profileInfos: parsedBasicInfos,
				profileInfo: parsedBasicInfos[0],
			};
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getProfilesByShowName].',
				`Failed to get profiles by showName '${showName}'`
			);
		}
	},

	// In profileService
	storeProfile: async (profileInfo: ProfileMetadata): Promise<string> => {
		const collection = await profileStore._getCollection();
		const now = new Date().toISOString();

		const profile: ProfileMetadata = {
			...profileInfo,
			profileId: profileInfo.profileId || buildProfileId(profileInfo.name, profileInfo.sessionId),
			createdAt: profileInfo.createdAt || now,
			updatedAt: now,
		};

		const documentForEmbedding = flatProfileToDoc(profile);

		try {
			await upsertRecord(collection, profile.profileId, documentForEmbedding, profile);
			return JSON.stringify({
				message: 'profile stored successfully.',
				characterId: profile.profileId,
				updatedAt: profile.updatedAt, // Reflect the timestamp set
			});
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [storeProfile].',
				`Failed to store profile: ${profileInfo.profileId}`
			);
		}
	},

	// Method to clear the cache
	clearCollectionCache: (): void => {
		profileStore._profileCollection = null;
	},
};

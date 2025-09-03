import { Collection, IncludeEnum, Where } from 'chromadb';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { UserInfo, UserMetadata } from '#shared/domain/user/UserInterfaces.js';
import { ChromaResponse, UserResponse } from '#shared/api/ModuleResponse.js';
import { handleServiceError, validateChromaResponse } from '../util/serviceHelpers.js';
import { metadataToUser } from '#shared/util/dbConvertUtils.js';

const { getUserCollection, upsertRecord, getRecordById, getRecords } = chromaDbClient;
const collectionType = COLLECTIONS.USER;

export const userStore = {
	// Cache for user collection
	_userCollection: null as Collection | null,

	// Get collection with caching
	_getCollection: async (): Promise<Collection> => {
		if (userStore._userCollection) {
			return userStore._userCollection;
		}
		const collection = await getUserCollection();
		userStore._userCollection = collection;
		return collection;
	},

	_constructUser: (results: ChromaResponse): UserResponse => {
		const { ids, documents, metadatas } = results;
		const userInfos = ids.map((id, index) => {
			const metadata = metadatas[index] as unknown as UserMetadata;
			// User data is entirely in metadata - no document parsing needed
			const userInfo = metadataToUser(metadata);
			return userInfo;
		});
		return { ids, documents, metadatas, userInfos, userInfo: userInfos[0] || null };
	},

	// User Operations
	getAllUsers: async (): Promise<UserResponse> => {
		const collection = await userStore._getCollection();
		try {
			const rawResults = await collection.get({
				include: [IncludeEnum.metadatas], // Only need metadatas for users
				where: { type: METADATA_TYPES.USER },
			});
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			return userStore._constructUser(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getAllUsers].',
				'Failed to get all users'
			);
		}
	},

	getUser: async (userId: string): Promise<UserResponse> => {
		const collection = await userStore._getCollection();
		try {
			const rawResult = await getRecordById(collection, userId);
			const results = validateChromaResponse(rawResult, 'getOne', collectionType);
			return userStore._constructUser(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getUser].',
				`Failed to get user with ID ${userId}`
			);
		}
	},

	getUserByShowName: async (showName: string): Promise<UserResponse> => {
		const collection = await userStore._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.USER } }, { showName: { $eq: showName } }],
		};
		try {
			const rawResults = await getRecords(collection, where, undefined, 1);
			const results = validateChromaResponse(rawResults, 'getOne', collectionType);
			return userStore._constructUser(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getUserByShowName].',
				`Failed to get user with showName ${showName}`
			);
		}
	},

	getUserByEmail: async (email: string): Promise<UserResponse> => {
		const collection = await userStore._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.USER } }, { email: { $eq: email } }],
		};
		try {
			const rawResults = await getRecords(collection, where, undefined, 1);
			const results = validateChromaResponse(rawResults, 'getOne', collectionType);
			return userStore._constructUser(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getUserByEmail].',
				`Failed to get user with email ${email}`
			);
		}
	},

	checkShowNameExists: async (showName: string): Promise<boolean> => {
		const collection = await userStore._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.USER } }, { showName: { $eq: showName } }],
		};

		try {
			// Use limit 1 for maximum efficiency - we only care if ANY exists
			const rawResults = await getRecords(collection, where, undefined, 1);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);

			// Return true if any user found with this showName
			return results.ids.length > 0;
		} catch (error) {
			// If error occurs, assume showName doesn't exist (conservative approach)
			console.error('Error checking showName existence:', error);
			return false;
		}
	},

	// Store or update a user - no document needed!
	storeUser: async (user: UserInfo): Promise<void> => {
		const collection = await userStore._getCollection();
		const now = new Date().toISOString();

		const updatedMetadata: UserMetadata = {
			...user,
			createdAt: user.createdAt || now,
			updatedAt: now,
		};

		try {
			// Empty string for document since we only use metadata
			await upsertRecord(collection, updatedMetadata.userId, '', updatedMetadata);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [storeUser].',
				`Failed to store user: ${updatedMetadata.userId}`
			);
		}
	},

	// Method to clear the cache
	clearCollectionCache: (): void => {
		userStore._userCollection = null;
	},
};

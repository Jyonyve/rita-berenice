import { Collection, IncludeEnum, Where } from 'chromadb';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { UserCdo, UserInfo, UserMetadata } from '#shared/domain/user/UserInterfaces.js';
import { ChromaResponse, UserResponse } from '#shared/api/ModuleResponse.js';
import { handleServiceError, validateChromaResponse } from '../util/serviceHelpers.js';
import { metadataToUser } from '#shared/util/dbConvertUtils.js';
import { createBasicUserInfo, isUserInfo } from '#shared/util/typeGuardUtils.js';
import { flatUserToDoc } from '../util/documentUtils.js';

const { getUserCollection, upsertRecord, getRecordById, getRecords, countOption } = chromaDbClient;
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
			// Use your efficient count method - perfect for existence checks!
			const count = await countOption(collection, where);
			return count > 0;
		} catch (error) {
			console.error('Error checking showName existence:', error);
			return false; // Conservative approach
		}
	},

	// Store or update a user - no document needed!
	storeUser: async (user: UserCdo | UserInfo): Promise<{ userId: string }> => {
		const collection = await userStore._getCollection();
		console.log('✅ [userStore.storeUser] Got collection:', collection?.name);
		const now = new Date().toISOString();
		const updatedUser: UserInfo = isUserInfo(user)
			? { ...user, updatedAt: now }
			: createBasicUserInfo(user);
		try {
			const documentForEmbedding = flatUserToDoc(updatedUser);
			await upsertRecord(collection, updatedUser.userId, documentForEmbedding, updatedUser);
			return { userId: updatedUser.userId };
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [storeUser].',
				`Failed to store user: ${updatedUser.userId}`
			);
		}
	},

	// Method to clear the cache
	clearCollectionCache: (): void => {
		userStore._userCollection = null;
	},
};

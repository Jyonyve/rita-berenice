import { Collection, IncludeEnum, Where } from 'chromadb';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { UserInfo, UserMetadata } from '#shared/domain/user/UserInterfaces.js';
import { ChromaResponse, UserResponse } from '#shared/api/ModuleResponse.js';
import { handleServiceError, validateChromaResponse } from '../util/serviceHelpers.js';
import { flatUserToDoc, inflateUserDoc } from '../../shared/util/documentUtils.ts';
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
			// const metadata = metadatas[index] as unknown as UserMetadata;
			const document = documents[index];
			const inflatedDoc = inflateUserDoc(document!);
			// const userInfo = metadataToUser(metadata!, inflatedDoc.sessionIds);
			const userInfo = inflatedDoc.userInfo;
			return userInfo;
		});
		return { ids, documents, metadatas, userInfos, userInfo: userInfos[0] || null };
	},

	// User Operations
	getAllUsers: async (): Promise<UserResponse> => {
		const collection = await userStore._getCollection();
		try {
			const rawResults = await collection.get({
				include: [IncludeEnum.documents, IncludeEnum.metadatas],
				where: { type: METADATA_TYPES.USER },
			});
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			return userStore._constructUser(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getAllUsers].',
				'Failed to get all users:'
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
				`Failed to get user with ID ${userId}:`
			);
		}
	},

	getUserByContact: async (contact: string): Promise<UserResponse> => {
		const collection = await userStore._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.USER } }, { contact: { $eq: contact } }],
		};
		try {
			const rawResults = await getRecords(collection, where, 1);
			const results = validateChromaResponse(rawResults, 'getOne', collectionType);
			return userStore._constructUser(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getUserByContact].',
				`Failed to get user with contact ${contact}:`
			);
		}
	},

	getUserByEmail: async (email: string): Promise<UserResponse> => {
		const collection = await userStore._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.USER } }, { email: { $eq: email } }],
		};
		try {
			const rawResults = await getRecords(collection, where, 1);
			const results = validateChromaResponse(rawResults, 'getOne', collectionType);
			return userStore._constructUser(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getUserByEmail].',
				`Failed to get user with email ${email}:`
			);
		}
	},

	// Store or update a user
	storeUser: async (user: UserInfo): Promise<void> => {
		const collection = await userStore._getCollection();
		const now = new Date().toISOString();

		const updatedMetadata: UserMetadata = {
			...user,
			createdAt: user.createdAt || now,
			updatedAt: now,
		};
		const documentForEmbedding = flatUserToDoc(user);
		try {
			await upsertRecord(collection, updatedMetadata.userId, documentForEmbedding, updatedMetadata);
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

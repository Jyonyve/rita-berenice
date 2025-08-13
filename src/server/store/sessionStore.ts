// server/services/sessionStore.ts

import { Collection, Where } from 'chromadb';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { SessionInfo, SessionMetadata } from '#shared/domain/session/SessionInterfaces.js';
import { ChromaResponse, SessionResponse } from '#shared/api/ModuleResponse.js';
import { handleServiceError, validateChromaResponse } from '../util/serviceHelpers.js';
import { buildSessionId } from '../../shared/util/buildIdUtils.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { flatSessionToDoc, inflateSessionDoc } from '../util/documentUtils.js';
import { metadataToSession } from '#shared/util/dbConvertUtils.js';

// Destructure chromaDbClient methods
const { getSessionCollection, addRecord, updateRecord, getRecordById, getRecords } = chromaDbClient; // Assume getSessionCollection is added to chromaDbClient
const collectionType = COLLECTIONS.SESSION;

export const sessionStore = {
	// --- Caching and Collection Getter (following your existing pattern) ---
	_sessionCollection: null as Collection | null,

	async _getCollection(): Promise<Collection> {
		if (sessionStore._sessionCollection) return sessionStore._sessionCollection;
		const collection = await getSessionCollection(); // Create this in chromaDbClient
		sessionStore._sessionCollection = collection;
		return collection;
	},

	_constructSession: (results: ChromaResponse): SessionResponse => {
		const { ids, documents, metadatas } = results;
		const sessionInfos = ids.map((id, index) => {
			const metadata = metadatas[index] as unknown as SessionMetadata;
			const document = documents[index];
			const inflatedDoc = inflateSessionDoc(document!);
			const sessionInfo = metadataToSession(metadata!, inflatedDoc.lastCharMessage);
			return sessionInfo;
		});
		return {
			ids,
			documents,
			metadatas,
			sessionInfos: sessionInfos,
			sessionInfo: sessionInfos[0] || null,
		};
	},

	// --- Core CRUD Operations ---

	/**
	 * Creates a new session record. This should be the first step when a user starts a new chat.
	 */
	async createSession(
		userId: string,
		characterId: string,
		profileId: string,
		firstCharMessage: string
	): Promise<SessionInfo> {
		const collection = await sessionStore._getCollection();
		const now = new Date().toISOString();
		const newSessionId = buildSessionId(characterId);

		const metadata: SessionMetadata = {
			sessionId: newSessionId,
			userId,
			characterId,
			profileId,
			title: 'New Conversation', // Default title
			createdAt: now,
			updatedAt: now,
			messageCount: 1, // Starts with the first message
			status: 'active',
			type: METADATA_TYPES.SESSION,
		};

		const sessionInfo: SessionInfo = { ...metadata, lastCharMessage: firstCharMessage };

		// We store the session metadata directly. The document can be a simple string for embedding.
		const documentForEmbedding = flatSessionToDoc(sessionInfo);

		try {
			await addRecord(collection, metadata.sessionId, documentForEmbedding, metadata);
			return sessionInfo;
		} catch (error: any) {
			handleServiceError(
				error,
				'An internal error occurred while creating a session.',
				`Failed to create session ${metadata.sessionId} for user ${userId}`
			);
		}
	},

	/**
	 * Retrieves all sessions for a given user, sorted by last activity.
	 */
	async getSessionsByUserId(userId: string): Promise<SessionResponse> {
		const collection = await sessionStore._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.SESSION } }, { userId: { $eq: userId } }],
		};
		try {
			const rawResults = await getRecords(collection, where);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);

			// Assuming a constructSession method similar to your other stores
			const sessionRes = sessionStore._constructSession(results);
			sessionRes.sessionInfos.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
			return sessionRes;
		} catch (error: any) {
			handleServiceError(
				error,
				'An internal error occurred while fetching user sessions.',
				`Failed to get sessions for user ${userId}`
			);
		}
	},

	async getSessionsByUserIdAndCharacterId(
		userId: string,
		characterId: string
	): Promise<SessionResponse> {
		const collection = await sessionStore._getCollection();
		const where: Where = {
			$and: [
				{ type: { $eq: METADATA_TYPES.SESSION } },
				{ userId: { $eq: userId } },
				{ characterId: { $eq: characterId } },
			],
		};
		try {
			const rawResults = await getRecords(collection, where);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);

			// Assuming a constructSession method similar to your other stores
			const sessionRes = sessionStore._constructSession(results);
			sessionRes.sessionInfos.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
			return sessionRes;
		} catch (error: any) {
			handleServiceError(
				error,
				'An internal error occurred while fetching user sessions.',
				`Failed to get sessions for user ${userId}`
			);
		}
	},

	getSession: async (sessionId: string): Promise<SessionResponse> => {
		const collection = await sessionStore._getCollection();
		try {
			const rawResult = await getRecordById(collection, sessionId);
			const results = validateChromaResponse(rawResult, 'getOne', collectionType);
			return sessionStore._constructSession(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getSession].',
				`Failed to get user with ID ${sessionId}:`
			);
		}
	},

	/**
	 * Updates a session's metadata, typically after a new message is added.
	 */
	async updateSessionOnNewMessage(sessionId: string, latestCharMessage: string): Promise<void> {
		const collection = await sessionStore._getCollection();
		const now = new Date().toISOString();
		try {
			const sessionInfo = (await sessionStore.getSession(sessionId)).sessionInfo;
			const { lastCharMessage, ...sessionMetadata } = sessionInfo;

			const updatedMetadata: SessionMetadata = {
				...sessionMetadata,
				updatedAt: now,
				messageCount: sessionMetadata.messageCount + 1,
			};

			const documentForEmbedding = flatSessionToDoc({
				...updatedMetadata,
				lastCharMessage: latestCharMessage,
			});
			await updateRecord(collection, updatedMetadata.sessionId, documentForEmbedding, updatedMetadata);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getSession].',
				`Failed to get user with ID ${sessionId}:`
			);
		}
	},
};

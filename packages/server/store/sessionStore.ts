// server/services/sessionStore.ts

import { Collection, Where } from 'chromadb';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { COLLECTIONS, toChromaMetadata } from '../db/chroma.type.js';
import { ChromaResponse, SessionResponse } from '@rita-berenice/shared/api';
import { SessionMetadata, SessionInfo } from '@rita-berenice/shared/domain';
import { metadataToSession, buildSessionId } from '@rita-berenice/shared/util';
import { parseEntriesToConversation } from '../util/chatParseUtils.js';
import { inflateSessionDoc, flatSessionToDoc } from '../util/documentUtils.js';
import { handleServiceError, validateChromaResponse } from '../util/serviceHelpers.js';
import { METADATA_TYPES } from '@rita-berenice/shared/config';

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
			const sessionInfo = metadataToSession(
				metadata!,
				inflatedDoc.lastCharMessage,
				inflatedDoc.userNote
			);
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
		firstCharMessage: string,
		title: string
	): Promise<{ sessionId: string }> {
		const collection = await sessionStore._getCollection();
		const now = new Date().toISOString();
		const newSessionId = buildSessionId(characterId);

		const metadata: SessionMetadata = {
			sessionId: newSessionId,
			userId,
			characterId,
			profileId: '',
			title: title || 'New Conversation', // Default title
			createdAt: now,
			updatedAt: now,
			messageCount: 1, // Starts with the first message
			status: 'active',
			type: METADATA_TYPES.SESSION,
		};

		const sessionInfo: SessionInfo = { ...metadata, lastCharMessage: firstCharMessage, userNote: '' };

		// We store the session metadata directly. The document can be a simple string for embedding.
		const documentForEmbedding = flatSessionToDoc(sessionInfo);

		try {
			const chromaMetadata = toChromaMetadata(metadata);
			await addRecord(collection, metadata.sessionId, documentForEmbedding, chromaMetadata);
			return { sessionId: metadata.sessionId };
		} catch (error: any) {
			handleServiceError(
				error,
				'An internal error occurred while creating a session.',
				`Failed to create session ${metadata.sessionId} for user ${userId}`
			);
		}
	},

	/**
	 * Updates a session's metadata
	 * !IMPORTANT! No update MessageCount (use another method)
	 */
	async updateSession(sessionInfo: SessionInfo): Promise<void> {
		const collection = await sessionStore._getCollection();
		const now = new Date().toISOString();
		try {
			const { lastCharMessage, userNote, ...sessionMetadata } = sessionInfo;

			const updatedMetadata: SessionMetadata = { ...sessionMetadata, updatedAt: now };

			const newMessage = parseEntriesToConversation(JSON.parse(lastCharMessage));
			const documentForEmbedding = flatSessionToDoc({
				...updatedMetadata,
				lastCharMessage: newMessage,
				userNote,
			});
			const chromaMetadata = toChromaMetadata(updatedMetadata);
			await updateRecord(collection, updatedMetadata.sessionId, documentForEmbedding, chromaMetadata);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [updateSession].',
				`Failed to update sessionInfo with ID ${sessionInfo.sessionId}:`
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
			const { lastCharMessage, userNote, ...sessionMetadata } = sessionInfo;

			const updatedMetadata: SessionMetadata = {
				...sessionMetadata,
				updatedAt: now,
				messageCount: sessionMetadata.messageCount + 1,
			};
			const { latestCharMessage: entries } = JSON.parse(latestCharMessage);
			const lastConversation = parseEntriesToConversation(entries);
			const documentForEmbedding = flatSessionToDoc({
				...updatedMetadata,
				lastCharMessage: lastConversation,
				userNote,
			});
			const chromaMetadata = toChromaMetadata(updatedMetadata);
			await updateRecord(collection, updatedMetadata.sessionId, documentForEmbedding, chromaMetadata);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [updateSessionOnNewMessage].',
				`Failed to update sessionInfo Message with ID ${sessionId}:`
			);
		}
	},

	/**
	 * Updates a session's metadata, typically after a new message is added.
	 */
	async updateSessionTitle(sessionId: string, title: string): Promise<void> {
		const collection = await sessionStore._getCollection();
		const now = new Date().toISOString();
		try {
			const sessionInfo = (await sessionStore.getSession(sessionId)).sessionInfo;
			const newSessionInfo: SessionInfo = { ...sessionInfo, title, updatedAt: now };
			const documentForEmbedding = flatSessionToDoc(newSessionInfo);
			const { lastCharMessage, userNote, ...updatedMetadata } = newSessionInfo;
			await updateRecord(collection, updatedMetadata.sessionId, documentForEmbedding, updatedMetadata);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [updateSessionOnNewMessage].',
				`Failed to update sessionInfo Message with ID ${sessionId}:`
			);
		}
	},

	/**
	 * Updates a session's metadata, typically after a new message is added.
	 */
	async updateSessionUserNote(sessionId: string, newUserNote: string): Promise<void> {
		const collection = await sessionStore._getCollection();
		const now = new Date().toISOString();
		try {
			const sessionInfo = (await sessionStore.getSession(sessionId)).sessionInfo;
			const newSessionInfo: SessionInfo = { ...sessionInfo, updatedAt: now, userNote: newUserNote };
			const documentForEmbedding = flatSessionToDoc(newSessionInfo);
			const { lastCharMessage, userNote, ...updatedMetadata } = newSessionInfo;
			await updateRecord(collection, updatedMetadata.sessionId, documentForEmbedding, updatedMetadata);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [updateSessionOnNewMessage].',
				`Failed to update sessionInfo Message with ID ${sessionId}:`
			);
		}
	},

	/**
	 * Updates a session's metadata, typically after a new message is added.
	 */
	async initSessionProfileId(sessionId: string, profileId: string): Promise<void> {
		const collection = await sessionStore._getCollection();
		const now = new Date().toISOString();
		try {
			const sessionInfo = (await sessionStore.getSession(sessionId)).sessionInfo;
			const newSessionInfo: SessionInfo = { ...sessionInfo, profileId, updatedAt: now };
			const documentForEmbedding = flatSessionToDoc(newSessionInfo);
			const { lastCharMessage, ...updatedMetadata } = newSessionInfo;
			await updateRecord(collection, updatedMetadata.sessionId, documentForEmbedding, updatedMetadata);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [initSessionProfileId].',
				`Failed to update sessionInfo Message with ID ${sessionId}:`
			);
		}
	},
};

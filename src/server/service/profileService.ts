import { METADATA_TYPES, ProfileInfo } from '#root/src/shared/index.ts';
import { Collection, IncludeEnum } from 'chromadb';
import { chromaDbClient } from '#server/db/chromaDbClient.ts';

const { getProfileCollection, addDocument, upsertDocument, getDocumentById, queryDocuments } =
	chromaDbClient;

export const profileService = {
	// Cache for profile collection
	_profileCollection: null as Collection | null,

	// Get collection with caching
	_getCollection: async (): Promise<Collection> => {
		// First check if it's in the cache (non-async operation)
		if (profileService._profileCollection) {
			return profileService._profileCollection;
		}

		// If not in cache, fetch it (async operation)
		const collection = await getProfileCollection();
		profileService._profileCollection = collection;
		return collection;
	},

	// Profile Operations
	getAllProfiles: async (): Promise<ProfileInfo[]> => {
		const collection = await profileService._getCollection();
		try {
			const results = await collection.get({
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
				where: { type: METADATA_TYPES.PROFILE },
			});

			if (!results.documents || results.documents.length === 0) {
				return [];
			}

			return results.documents
				.map((doc, index) => {
					if (doc === null) return null;
					try {
						return JSON.parse(doc) as ProfileInfo;
					} catch (e) {
						console.error('Error parsing profile info:', e);
						return null;
					}
				})
				.filter((profile): profile is ProfileInfo => profile !== null);
		} catch (error) {
			console.error('Failed to get all profiles:', error);
			return [];
		}
	},

	getProfileById: async (id: string): Promise<ProfileInfo | null> => {
		const collection = await profileService._getCollection();

		try {
			const result = await getDocumentById(collection, id);
			if (!result) return null;

			return JSON.parse(result) as ProfileInfo;
		} catch (error) {
			console.error(`Failed to get profile with ID ${id}:`, error);
			return null;
		}
	},

	getProfilesBySessionId: async (sessionId: string): Promise<ProfileInfo[]> => {
		const collection = await profileService._getCollection();

		try {
			const results = await collection.get({ where: { sessionId }, include: [IncludeEnum.Documents] });

			if (!results.documents || results.documents.length === 0) {
				return [];
			}

			return results.documents
				.map((doc) => {
					if (doc === null) return null;
					try {
						return JSON.parse(doc) as ProfileInfo;
					} catch (e) {
						console.error('Error parsing profile:', e);
						return null;
					}
				})
				.filter((profile): profile is ProfileInfo => profile !== null);
		} catch (error) {
			console.error(`Failed to get profiles for session ${sessionId}:`, error);
			return [];
		}
	},

	// In profileService
	storeProfile: async (profile: ProfileInfo): Promise<void> => {
		const collection = await profileService._getCollection();

		try {
			await upsertDocument(collection, profile.id, JSON.stringify(profile), {
				...profile.metadata,
				type: METADATA_TYPES.PROFILE, // Make sure this is added
			});
		} catch (error) {
			console.error('Failed to store profile:', error);
			throw error;
		}
	},

	queryProfiles: async (queryText: string, limit: number = 10): Promise<ProfileInfo[]> => {
		const collection = await profileService._getCollection();

		try {
			const results = await queryDocuments(
				collection,
				queryText,
				{ type: METADATA_TYPES.PROFILE },
				limit
			);

			return results
				.map((doc) => {
					try {
						return JSON.parse(doc) as ProfileInfo;
					} catch (e) {
						console.error('Error parsing profile from query:', e);
						return null;
					}
				})
				.filter((profile): profile is ProfileInfo => profile !== null);
		} catch (error) {
			console.error('Failed to query profiles:', error);
			return [];
		}
	},

	// Method to clear the cache
	clearCollectionCache: (): void => {
		profileService._profileCollection = null;
	},
};

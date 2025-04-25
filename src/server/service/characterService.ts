import { CharacterInfo, METADATA_TYPES } from '#root/src/shared/domain/index.ts';
import { Collection, IncludeEnum } from 'chromadb';
import { chromaDbClient } from '#server/db/index.ts';

const { getCharacterCollection, upsertDocument, getDocumentById, queryDocuments } = chromaDbClient;

export const characterService = {
	// Cache for character collection
	_characterCollection: null as Collection | null,

	// Get collection with caching
	_getCollection: async (): Promise<Collection> => {
		// First check if it's in the cache (non-async operation)
		if (characterService._characterCollection) {
			return characterService._characterCollection;
		}

		// If not in cache, fetch it (async operation)
		const collection = await getCharacterCollection();
		characterService._characterCollection = collection;
		return collection;
	},

	// Character Operations
	getAllCharacters: async (): Promise<CharacterInfo[]> => {
		const collection = await characterService._getCollection();

		try {
			const results = await collection.get({
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
				where: { type: METADATA_TYPES. },
			});

			if (!results.documents || results.documents.length === 0) {
				return [];
			}

			return results.documents
				.map((doc, index) => {
					if (doc === null) return null;
					try {
						return JSON.parse(doc) as CharacterInfo;
					} catch (e) {
						console.error('Error parsing character info:', e);
						return null;
					}
				})
				.filter((char): char is CharacterInfo => char !== null);
		} catch (error) {
			console.error('Failed to get all characters:', error);
			return [];
		}
	},
	getCharacterById: async (id: string): Promise<CharacterInfo | null> => {
		const collection = await characterService._getCollection();

		try {
			const result = await getDocumentById(collection, id);
			if (!result) return null;

			return JSON.parse(result) as CharacterInfo;
		} catch (error) {
			console.error(`Failed to get character with ID ${id}:`, error);
			return null;
		}
	},

	// In characterService
	storeCharacter: async (character: CharacterInfo): Promise<void> => {
		const collection = await characterService._getCollection();

		try {
			await upsertDocument(collection, character.id, JSON.stringify(character), {
				...character.metadata,
				type: 'character', // This already adds the type
			});
		} catch (error) {
			console.error('Failed to store character:', error);
			throw error;
		}
	},

	queryCharacters: async (queryText: string, limit: number = 10): Promise<CharacterInfo[]> => {
		const collection = await characterService._getCollection();

		try {
			const results = await queryDocuments(collection, queryText, { type: 'character' }, limit);

			return results
				.map((doc) => {
					try {
						return JSON.parse(doc) as CharacterInfo;
					} catch (e) {
						console.error('Error parsing character from query:', e);
						return null;
					}
				})
				.filter((char): char is CharacterInfo => char !== null);
		} catch (error) {
			console.error('Failed to query characters:', error);
			return [];
		}
	},

	// Method to clear the cache
	clearCollectionCache: (): void => {
		characterService._characterCollection = null;
	},
};

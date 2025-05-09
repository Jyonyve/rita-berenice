import { CharacterInfo, METADATA_TYPES } from '#root/src/shared/domain/index.ts';
import { Collection, IncludeEnum, Document, Where } from 'chromadb';
import { chromaDbClient, ChromaResponse, validateResponse } from '../db/index.ts';
import { buildCharacterDocument } from '../util/documentUtils.ts';

const { getCharacterCollection, upsertRecord, getRecordById, deleteRecordById, queryRecords } =
	chromaDbClient;

interface BasicCharacterInfo {
	characterId: string;
	showName: string;
	description: string;
	instruction: string;
	updatedAt: string;
}

interface CharacterChromaResponse extends ChromaResponse {
	basicCharInfo?: BasicCharacterInfo;
	basicCharInfos: BasicCharacterInfo[];
}

export const characterService = {
	// Cache for character collection
	_characterCollection: null as Collection | null,

	_validation: (characterId: string) => {
		if (!characterId) throw new Error('Character ID is required.');
	},

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

	_parseDocToBasicCharInfo: (documents: (Document | null)[]) => {
		return documents
			.map((doc, index) => {
				if (doc === null) return null;
				try {
					return JSON.parse(doc);
				} catch (e) {
					console.error('Error parsing character info:', e);
					return null;
				}
			})
			.filter((char): char is BasicCharacterInfo => char !== null);
	},

	// Character Operations
	getAllCharacters: async (): Promise<CharacterChromaResponse | null> => {
		const collection = await characterService._getCollection();

		try {
			const results = await collection.get({
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
				where: { type: METADATA_TYPES.CHARACTER },
			});

			if (validateResponse(results)) {
				const { ids, documents, metadatas } = results;
				const parsedInfos = characterService._parseDocToBasicCharInfo(results.documents);
				parsedInfos.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
				return { ids, documents, metadatas, basicCharInfos: parsedInfos.reverse() };
			} else {
				console.warn(`no characters are fetched.`);
				return null;
			}
		} catch (error) {
			console.error('Failed to get all characters:', error);
			return null;
		}
	},

	getCharacter: async (characterId: string): Promise<CharacterChromaResponse | null> => {
		const collection = await characterService._getCollection();
		characterService._validation(characterId);
		try {
			const result = await getRecordById(collection, characterId);
			if (validateResponse(result)) {
				const { ids, documents, metadatas } = result;
				const parsedInfos = characterService._parseDocToBasicCharInfo(result.documents);
				return {
					ids,
					documents,
					metadatas,
					basicCharInfo: parsedInfos[0],
					basicCharInfos: parsedInfos,
				};
			} else {
				console.warn(`no character is fetched by characterId: ${characterId}`);
				return null;
			}
		} catch (error) {
			console.error(`Failed to get character with ID ${characterId}:`, error);
			return null;
		}
	},

	storeCharacter: async (character: CharacterInfo): Promise<void> => {
		const collection = await characterService._getCollection();
		const documentForEmbedding = buildCharacterDocument(character);
		try {
			await upsertRecord(collection, character.characterId, documentForEmbedding, character);
		} catch (error) {
			console.error('Failed to store character:', error);
			throw error;
		}
	},

	getCharactersByShowName: async (
		showName: string,
		limit: number = -1
	): Promise<CharacterChromaResponse> => {
		const collection = await characterService._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.CHARACTER } }, { showName: { $in: showName } }],
		};
		try {
			const results = collection.query({
				where,
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
			});

			return results
				.map((doc) => {
					try {
						return JSON.parse(doc) as BasicCharacterInfo;
					} catch (e) {
						console.error('Error parsing character from query:', e);
						return null;
					}
				})
				.filter((char): char is BasicCharacterInfo => char !== null);
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

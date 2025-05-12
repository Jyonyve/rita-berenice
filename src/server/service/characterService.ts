import { CharacterInfo, COLLECTIONS, METADATA_TYPES } from '#shared/domain/index.ts';
import { Collection, IncludeEnum, Document, Where } from 'chromadb';
import { chromaDbClient } from '../db/index.ts';
import { BasicCharacterInfo, CharacterResponse } from '#shared/api/index.ts';
import {
	buildCharacterId,
	buildCharacterDocument,
	validateChromaResponse,
	handleServiceError,
} from '../util/index.ts';

const { getCharacterCollection, upsertRecord, getRecordById, getRecords } = chromaDbClient;
const collectionType = COLLECTIONS.CHARACTER;

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

	_parseDocToBasicCharacterInfo: (documents: (Document | null)[]) => {
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
			.filter((char): char is BasicCharacterInfo => char !== null);
	},

	// Character Operations
	getAllCharacters: async (): Promise<CharacterResponse> => {
		const collection = await characterService._getCollection();

		try {
			const rawResults = await collection.get({
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
				where: { type: METADATA_TYPES.CHARACTER },
			});
			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			const { ids, documents, metadatas } = results;
			const parsedInfos = characterService._parseDocToBasicCharacterInfo(results.documents);
			parsedInfos.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
			return { ids, documents, metadatas, basicCharacterInfos: parsedInfos.reverse() };
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getAllCharacters].',
				'Failed to get all characters:'
			);
		}
	},

	getCharacter: async (characterId: string): Promise<CharacterResponse> => {
		const collection = await characterService._getCollection();
		try {
			const rawResult = await getRecordById(collection, characterId);
			const results = validateChromaResponse(rawResult, 'getOne', collectionType);

			const { ids, documents, metadatas } = results;
			const parsedInfos = characterService._parseDocToBasicCharacterInfo(results.documents);
			return {
				ids,
				documents,
				metadatas,
				basicCharacterInfo: parsedInfos[0],
				basicCharacterInfos: parsedInfos,
			};
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getCharacter].',
				`Failed to get character with ID ${characterId}`
			);
		}
	},

	getCharactersByShowName: async (
		showName: string,
		limit: number = -1
	): Promise<CharacterResponse> => {
		const collection = await characterService._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.CHARACTER } }, { showName: { $in: showName } }],
		};
		try {
			const rawResults = await getRecords(collection, where, limit);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);

			const { ids, documents, metadatas } = results;
			const parsedBasicInfos = characterService._parseDocToBasicCharacterInfo(documents);
			return { ids, documents, metadatas, basicCharacterInfos: parsedBasicInfos };
		} catch (error: any) {
			handleServiceError(
				error,
				'An internal error occurred while do [getCharactersByShowName].',
				`Failed to get characters by showName '${showName}'`
			);
		}
	},

	storeCharacter: async (characterInput: CharacterInfo): Promise<string> => {
		const collection = await characterService._getCollection();
		const now = new Date().toISOString();

		// Prepare the data to be upserted
		const characterToUpsert: CharacterInfo = {
			...characterInput, // Start with all fields from input
			characterId:
				characterInput.characterId || buildCharacterId(characterInput.name, characterInput.variant), // Ensure ID is set
			updatedAt: now,
			createdAt: characterInput.createdAt || now,
		};

		const documentForEmbedding = buildCharacterDocument(characterToUpsert);

		try {
			// chromaDbClient.upsertRecord is Promise<void> and throws generic Error on underlying failure
			await chromaDbClient.upsertRecord(
				collection,
				characterToUpsert.characterId,
				documentForEmbedding,
				characterToUpsert as any // Cast if CharacterInfo has fields ChromaDB metadata doesn't expect directly
			);

			return JSON.stringify({
				message: 'Character stored successfully.',
				characterId: characterToUpsert.characterId,
				updatedAt: characterToUpsert.updatedAt, // Reflect the timestamp set
			});
		} catch (error: any) {
			// Use your error handling utility or inline handling
			handleServiceError(
				// Assuming you have this utility
				error,
				`Failed to store character '${characterToUpsert.characterId}'`,
				'An internal error occurred while saving the character.'
			);
			// If not using handleServiceError, your inline catch block:
			// if (error instanceof ApiError) throw error;
			// console.error(`Service: Failed to store character '${characterToUpsert.characterId}':`, error);
			// throw new ApiError(500, `DB op error: ${error.message}`, "Failed to store character.");
		}
	},

	// Method to clear the cache
	clearCollectionCache: (): void => {
		characterService._characterCollection = null;
	},
};

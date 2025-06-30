import {
	CharacterInfo,
	CharacterMetadata,
	COLLECTIONS,
	METADATA_TYPES,
} from '#shared/domain/index.js';
import { Collection, IncludeEnum, Document, Where } from 'chromadb';
import { chromaDbClient } from '../db/index.js';
import { CharacterResponse, ChromaResponse } from '#shared/api/index.js';
import {
	buildCharacterId,
	flatCharacterToDoc,
	validateChromaResponse,
	handleServiceError,
	inflateCharacterDoc,
} from '../util/index.js';
import { metadataToCharacter } from '#shared/util/index.js';

const { getCharacterCollection, upsertRecord, getRecordById, getRecords } = chromaDbClient;
const collectionType = COLLECTIONS.CHARACTER;

export const characterStore = {
	// Cache for character collection
	_characterCollection: null as Collection | null,

	// Get collection with caching
	_getCollection: async (): Promise<Collection> => {
		// First check if it's in the cache (non-async operation)
		if (characterStore._characterCollection) {
			return characterStore._characterCollection;
		}

		// If not in cache, fetch it (async operation)
		const collection = await getCharacterCollection();
		characterStore._characterCollection = collection;
		return collection;
	},

	_constuctCharacter: (results: ChromaResponse): CharacterResponse => {
		const { ids, documents, metadatas } = results;
		const characterInfos = ids.map((id, index) => {
			const metadata = metadatas[index] as unknown as CharacterMetadata;
			const document = documents[index];
			const inflatedDoc = inflateCharacterDoc(document!);
			const characterInfo = metadataToCharacter(
				metadata!,
				inflatedDoc.description,
				inflatedDoc.instruction
			);
			return characterInfo;
		});
		return { ids, documents, metadatas, characterInfos, characterInfo: characterInfos[0] || null };
	},

	// Character Operations
	getAllCharacters: async (): Promise<CharacterResponse> => {
		const collection = await characterStore._getCollection();

		try {
			const rawResults = await collection.get({
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
				where: { type: METADATA_TYPES.CHARACTER },
			});

			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			const { ids, documents, metadatas } = results;

			const characterResponse = characterStore._constuctCharacter(results);

			// Sort descending: newer (larger timestamp) comes before older (smaller timestamp)
			const parsedInfos = characterResponse.characterInfos.sort(
				(a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
			);

			return {
				ids,
				documents,
				metadatas,
				characterInfos: parsedInfos,
				characterInfo: parsedInfos[0] || null,
			};
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while executing [getAllCharacters].',
				'Failed to get all characters.'
			);
			// Ensure the function returns a valid-shaped response or throws,
			// depending on handleServiceError's behavior. Assuming it throws.
		}
	},

	getCharacter: async (characterId: string): Promise<CharacterResponse> => {
		const collection = await characterStore._getCollection();
		try {
			const rawResult = await getRecordById(collection, characterId);
			const results = validateChromaResponse(rawResult, 'getOne', collectionType);

			return characterStore._constuctCharacter(results);
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
		const collection = await characterStore._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.CHARACTER } }, { showName: { $in: showName } }],
		};
		try {
			const rawResults = await getRecords(collection, where, limit);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);

			return characterStore._constuctCharacter(results);
		} catch (error: any) {
			handleServiceError(
				error,
				'An internal error occurred while do [getCharactersByShowName].',
				`Failed to get characters by showName '${showName}'`
			);
		}
	},

	storeCharacter: async (character: CharacterInfo): Promise<string> => {
		const collection = await characterStore._getCollection();
		const now = new Date().toISOString();

		// Prepare the data to be upserted
		const characterMetadata: CharacterMetadata = {
			...character, // Start with all fields from input
			characterId: character.characterId || buildCharacterId(character.name, character.variant),
			updatedAt: now,
			createdAt: character.createdAt || now,
			type: METADATA_TYPES.CHARACTER,
		};

		const documentForEmbedding = flatCharacterToDoc({
			...characterMetadata,
			description: character.description,
			instruction: character.instruction,
		});

		try {
			// chromaDbClient.upsertRecord is Promise<void> and throws generic Error on underlying failure
			await chromaDbClient.upsertRecord(
				collection,
				characterMetadata.characterId,
				documentForEmbedding,
				characterMetadata
			);

			return characterMetadata.characterId;
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while saving the character.',
				`Failed to store character '${characterMetadata.characterId}'`
			);
		}
	},

	// Method to clear the cache
	clearCollectionCache: (): void => {
		characterStore._characterCollection = null;
	},
};

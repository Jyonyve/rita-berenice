import { Collection, IncludeEnum, Where } from 'chromadb';

import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { CharacterResponse, ChromaResponse } from '#shared/api/ModuleResponse.js';
import { flatCharacterToDoc, inflateCharacterDoc } from '../../shared/util/documentUtils.js';
import { validateChromaResponse, handleServiceError } from '../util/serviceHelpers.js';
import { metadataToCharacter } from '#shared/util/dbConvertUtils.js';
import {
	CharacterCdo,
	CharacterInfo,
	CharacterMetadata,
} from '#shared/domain/character/CharacterInterfaces.js';
import { createBasicCharacterInfo, isCharacterInfo } from '#shared/util/typeGuardUtils.js';

const { getCharacterCollection, getRecordById, getRecords } = chromaDbClient;
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

	_constructCharacter: (results: ChromaResponse): CharacterResponse => {
		const { ids, documents, metadatas } = results;
		const characterInfos = ids.map((id, index) => {
			const metadata = metadatas[index] as unknown as CharacterMetadata;
			const document = documents[index];
			const inflatedDoc = inflateCharacterDoc(document!);
			const characterInfo = metadataToCharacter(
				metadata!,
				inflatedDoc.description,
				inflatedDoc.instruction,
				inflatedDoc.firstMessage
			);
			return characterInfo;
		});
		return { ids, documents, metadatas, characterInfos, characterInfo: characterInfos[0] || null };
	},

	// Character Operations
	getAllCharacters: async (): Promise<CharacterResponse> => {
		const collection = await characterStore._getCollection();
		const where: Where = { type: { $eq: METADATA_TYPES.CHARACTER } };

		try {
			const rawResults = await getRecords(collection, where);

			const results = validateChromaResponse(rawResults, 'getList', collectionType);
			const { ids, documents, metadatas } = results;

			const characterResponse = characterStore._constructCharacter(results);

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

			return characterStore._constructCharacter(results);
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while do [getCharacter].',
				`Failed to get character with ID ${characterId}`
			);
		}
	},

	getCharactersByShowName: async (showName: string): Promise<CharacterResponse> => {
		const collection = await characterStore._getCollection();
		const where: Where = {
			$and: [
				{ type: { $eq: METADATA_TYPES.CHARACTER } },
				{ showName: { $like: `%${showName}%` } as any }, //NOTE: TS issue
			],
		};
		try {
			const rawResults = await getRecords(collection, where);
			const results = validateChromaResponse(rawResults, 'getList', collectionType);

			return characterStore._constructCharacter(results);
		} catch (error: any) {
			handleServiceError(
				error,
				'An internal error occurred while do [getCharactersByShowName].',
				`Failed to get characters by showName '${showName}'`
			);
		}
	},

	storeCharacter: async (character: CharacterCdo | CharacterInfo): Promise<string> => {
		const collection = await characterStore._getCollection();
		const now = new Date().toISOString();
		const updatedCharacter: CharacterInfo = isCharacterInfo(character)
			? character
			: createBasicCharacterInfo(character);
		const { description, instruction, firstMessage, ...characterMetadata } = updatedCharacter;

		const updatedMetadata: CharacterMetadata = {
			...characterMetadata, // Start with all fields from input
			characterId: updatedCharacter.characterId,
			updatedAt: now,
			createdAt: updatedCharacter.createdAt || now,
			type: METADATA_TYPES.CHARACTER,
		};

		const documentForEmbedding = flatCharacterToDoc({
			...characterMetadata,
			description,
			instruction,
			firstMessage,
		});

		try {
			// chromaDbClient.upsertRecord is Promise<void> and throws generic Error on underlying failure
			await chromaDbClient.upsertRecord(
				collection,
				updatedMetadata.characterId,
				documentForEmbedding,
				updatedMetadata
			);

			return JSON.stringify({ characterId: updatedMetadata.characterId });
		} catch (error) {
			handleServiceError(
				error,
				'An internal error occurred while saving the character.',
				`Failed to store character '${updatedMetadata.characterId}'`
			);
		}
	},

	// Method to clear the cache
	clearCollectionCache: (): void => {
		characterStore._characterCollection = null;
	},
};

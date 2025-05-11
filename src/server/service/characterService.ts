import { CharacterInfo, COLLECTIONS, METADATA_TYPES } from '#root/src/shared/domain/index.ts';
import { Collection, IncludeEnum, Document, Where } from 'chromadb';
import { chromaDbClient, ChromaResponse } from '../db/index.ts';
import {
	buildCharacterId,
	validateResult,
	validateServiceId,
	buildCharacterDocument,
} from '../util/index.ts';

const { getCharacterCollection, upsertRecord, getRecordById, getRecords } = chromaDbClient;

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

			if (!!results) {
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
		validateServiceId(characterId, COLLECTIONS.CHARACTER);
		try {
			const result = await getRecordById(collection, characterId);
			const { ids, documents, metadatas } = result;
			if (!ids || ids.length === 0) {
				console.warn(`no character is fetched by characterId: ${characterId}`);
				return null;
			}
			const parsedInfos = characterService._parseDocToBasicCharInfo(result.documents);
			return { ids, documents, metadatas, basicCharInfo: parsedInfos[0], basicCharInfos: parsedInfos };
		} catch (error) {
			console.error(`Failed to get character with ID ${characterId}:`, error);
			return null;
		}
	},

	storeCharacter: async (character: CharacterInfo): Promise<void> => {
		const collection = await characterService._getCollection();
		character.characterId = buildCharacterId(character.name, character.variant);
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
	): Promise<CharacterChromaResponse | null> => {
		const collection = await characterService._getCollection();
		const where: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.CHARACTER } }, { showName: { $in: showName } }],
		};
		try {
			const results = await getRecords(collection, where, limit);
			console.log(
				`[CharacterService.queryCharactersByShowName] Fetching characters with filter: ${JSON.stringify(where)}`
			);

			if (validateResult(results)) {
				const { ids, documents, metadatas } = results;
				const parsedBasicInfos = characterService._parseDocToBasicCharInfo(documents);
				return { ids, documents, metadatas, basicCharInfos: parsedBasicInfos };
			}
			console.warn(`failed to getCharactersByShowName, showName : ${showName}`);
			return null;
		} catch (error) {
			console.error('Failed to query characters:', error);
			return null;
		}
	},

	// Method to clear the cache
	clearCollectionCache: (): void => {
		characterService._characterCollection = null;
	},
};

// src/server/service/loreService.ts

import { CharacterHistory, CharacterLore, METADATA_TYPES } from '#root/src/shared/domain/index.ts'; // Adjust path
import { Collection, IncludeEnum } from 'chromadb';
import { chromaDbClient } from '../db/index.ts'; // Adjust path
import { buildLoreId } from '#root/src/shared/index.ts';
// Assuming buildLoreId is no longer needed if 'id' in LoreInfo is the ChromaDB doc ID
// import { buildLoreId } from '#root/src/shared/index.ts';

const {
	getLoreCollection,
	upsertRecord: upsertDocument,
	getRecordsByMetadataType: getDocumentsByMetadata,
	queryRecords: queryDocuments,
} = chromaDbClient;

export const loreService = {
	_loreCollection: null as Collection | null,

	_getCollection: async (): Promise<Collection> => {
		if (loreService._loreCollection) {
			return loreService._loreCollection;
		}
		console.log('[LoreService._getCollection] Fetching lore collection...');
		// Ensure getLoreCollection() in chromaDbClient returns the correct collection name
		const collection = await getLoreCollection();
		loreService._loreCollection = collection;
		console.log('[LoreService._getCollection] Lore collection obtained.');
		return collection;
	},

	// --- Get a specific lore/history entry by its unique ID ---
	getLores: async (characterId: string): Promise<CharacterLore[]> => {
		const collection = await loreService._getCollection();
		try {
			console.log(`[LoreService] Querying Lores for characterId: ${characterId}`);

			const results = await collection.get({
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
				where: { type: METADATA_TYPES.LORE, characterId },
			});

			if (!results.documents || results.documents.length === 0) {
				return [];
			}

			return results.documents
				.map((doc, index) => {
					if (doc === null) return null;
					try {
						return JSON.parse(doc) as CharacterLore;
					} catch (e) {
						console.error('Error parsing character info:', e);
						return null;
					}
				})
				.filter((char): char is CharacterLore => char !== null);
		} catch (error) {
			console.error(`Failed to get lores with ID ${characterId}:`, error);
			return [];
		}
	},

	// --- Get all lore/history for a specific character, optionally filtered by type ---
	getHistories: async (
		characterId: string,
		type?: typeof METADATA_TYPES.HISTORY,
		// Add pagination or sorting options if needed (e.g., sortBy: 'sequence' or 'created_at')
		options: { offset?: number; limit?: number } = {}
	): Promise<CharacterHistory[]> => {
		const collection = await loreService._getCollection();
		try {
			const whereFilter: Record<string, any> = { character_id: characterId, type };

			console.log(
				`[LoreService.getCharacterKnowledge] Fetching for character: ${characterId}, type: ${type || 'all'}, options: ${JSON.stringify(options)}`
			);

			const results = await collection.get({
				where: whereFilter,
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas], // Documents for content
				offset: options.offset,
				limit: options.limit,
				// ChromaDB's collection.get doesn't directly support sorting in the query.
				// Sorting would need to be done client-side after fetching,
				// or if using query, similarity score is the primary sort.
			});

			if (!results.ids || results.ids.length === 0) {
				console.log(`[LoreService.getCharacterKnowledge] No entries found.`);
				return [];
			}

			const histories = results.documents
				.map((doc, index) => {
					if (doc === null) return null;
					try {
						return JSON.parse(doc) as CharacterHistory;
					} catch (e) {
						console.error('Error parsing character info:', e);
						return null;
					}
				})
				.filter((history): history is CharacterHistory => history !== null);
			return histories.sort((a, b) => b.sequence - a.sequence);
		} catch (error) {
			console.error(`[LoreService.getCharacterKnowledge] Error fetching entries:`, error);
			return [];
		}
	},

	// --- Store a new piece of lore or history ---
	storeLoreEntry: async (characterLore: CharacterLore): Promise<string> => {
		const collection = await loreService._getCollection();

		// Ensure critical metadata is present
		const metadataToStore: LoreMetadata = {
			...entry.metadata, // User provided metadata
			character_id: entry.characterId, // Ensure character_id is in metadata for filtering
			created_at: entry.metadata.created_at || new Date().toISOString(),
			updated_at: new Date().toISOString(), // Always set/update this
		};

		try {
			console.log(
				`[LoreService.storeLoreEntry] Upserting entry ID: ${entryId} for character: ${entry.characterId}`
			);
			await upsertDocument(
				collection,
				entryId, // The unique ID for this lore/history document
				entry.content, // The text content
				metadataToStore // The structured metadata
			);
			console.log(`[LoreService.storeLoreEntry] Successfully upserted entry ID: ${entryId}`);
			return entryId;
		} catch (error) {
			console.error(
				`[LoreService.storeLoreEntry] Failed to store entry for character ${entry.characterId}:`,
				error
			);
			throw error;
		}
	},

	// --- Update an existing lore/history entry ---
	updateLoreEntry: async (
		entryId: string,
		updates: Partial<Pick<LoreInfo, 'content' | 'metadata'>>
	): Promise<boolean> => {
		const collection = await loreService._getCollection();
		try {
			console.log(`[LoreService.updateLoreEntry] Attempting to update entry ID: ${entryId}`);
			const existing = await collection.get({
				ids: [entryId],
				include: [IncludeEnum.Documents, IncludeEnum.Metadatas],
			});

			if (!existing.ids || existing.ids.length === 0 || !existing.documents || !existing.metadatas) {
				console.warn(
					`[LoreService.updateLoreEntry] Entry not found for ID: ${entryId}. Cannot update.`
				);
				return false;
			}

			const currentDoc = existing.documents[0];
			const currentMeta = existing.metadatas[0] as LoreMetadata;

			const newContent = updates.content !== undefined ? updates.content : currentDoc;
			const newMetadata: LoreMetadata = {
				...currentMeta,
				...(updates.metadata || {}),
				updated_at: new Date().toISOString(), // Always update this
			};

			await upsertDocument(collection, entryId, newContent!, newMetadata); // Use newContent! as it's guaranteed by logic
			console.log(`[LoreService.updateLoreEntry] Successfully updated entry ID: ${entryId}`);
			return true;
		} catch (error) {
			console.error(`[LoreService.updateLoreEntry] Failed to update entry ID ${entryId}:`, error);
			throw error;
		}
	},

	// --- Query for lore/history based on semantic similarity ---
	queryCharacterKnowledge: async (
		characterId: string,
		queryText: string,
		limit: number = 5,
		type?: typeof METADATA_TYPES.LORE | typeof METADATA_TYPES.HISTORY
	): Promise<LoreInfo[]> => {
		const collection = await loreService._getCollection();
		try {
			const whereFilter: Record<string, any> = { character_id: characterId };
			if (type) {
				whereFilter.type = type;
			}
			console.log(
				`[LoreService.queryCharacterKnowledge] Querying for character ${characterId}, type: ${type || 'all'}, text: "${queryText.substring(0, 30)}..."`
			);

			// Assuming queryDocuments in chromaDbClient handles embedding the queryText
			// and performs collection.query
			const results = await queryDocuments(collection, queryText, whereFilter, limit);
			// The structure of 'results' from queryDocuments needs to be known.
			// Assuming it's an array of { id: string, document: string, metadata: Record<string,any>, distance?: number }
			// OR the raw collection.query() result: { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] }

			console.log(
				`[LoreService.queryCharacterKnowledge] Raw query result:`,
				JSON.stringify(results, null, 2)
			);

			// Adapt this mapping based on the actual structure of 'results'
			let loreInfos: LoreInfo[] = [];
			if (results?.ids && Array.isArray(results.ids[0])) {
				// Likely raw collection.query output
				const ids = results.ids[0] || [];
				const docs = results.documents?.[0] || [];
				const metas = results.metadatas?.[0] || [];
				// const distances = results.distances?.[0] || []; // Optional

				loreInfos = ids.map((id, index) => ({
					id,
					characterId: (metas[index] as LoreMetadata)?.character_id || characterId, // Fallback
					content: docs[index] as string,
					metadata: metas[index] as LoreMetadata,
					// distance: distances[index] // Optional
				}));
			} else if (Array.isArray(results)) {
				// Simpler array of objects
				loreInfos = results.map((resItem: any) => ({
					id: resItem.id,
					characterId: resItem.metadata?.character_id || characterId,
					content: resItem.document,
					metadata: resItem.metadata as LoreMetadata,
					// distance: resItem.distance // Optional
				}));
			}

			console.log(
				`[LoreService.queryCharacterKnowledge] Found ${loreInfos.length} entries from query.`
			);
			return loreInfos;
		} catch (error) {
			console.error(`[LoreService.queryCharacterKnowledge] Error querying entries:`, error);
			return [];
		}
	},

	// --- Delete a specific lore/history entry ---
	deleteLoreEntry: async (entryId: string): Promise<boolean> => {
		const collection = await loreService._getCollection();
		try {
			console.log(`[LoreService.deleteLoreEntry] Deleting entry ID: ${entryId}`);
			await collection.delete({ ids: [entryId] }); // ChromaDB delete method
			console.log(`[LoreService.deleteLoreEntry] Successfully deleted entry ID: ${entryId}`);
			return true;
		} catch (error) {
			console.error(`[LoreService.deleteLoreEntry] Failed to delete entry ID ${entryId}:`, error);
			// Consider if you want to throw or return false
			return false;
		}
	},

	clearCollectionCache: (): void => {
		console.log('[LoreService.clearCollectionCache] Clearing cached lore collection.');
		loreService._loreCollection = null;
	},
};

// src/server/services/loreStore.ts

import { Collection, Metadata, Where } from 'chromadb';
import { METADATA_TYPES } from '#shared/config/constants.js';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { HistoryResponse, LoreResponse } from '#shared/api/ModuleResponse.js';
import {
	HistoryInfo,
	HistoryMetadata,
	LoreIndexContentType,
	LoreIndexMetadata,
	LoreInfo,
	LoreMetadata,
} from '#shared/domain/lore/LoreInterfaces.js';
import { metadataToHistory, metadataToLore } from '#shared/util/dbConvertUtils.js';
import { buildLoreIndexId } from '#shared/util/buildIdUtils.js';
import { validateChromaResponse, handleServiceError } from '../util/serviceHelpers.js';

// Destructure chromaDbClient methods
const { getLoreCollection, upsertRecords, getRecords, getRecordById, queryRecords, deleteRecords } =
	chromaDbClient;
const collectionType = COLLECTIONS.LORE;

const emptyLoreRes: LoreResponse = {
	ids: [],
	metadatas: [],
	documents: [],
	loreInfo: {} as LoreInfo,
	loreContent: '',
	loreInfos: [],
	loreContents: [],
};
const emptyHisRes: HistoryResponse = {
	ids: [],
	metadatas: [],
	documents: [],
	historyInfo: {} as HistoryInfo,
	historyContent: '',
	historyInfos: [],
	historyContents: [],
};

export const loreStore = {
	_loreCollection: null as Collection | null,

	_getCollection: async (): Promise<Collection> => {
		if (loreStore._loreCollection) {
			return loreStore._loreCollection;
		}
		const collection = await getLoreCollection();
		loreStore._loreCollection = collection;
		return collection;
	},

	// --- LORE OPERATIONS ---

	storeLore: async (loreInfo: LoreInfo): Promise<void> => {
		try {
			const collection = await loreStore._getCollection();
			// 1. Convert to the flat metadata object for the primary document.
			const loreMetadata: LoreMetadata = {
				type: METADATA_TYPES.LORE,
				loreId: loreInfo.loreId,
				characterId: loreInfo.characterId,
				userId: loreInfo.userId,
				profileId: loreInfo.profileId,
				createdAt: loreInfo.createdAt,
				updatedAt: loreInfo.updatedAt,
				title: loreInfo.title,
				generatedTitle: loreInfo.generatedTitle,
				englishId: loreInfo.englishId,
				category: loreInfo.category,
				source: loreInfo.source,
				summary: loreInfo.summary,
			};

			// 2. Upsert the primary document.
			await upsertRecords(collection, [loreInfo.loreId], [loreInfo.content], [loreMetadata]);

			// 3. Update its search indexes.
			await loreStore._updateSearchIndexForLore(loreInfo);
		} catch (error) {
			handleServiceError(error, `Failed to store lore ${loreInfo.loreId}`);
		}
	},

	_updateSearchIndexForLore: async (loreInfo: LoreInfo): Promise<void> => {
		const collection = await loreStore._getCollection();
		// 1. Delete ONLY the old INDEX entries for this lore.
		const oldIndexWhere: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { contentId: { $eq: loreInfo.loreId } }],
		};
		await collection.delete({ where: oldIndexWhere });

		// 2. Create new index records.
		const newIndexRecords: { id: string; document: string; metadata: LoreIndexMetadata }[] = [];
		const baseMetadata = {
			type: METADATA_TYPES.INDEX,
			contentId: loreInfo.loreId,
			characterId: loreInfo.characterId,
		};
		const createIndexRecords = (list: string[], contentType: LoreIndexContentType) => {
			if (!list || list.length === 0) return;
			for (const value of list) {
				if (!value || value.trim() === '') continue;
				newIndexRecords.push({
					id: buildLoreIndexId(loreInfo.loreId, contentType),
					document: value,
					metadata: { ...baseMetadata, contentType, value },
				});
			}
		};
		createIndexRecords(loreInfo.keywordList, 'KEYWORD');
		createIndexRecords(loreInfo.topicList, 'TOPIC');
		createIndexRecords(loreInfo.entityList, 'ENTITY');
		createIndexRecords(loreInfo.allAffectedCharacterIdList, 'AFFECTED_CHARACTER');

		// 3. Batch upsert the new index records.
		if (newIndexRecords.length > 0) {
			await upsertRecords(
				collection,
				newIndexRecords.map((r) => r.id),
				newIndexRecords.map((r) => r.document),
				newIndexRecords.map((r) => r.metadata)
			);
		}
	},

	getLores: async (characterId: string): Promise<LoreResponse> => {
		try {
			const collection = await loreStore._getCollection();
			const where: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.LORE } }, { characterId: { $eq: characterId } }],
			};

			// 1. Fetch primary LORE documents.
			const loreResults = await getRecords(collection, where);
			const lorePrimaryDocs = validateChromaResponse(loreResults, 'getList', collectionType);
			if (lorePrimaryDocs.ids.length === 0) return emptyLoreRes;

			// 2. Fetch all index records for the found lores.
			const contentIds = lorePrimaryDocs.ids;
			const indexWhere: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { contentId: { $in: contentIds } }],
			};
			const indexResults = await getRecords(collection, indexWhere);
			const allIndexRecords = validateChromaResponse(indexResults, 'getList', collectionType);

			// 3. Reconstruct full rich objects.
			const loreInfos = lorePrimaryDocs.metadatas.map((metadata, i) => {
				const relatedIndexMetadatas = allIndexRecords.metadatas.filter(
					(record) => !!record && record.contentId === (metadata as unknown as LoreMetadata).loreId
				);
				return metadataToLore(
					metadata as unknown as LoreMetadata,
					lorePrimaryDocs.documents[i] || '',
					relatedIndexMetadatas as unknown as LoreIndexMetadata[]
				);
			});

			return {
				ids: lorePrimaryDocs.ids,
				metadatas: lorePrimaryDocs.metadatas,
				documents: lorePrimaryDocs.documents,
				loreInfos,
				loreInfo: loreInfos[0] || null,
				loreContent: loreInfos[0]?.content || '',
				loreContents: loreInfos.map((l) => l.content),
			};
		} catch (error) {
			handleServiceError(error, `Failed to get lores for character ${characterId}`);
			return emptyLoreRes; // Ensure a valid response is always returned
		}
	},

	// --- HISTORY OPERATIONS (Corrected and aligned with Lore) ---

	storeHistory: async (historyInfo: HistoryInfo): Promise<void> => {
		try {
			const collection = await loreStore._getCollection();
			const historyMetadata: HistoryMetadata = {
				type: METADATA_TYPES.HISTORY,
				historyId: historyInfo.historyId,
				characterId: historyInfo.characterId,
				userId: historyInfo.userId,
				profileId: historyInfo.profileId,
				createdAt: historyInfo.createdAt,
				updatedAt: historyInfo.updatedAt,
				title: historyInfo.title,
				generatedTitle: historyInfo.generatedTitle,
				englishId: historyInfo.englishId,
				category: historyInfo.category,
				summary: historyInfo.summary,
				periodLabel: historyInfo.periodLabel,
				eventDateValue: historyInfo.eventDateValue,
				eventDateType: historyInfo.eventDateType,
			};
			await upsertRecords(
				collection,
				[historyInfo.historyId],
				[historyInfo.content],
				[historyMetadata]
			);
			await loreStore._updateSearchIndexForHistory(historyInfo);
		} catch (error) {
			handleServiceError(error, `Failed to store history ${historyInfo.historyId}`);
		}
	},

	_updateSearchIndexForHistory: async (historyInfo: HistoryInfo): Promise<void> => {
		const collection = await loreStore._getCollection();
		const oldIndexWhere: Where = {
			$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { contentId: { $eq: historyInfo.historyId } }],
		};
		await collection.delete({ where: oldIndexWhere });

		const newIndexRecords: { id: string; document: string; metadata: LoreIndexMetadata }[] = [];
		const baseMetadata = {
			type: METADATA_TYPES.INDEX,
			contentId: historyInfo.historyId,
			characterId: historyInfo.characterId,
		};
		const createIndexRecords = (list: any[], contentType: LoreIndexContentType) => {
			if (!list || list.length === 0) return;
			for (const item of list) {
				// Handle both strings and objects (for RelatedEvent)
				const value = typeof item === 'string' ? item : JSON.stringify(item);
				if (!value || value.trim() === '') continue;
				newIndexRecords.push({
					id: buildLoreIndexId(historyInfo.historyId, contentType),
					document: value,
					metadata: { ...baseMetadata, contentType, value },
				});
			}
		};
		createIndexRecords(historyInfo.keywordList, 'KEYWORD');
		createIndexRecords(historyInfo.topicList, 'TOPIC');
		createIndexRecords(historyInfo.entityList, 'ENTITY');
		createIndexRecords(historyInfo.allAffectedCharacterIdList, 'AFFECTED_CHARACTER');
		createIndexRecords(historyInfo.relatedEventList, 'RELATED_EVENT');

		if (newIndexRecords.length > 0) {
			await upsertRecords(
				collection,
				newIndexRecords.map((r) => r.id),
				newIndexRecords.map((r) => r.document),
				newIndexRecords.map((r) => r.metadata)
			);
		}
	},

	getHistories: async (characterId: string): Promise<HistoryResponse> => {
		try {
			const collection = await loreStore._getCollection();
			const where: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.HISTORY } }, { characterId: { $eq: characterId } }],
			};
			const historyResults = await getRecords(collection, where);
			const historyPrimaryDocs = validateChromaResponse(historyResults, 'getList', collectionType);
			if (historyPrimaryDocs.ids.length === 0) return emptyHisRes;

			const contentIds = historyPrimaryDocs.ids;
			const indexWhere: Where = {
				$and: [{ type: { $eq: METADATA_TYPES.INDEX } }, { contentId: { $in: contentIds } }],
			};
			const indexResults = await getRecords(collection, indexWhere);
			const allIndexRecords = validateChromaResponse(indexResults, 'getList', collectionType);

			const historyInfos = historyPrimaryDocs.metadatas.map((metadata, i) => {
				const relatedIndexMetadatas = allIndexRecords.metadatas.filter(
					(record) => !!record && record.contentId === (metadata as unknown as HistoryMetadata).historyId
				);
				return metadataToHistory(
					metadata as unknown as HistoryMetadata,
					historyPrimaryDocs.documents[i] || '',
					relatedIndexMetadatas as unknown as LoreIndexMetadata[]
				);
			});

			return {
				ids: historyPrimaryDocs.ids,
				metadatas: historyPrimaryDocs.metadatas,
				documents: historyPrimaryDocs.documents,
				historyInfos,
				historyInfo: historyInfos[0] || null,
				historyContent: historyInfos[0]?.content || '',
				historyContents: historyInfos.map((h) => h.content),
			};
		} catch (error) {
			handleServiceError(error, `Failed to get histories for character ${characterId}`);
			return emptyHisRes; // Ensure a valid response is always returned
		}
	},
};

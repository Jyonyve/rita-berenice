// src/mock/hook/useLoreApi.mock.ts

import { LoreInfo, HistoryInfo } from '#shared/domain/lore/LoreInterfaces.js';
import { LoreResponse, HistoryResponse } from '#shared/api/ModuleResponse.js';
// import { mockLoreResponse } from '../data/mockLoreResponse.js';        // Your static lore data
// import { mockHistoryResponse } from '../data/mockHistoryResponse.js';  // Your static history data

export const useLoreApiMock = () => {
	// --- LORE OPERATIONS ---
	const loreData: LoreResponse = {
		ids: [],
		documents: [],
		metadatas: [],
		loreInfos: [],
		loreInfo: {} as LoreInfo,
		loreContent: '',
		loreContents: [],
	};

	const historyData: HistoryResponse = {
		ids: [],
		documents: [],
		metadatas: [],
		historyInfos: [],
		historyInfo: {} as HistoryInfo,
		historyContent: '',
		historyContents: [],
	};

	/**
	 * Mocks storing a lore entry.
	 * Logs the action and returns a resolved promise.
	 */
	const storeLore = {
		mutateAsync: async (loreInfo: LoreInfo): Promise<boolean> => {
			console.log('[MOCK] storeLore called with:', loreInfo);
			return Promise.resolve(true);
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	/**
	 * Mocks fetching all lore entries for a character.
	 */
	const getLores = (characterId: string) => ({
		data: loreData,
		isLoading: false,
		isError: false,
		error: null,
	});

	/**
	 * Mocks fetching a single lore entry by ID.
	 */
	const getLore = (loreId: string) => ({
		data: loreData,
		isLoading: false,
		isError: false,
		error: null,
	});

	/**
	 * Mocks semantic search for lore entries.
	 */
	const queryLores = {
		mutateAsync: async ({
			characterId,
			queryTexts,
			options,
		}: {
			characterId: string;
			queryTexts: string[];
			options?: Record<string, unknown>;
		}): Promise<LoreResponse> => {
			console.log('[MOCK] queryLores called with:', { characterId, queryTexts, options });
			return Promise.resolve({} as LoreResponse);
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	// --- HISTORY OPERATIONS ---

	/**
	 * Mocks storing a history entry.
	 */
	const storeHistory = {
		mutateAsync: async (historyInfo: HistoryInfo): Promise<boolean> => {
			console.log('[MOCK] storeHistory called with:', historyInfo);
			return Promise.resolve(true);
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	/**
	 * Mocks fetching all history entries for a character.
	 */
	const getHistories = (characterId: string) => ({
		data: historyData,
		isLoading: false,
		isError: false,
		error: null,
	});

	/**
	 * Mocks semantic search for history entries.
	 */
	const queryHistories = {
		mutateAsync: async ({
			characterId,
			queryTexts,
			options,
		}: {
			characterId: string;
			queryTexts: string[];
			options?: { limit?: number };
		}): Promise<HistoryResponse> => {
			console.log('[MOCK] queryHistories called with:', { characterId, queryTexts, options });
			return Promise.resolve({} as HistoryResponse);
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	return {
		// Lore methods
		storeLore,
		getLores,
		getLore,
		queryLores,
		// History methods
		storeHistory,
		getHistories,
		queryHistories,
	};
};

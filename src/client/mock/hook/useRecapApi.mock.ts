// src/mock/hook/useRecapApi.mock.ts

import { RecapInfo } from '#shared/domain/recap/RecapInterfaces.js';
import { RecapResponse } from '#shared/api/ModuleResponse.js';

const RecapType = { RECAP: 'recap', RELATIONSHIP: 'relationship' } as const;

export const useRecapApiMock = () => {
	/**
	 * Mocks storing a factual recap entry.
	 */
	const storeFactualRecap = {
		mutateAsync: async (recapInfo: RecapInfo): Promise<boolean> => {
			console.log('[MOCK] storeFactualRecap called with:', recapInfo);
			return Promise.resolve(true);
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	/**
	 * Mocks storing a relationship recap entry.
	 */
	const storeRelationshipRecap = {
		mutateAsync: async (recapInfo: RecapInfo): Promise<boolean> => {
			console.log('[MOCK] storeRelationshipRecap called with:', recapInfo);
			return Promise.resolve(true);
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	/**
	 * Mocks fetching the entire concatenated recap document for a session.
	 * Returns mockRecapWholeDoc or mockRelationshipWholeDoc based on type.
	 */
	const getRecapWholeDoc = (
		sessionId: string,
		type: typeof RecapType.RECAP | typeof RecapType.RELATIONSHIP
	) => ({ data: type === RecapType.RECAP ? '' : '', isLoading: false, isError: false, error: null });

	/**
	 * Mocks semantic search for recap entries.
	 */
	const queryRecaps = {
		mutateAsync: async ({
			sessionId,
			queryTexts,
			type,
			where,
			whereDocument,
			limit,
		}: {
			sessionId: string;
			queryTexts: string[];
			type: typeof RecapType.RECAP | typeof RecapType.RELATIONSHIP;
			where?: unknown;
			whereDocument?: unknown;
			limit?: number;
		}): Promise<RecapResponse> => {
			console.log('[MOCK] queryRecaps called with:', {
				sessionId,
				queryTexts,
				type,
				where,
				whereDocument,
				limit,
			});
			return Promise.resolve({} as RecapResponse);
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	return { storeFactualRecap, storeRelationshipRecap, getRecapWholeDoc, queryRecaps };
};

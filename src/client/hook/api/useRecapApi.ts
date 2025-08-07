// src/client/hooks/useRecapApi.ts

import type { Where, WhereDocument } from 'chromadb';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, genApiUrl } from '../../util/clientApiHelpers.js';
import { MODULE_NAMES } from '#shared/config/constants.js';

import { RecapInfo } from '#shared/domain/recap/RecapInterfaces.js';
import { RecapResponse } from '#shared/api/ModuleResponse.js';

const RecapType = { RECAP: 'recap', RELATIONSHIP: 'relationship' } as const;
/**
 * A client-side hook for interacting with the RECAP API endpoints, refactored for TanStack Query.
 */
export const useRecapApi = () => {
	const MODULE_NAME = MODULE_NAMES.RECAP;
	const queryClient = useQueryClient();

	/**
	 * Stores a new factual recap entry.
	 * Mutation key: 'storeFactualRecap'
	 */
	const storeFactualRecap = useMutation<boolean, Error, RecapInfo>({
		mutationFn: async (recapInfo: RecapInfo) => {
			const url = genApiUrl(MODULE_NAME, 'storeFactualRecap');
			await apiClient.post(url, recapInfo);
			return true;
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ['getRecapWholeDoc', variables.sessionId, RecapType.RECAP],
			});
			queryClient.invalidateQueries({
				queryKey: ['queryRecaps', variables.sessionId, RecapType.RECAP],
			});
		},
	});

	/**
	 * Stores a new relationship recap entry.
	 * Mutation key: 'storeRelationshipRecap'
	 */
	const storeRelationshipRecap = useMutation<boolean, Error, RecapInfo>({
		mutationFn: async (recapInfo: RecapInfo) => {
			const url = genApiUrl(MODULE_NAME, 'storeRelationshipRecap');
			await apiClient.post(url, recapInfo);
			return true;
		},
		onSuccess: (_, variables) => {
			// Invalidate relevant queries for this session's relationship docs
			queryClient.invalidateQueries({
				queryKey: ['getRecapWholeDoc', variables.sessionId, RecapType.RELATIONSHIP],
			});
			queryClient.invalidateQueries({
				queryKey: ['queryRecaps', variables.sessionId, RecapType.RELATIONSHIP],
			});
		},
	});

	/**
	 * Fetches the entire concatenated recap document for a session.
	 * Query key: ['getRecapWholeDoc']
	 */
	const getRecapWholeDoc = (
		sessionId: string,
		type: typeof RecapType.RECAP | typeof RecapType.RELATIONSHIP
	) =>
		useQuery<string | null, Error>({
			queryKey: ['getRecapWholeDoc', sessionId, type], // Ensure type is part of the query key
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getRecapWholeDoc', [sessionId]);
				const response = await apiClient.get<string>(url, { params: { type } });
				return response.data;
			},
			enabled: !!sessionId,
		});

	/**
	 * Performs a semantic search for recap entries.
	 * Mutation key: 'queryRecaps'
	 */
	const queryRecaps = useMutation<
		RecapResponse,
		Error,
		{
			sessionId: string;
			queryTexts: string[];
			type: typeof RecapType.RECAP | typeof RecapType.RELATIONSHIP;
			where?: Where;
			whereDocument?: WhereDocument;
			limit?: number;
		}
	>({
		mutationFn: async ({ sessionId, queryTexts, type, where, whereDocument, limit }) => {
			const url = genApiUrl(MODULE_NAMES.RECAP, 'queryRecaps');
			const response = await apiClient.post<RecapResponse>(url, {
				sessionId,
				queryTexts,
				type,
				where,
				whereDocument,
				limit,
			});
			return response.data;
		},
	});

	return { storeFactualRecap, storeRelationshipRecap, getRecapWholeDoc, queryRecaps };
};

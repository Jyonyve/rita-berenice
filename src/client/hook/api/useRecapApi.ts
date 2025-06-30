// src/client/hooks/useRecapApi.ts

import {
	genApiUrl,
	MODULE_NAMES,
	RecapResponse,
	RecapInfo,
	METADATA_TYPES,
} from '#shared/index.js';
import { Where, WhereDocument } from 'chromadb';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '#server/util/serviceHelpers.js';
import { apiClient } from '../../util/index.js';

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
	const storeFactualRecap = useMutation<boolean, ApiError, RecapInfo>({
		mutationFn: async (recapInfo: RecapInfo) => {
			const url = genApiUrl(MODULE_NAME, 'storeFactualRecap');
			await apiClient.post(url, recapInfo);
			return true;
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ['getRecapWholeDoc', variables.sessionId, METADATA_TYPES.RECAP],
			});
			queryClient.invalidateQueries({
				queryKey: ['queryRecaps', variables.sessionId, METADATA_TYPES.RECAP],
			});
		},
	});

	/**
	 * Stores a new relationship recap entry.
	 * Mutation key: 'storeRelationshipRecap'
	 */
	const storeRelationshipRecap = useMutation<boolean, ApiError, RecapInfo>({
		mutationFn: async (recapInfo: RecapInfo) => {
			const url = genApiUrl(MODULE_NAME, 'storeRelationshipRecap');
			await apiClient.post(url, recapInfo);
			return true;
		},
		onSuccess: (_, variables) => {
			// Invalidate relevant queries for this session's relationship docs
			queryClient.invalidateQueries({
				queryKey: ['getRecapWholeDoc', variables.sessionId, METADATA_TYPES.RELATIONSHIP],
			});
			queryClient.invalidateQueries({
				queryKey: ['queryRecaps', variables.sessionId, METADATA_TYPES.RELATIONSHIP],
			});
		},
	});

	/**
	 * Fetches the entire concatenated recap document for a session.
	 * Query key: ['getRecapWholeDoc']
	 */
	const getRecapWholeDoc = (
		sessionId: string,
		type: typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP
	) =>
		useQuery<string | null, ApiError>({
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
		RecapResponse | null,
		ApiError,
		{
			sessionId: string;
			queryTexts: string[];
			type: typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP;
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

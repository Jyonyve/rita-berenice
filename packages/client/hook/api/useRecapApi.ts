// src/client/hooks/useRecapApi.ts

import type { Where, WhereDocument } from 'chromadb';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, decompressData, genApiUrl } from '../../util/clientApiHelpers.js';
import { MODULE_NAMES, METADATA_TYPES } from '@rita-berenice/shared/config/constants.js';
import { RecapInfo } from '@rita-berenice/shared/domain/recap/recap.routes.js';
import { Payload } from '@rita-berenice/shared/util/apiHelpers.js';

/**
 * A client-side hook for interacting with the RECAP API endpoints,
 * fully refactored with hierarchical query keys.
 */
export const useRecapApi = () => {
	const MODULE_NAME = MODULE_NAMES.RECAP;
	const queryClient = useQueryClient();

	/**
	 * Stores a new or updated recap entry.
	 * This single mutation handles both factual and relationship recaps.
	 */
	const storeRecap = useMutation<{ recapId: string }, Error, RecapInfo>({
		mutationFn: async (recapInfo) => {
			const url = genApiUrl(MODULE_NAME, 'storeRecap');
			const response = await apiClient.post<{ recapId: string }>(url, recapInfo);
			return response.data;
		},
		onSuccess: (_, variables) => {
			// Invalidate the specific recap list for this session and type
			queryClient.invalidateQueries({
				queryKey: ['recaps', 'list', 'getRecapsBySessionId', variables.sessionId, variables.type],
			});
		},
	});

	/**
	 * Fetches all recap entries for a session, filtered by type.
	 */
	const getRecapsBySessionId = (
		sessionId: string,
		type: typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP
	) =>
		useQuery<RecapInfo[], Error>({
			queryKey: ['recaps', 'list', 'getRecapsBySessionId', sessionId, type], // Hierarchical structure
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getRecapsBySessionId', [sessionId, type]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<RecapInfo[]>(response.data.payload);
			},
			enabled: !!sessionId && !!type,
		});

	return { storeRecap: storeRecap.mutateAsync, getRecapsBySessionId };
};

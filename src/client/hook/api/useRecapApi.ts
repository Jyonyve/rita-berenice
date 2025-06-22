// src/client/hooks/useRecapApi.ts

import { useState, useCallback } from 'react';
import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	ApiError,
	RecapResponse,
	RecapInfo,
	METADATA_TYPES,
} from '#shared/index.ts';
import { Where, WhereDocument } from 'chromadb';
import { useToast } from '../../component/index.ts';

/**
 * A client-side hook for interacting with the RECAP API endpoints.
 * It encapsulates API logic, loading/error states, and user notifications via a toast system.
 */
export const useRecapApi = () => {
	const MODULE_NAME = MODULE_NAMES.RECAP;

	// --- Hooks ---
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<ApiError | null>(null);
	const { addToast } = useToast();

	/**
	 * Stores a new factual recap entry.
	 * @param recapInfo The recap data to save.
	 * @returns A boolean indicating success or failure.
	 */
	const storeFactualRecap = useCallback(
		async (recapInfo: RecapInfo): Promise<boolean> => {
			setLoading(true);
			setError(null);
			try {
				// Assumes a route exists at /api/recap/store-factual-recap
				const url = genApiUrl(MODULE_NAME, 'storeFactualRecap');
				await apiClient.post(url, recapInfo);
				addToast('Factual recap saved.', 'success');
				return true;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to save factual recap.', 'error');
				setError(apiError);
				return false;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Stores a new relationship recap entry.
	 * @param recapInfo The recap data to save.
	 * @returns A boolean indicating success or failure.
	 */
	const storeRelationshipRecap = useCallback(
		async (recapInfo: RecapInfo): Promise<boolean> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'storeRelationshipRecap');
				await apiClient.post(url, recapInfo);
				addToast('Relationship recap saved.', 'success');
				return true;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to save relationship recap.', 'error');
				setError(apiError);
				return false;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Fetches the entire concatenated recap document for a session.
	 * @param sessionId The ID of the session.
	 * @param type The type of recap document to fetch ('recap' or 'relationship').
	 * @returns The recap content as a string, or null on failure.
	 */
	const getRecapWholeDoc = useCallback(
		async (
			sessionId: string,
			type: typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP
		): Promise<string | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'getRecapWholeDoc', [sessionId]);
				// The server endpoint should accept `type` as a query parameter
				const response = await apiClient.get<string>(url, { params: { type } });
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to load recap document.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Performs a semantic search for recap entries.
	 * @returns A RecapResponse with matching entries, or null on failure.
	 */
	const queryRecaps = useCallback(
		async (
			sessionId: string,
			queryTexts: string[],
			type: typeof METADATA_TYPES.RECAP | typeof METADATA_TYPES.RELATIONSHIP,
			where?: Where,
			whereDocument?: WhereDocument,
			limit?: number
		): Promise<RecapResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'queryRecaps');
				const response = await apiClient.post<RecapResponse>(url, {
					sessionId,
					queryTexts,
					type,
					where,
					whereDocument,
					limit,
				});
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				// Search failures are common and might not always need a toast,
				// but it's good practice to provide feedback on an actual error.
				addToast(apiError.clientMessage || 'Recap search failed.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	return {
		loading,
		error,
		storeFactualRecap,
		storeRelationshipRecap,
		getRecapWholeDoc,
		queryRecaps,
	};
};

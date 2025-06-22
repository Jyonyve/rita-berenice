// src/client/hooks/useGlossaryApi.ts

import { useState, useCallback } from 'react';
import {
	apiClient,
	genApiUrl,
	MODULE_NAMES,
	ApiError,
	TermResponse,
	TermInfo,
	TermCdo,
} from '#shared/index.ts';
import { useToast } from '../../component/index.ts';

/**
 * A client-side hook for interacting with the GLOSSARY API endpoints.
 * It encapsulates API logic, loading/error states, and user notifications via a toast system.
 */
export const useGlossaryApi = () => {
	const MODULE_NAME = MODULE_NAMES.TERM;

	// --- Hooks ---
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<ApiError | null>(null);
	const { addToast } = useToast();

	/**
	 * Stores a new or updated term in the glossary for a specific session.
	 * @param termInfo The term data to save.
	 * @returns A boolean indicating success or failure.
	 */
	const storeTerm = useCallback(
		async (termInfo: TermCdo | TermInfo): Promise<boolean> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'storeTerm');
				await apiClient.post(url, termInfo);
				addToast(`Term "${termInfo.koreanTerm}" saved.`, 'success');
				return true;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to save term.', 'error');
				setError(apiError);
				return false;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Fetches a specific term by its Korean name for a given session.
	 * @returns A TermResponse object containing the found term, or null on failure.
	 */
	const getTermByKorean = useCallback(
		async (sessionId: string, koreanTerm: string): Promise<TermResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'getTermByKorean', [sessionId, koreanTerm]);
				const response = await apiClient.get<TermResponse>(url);
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				if (apiError.status !== 404) {
					// Don't show toast for expected "not found"
					addToast(apiError.clientMessage || 'Failed to fetch term.', 'error');
				}
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Fetches all glossary terms associated with a specific session.
	 * @param sessionId The ID of the session.
	 * @returns A TermResponse object containing all terms, or null on failure.
	 */
	const getTermsBySessionId = useCallback(
		async (sessionId: string): Promise<TermResponse | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'getTermsBySessionId', [sessionId]);
				const response = await apiClient.get<TermResponse>(url);
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to load glossary.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Ensures terms exist for a prompt, auto-translating and storing any that are missing.
	 * The server returns a Map, which gets converted to a plain object by its route.
	 * @returns A Record (object) mapping Korean terms to English terms, or null on failure.
	 */
	const ensureAndGetTermsForPrompt = useCallback(
		async (
			sessionId: string,
			koreanTermsToEnsure: string[]
		): Promise<Record<string, string> | null> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'ensureAndGetTermsForPrompt');
				const response = await apiClient.post<Record<string, string>>(url, {
					sessionId,
					koreanTermsToEnsure,
				});
				return response.data;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to process terms for prompt.', 'error');
				setError(apiError);
				return null;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	/**
	 * Clears the server's in-memory cache for a specific session's glossary.
	 * @param sessionId The ID of the session to clear.
	 * @returns A boolean indicating success or failure.
	 */
	const clearSessionCache = useCallback(
		async (sessionId: string): Promise<boolean> => {
			setLoading(true);
			setError(null);
			try {
				const url = genApiUrl(MODULE_NAME, 'clearSessionCache', [sessionId]);
				await apiClient.delete(url); // Using DELETE for semantic correctness
				addToast('Glossary cache for this session has been cleared.', 'info');
				return true;
			} catch (err) {
				const apiError = err as ApiError;
				addToast(apiError.clientMessage || 'Failed to clear cache.', 'error');
				setError(apiError);
				return false;
			} finally {
				setLoading(false);
			}
		},
		[addToast]
	);

	return {
		loading,
		error,
		storeTerm,
		getTermByKorean,
		getTermsBySessionId,
		ensureAndGetTermsForPrompt,
		clearSessionCache,
	};
};

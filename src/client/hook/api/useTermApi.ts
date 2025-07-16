// src/client/hooks/useGlossaryApi.ts

import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../../util/clientApiHelpers.ts';
import { MODULE_NAMES } from '#shared/config/constants.js';
import { TermCdo, TermInfo } from '#shared/domain/term/TermInterfaces.js';
import { genApiUrl } from '#shared/util/apiHelpers.js';
import { TermResponse } from '#shared/api/ModuleResponse.js';

/**
 * A client-side hook for interacting with the GLOSSARY API endpoints.
 * It encapsulates API logic, loading/error states, and user notifications via a toast system.
 */
export const useTermApi = () => {
	const MODULE_NAME = MODULE_NAMES.TERM;
	const queryClient = useQueryClient();

	/**
	 * Stores a new or updated term in the glossary for a specific session.
	 * Mutation key: 'storeTerm'
	 */
	const storeTerm = useMutation<boolean, Error, TermCdo | TermInfo>({
		mutationFn: async (termInfo: TermCdo | TermInfo) => {
			const url = genApiUrl(MODULE_NAME, 'storeTerm');
			await apiClient.post(url, termInfo);
			return true;
		},
		onSuccess: (_, variables) => {
			// addToast(
			// 	`Term "${(variables as TermInfo).koreanTerm || (variables as TermCdo).koreanTerm}" saved.`,
			// 	'success'
			// );
			// Invalidate queries that fetch terms for this session
			queryClient.invalidateQueries({ queryKey: ['getTermsBySessionId', variables.sessionId] });
			queryClient.invalidateQueries({
				queryKey: [
					'getTermByKorean',
					variables.sessionId,
					(variables as TermInfo).koreanTerm || (variables as TermCdo).koreanTerm,
				],
			});
		},
	});

	/**
	 * Fetches a specific term by its Korean name for a given session.
	 * Query key: ['getTermByKorean']
	 */
	const getTermByKorean = (sessionId: string, koreanTerm: string) =>
		useQuery<TermResponse | null, Error>({
			queryKey: ['getTermByKorean', sessionId, koreanTerm],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getTermByKorean', [sessionId, koreanTerm]);
				const response = await apiClient.get<TermResponse>(url);
				return response.data;
			},
			enabled: !!sessionId && !!koreanTerm,
			// Custom retry logic for 404 (not found is expected)
			retry: (failureCount, error) => (error.name === '404' ? false : failureCount < 3),
		});

	/**
	 * Fetches all glossary terms associated with a specific session.
	 * Query key: ['getTermsBySessionId']
	 */
	const getTermsBySessionId = (sessionId: string) =>
		useQuery<TermResponse | null, Error>({
			queryKey: ['getTermsBySessionId', sessionId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getTermsBySessionId', [sessionId]);
				const response = await apiClient.get<TermResponse>(url);
				return response.data;
			},
			enabled: !!sessionId,
		});

	/**
	 * Ensures terms exist for a prompt, auto-translating and storing any that are missing.
	 * Mutation key: 'ensureAndGetTermsForPrompt'
	 */
	const ensureAndGetTermsForPrompt = useMutation<
		Record<string, string> | null,
		Error,
		{ sessionId: string; koreanTermsToEnsure: string[] }
	>({
		mutationFn: async ({ sessionId, koreanTermsToEnsure }) => {
			const url = genApiUrl(MODULE_NAME, 'ensureAndGetTermsForPrompt');
			const response = await apiClient.post<Record<string, string>>(url, {
				sessionId,
				koreanTermsToEnsure,
			});
			return response.data;
		},
		onSuccess: (_, variables) => {
			// Invalidate all terms for this session, as new ones might have been added
			queryClient.invalidateQueries({ queryKey: ['getTermsBySessionId', variables.sessionId] });
		},
	});

	/**
	 * Clears the server's in-memory cache for a specific session's glossary.
	 * Mutation key: 'clearSessionCache'
	 */
	const clearSessionCache = useMutation<boolean, Error, string>({
		mutationFn: async (sessionId: string) => {
			const url = genApiUrl(MODULE_NAME, 'clearSessionCache', [sessionId]);
			await apiClient.delete(url);
			return true;
		},
		onSuccess: (_, sessionId) => {
			// Invalidate all term queries for this session
			queryClient.invalidateQueries({ queryKey: ['getTermsBySessionId', sessionId] });
			queryClient.invalidateQueries({ queryKey: ['getTermByKorean', sessionId] });
			queryClient.invalidateQueries({ queryKey: ['ensureAndGetTermsForPrompt', sessionId] });
		},
	});

	return {
		storeTerm,
		getTermByKorean,
		getTermsBySessionId,
		ensureAndGetTermsForPrompt,
		clearSessionCache,
	};
};

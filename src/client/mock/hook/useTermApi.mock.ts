// src/mock/hook/useTermApi.mock.ts

import { TermCdo, TermInfo } from '#shared/domain/term/TermInterfaces.js';
import { Term, TermResponse } from '#shared/api/ModuleResponse.js';

export const useTermApiMock = () => {
	const data: TermResponse = {
		term: {} as Term,
		terms: [],
		termInfo: {} as TermInfo,
		termInfos: [],
		ids: [],
		metadatas: [],
		documents: [],
	};
	/**
	 * Mocks storing a new or updated term.
	 * Logs the action and resolves immediately.
	 */
	const storeTerm = {
		mutateAsync: async (termInfo: TermCdo | TermInfo): Promise<boolean> => {
			console.log('[MOCK] storeTerm called with:', termInfo);
			return Promise.resolve(true);
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	/**
	 * Mocks fetching a specific term by its Korean name for a given session.
	 * Returns the first matching term or null if not found.
	 */
	const getTermByKorean = (sessionId: string, koreanTerm: string) => {
		return { data, isLoading: false, isError: false, error: null };
	};

	/**
	 * Mocks fetching all glossary terms for a specific session.
	 */
	const getTermsBySessionId = (sessionId: string) => ({
		data,
		isLoading: false,
		isError: false,
		error: null,
	});

	/**
	 * Mocks ensuring and getting terms for a prompt.
	 * Returns a map of Korean term to English translation.
	 */
	const ensureAndGetTermsForPrompt = {
		mutateAsync: async ({
			sessionId,
			userId,
			koreanTermsToEnsure,
		}: {
			sessionId: string;
			userId: string;
			koreanTermsToEnsure: string[];
		}): Promise<Record<string, string> | null> => {
			console.log('[MOCK] ensureAndGetTermsForPrompt called with:', {
				sessionId,
				koreanTermsToEnsure,
			});
			// Return a mock mapping for each requested term
			const result: Record<string, string> = {};
			return Promise.resolve(result);
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	/**
	 * Mocks clearing the server's in-memory cache for a session's glossary.
	 */
	const clearSessionCache = {
		mutateAsync: async (sessionId: string): Promise<boolean> => {
			console.log('[MOCK] clearSessionCache called with:', sessionId);
			return Promise.resolve(true);
		},
		isLoading: false,
		isError: false,
		error: null,
	};

	return {
		storeTerm,
		getTermByKorean,
		getTermsBySessionId,
		ensureAndGetTermsForPrompt,
		clearSessionCache,
	};
};

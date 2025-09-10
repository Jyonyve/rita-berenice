// src/client/hooks/useGlossaryApi.ts

import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, decompressData, genApiUrl } from '../../util/clientApiHelpers.js';
import { MODULE_NAMES } from '#shared/config/constants.js';
import {
	SessionTermCdo,
	SessionTermInfo,
	CharacterTermCdo,
	CharacterTermInfo,
	TermType,
} from '#shared/domain/term/TermInterfaces.js';
import { Payload } from '#shared/util/apiHelpers.js';
import { TermResponse } from '#shared/api/ModuleResponse.js';

/**
 * A client-side hook for interacting with the GLOSSARY (TERM) API endpoints.
 */
export const useTermApi = () => {
	const MODULE_NAME = MODULE_NAMES.TERM;
	const queryClient = useQueryClient();

	// --- Mutations ---

	const storeSessionTerm = useMutation<{ termId: string }, Error, SessionTermCdo | SessionTermInfo>({
		mutationFn: async (termInfo) => {
			const url = genApiUrl(MODULE_NAME, 'storeSessionTerm');
			const response = await apiClient.post<{ termId: string }>(url, termInfo);
			return response.data;
		},
		onSuccess: (data, variables) => {
			Promise.all([
				queryClient.invalidateQueries({ queryKey: ['getTermsBySessionId', variables.sessionId] }),
				queryClient.invalidateQueries({
					queryKey: ['getTermByKorean', variables.sessionId, variables.koreanTerm, 'session'],
				}),
			]);
		},
	});

	const storeCharacterTerm = useMutation<
		{ termId: string },
		Error,
		CharacterTermCdo | CharacterTermInfo
	>({
		mutationFn: async (termInfo) => {
			const url = genApiUrl(MODULE_NAME, 'storeCharacterTerm');
			const response = await apiClient.post<{ termId: string }>(url, termInfo);
			return response.data;
		},
		onSuccess: (data, variables) => {
			Promise.all([
				queryClient.invalidateQueries({ queryKey: ['getTermsByCharacterId', variables.characterId] }),
				queryClient.invalidateQueries({
					queryKey: ['getTermByKorean', variables.characterId, variables.koreanTerm, 'character'],
				}),
			]);
		},
	});

	const storeSessionTerms = useMutation<
		{ termIds: string[] },
		Error,
		{ terms: (SessionTermCdo | SessionTermInfo)[] }
	>({
		mutationFn: async (variables) => {
			const url = genApiUrl(MODULE_NAME, 'storeSessionTerms');
			const response = await apiClient.post(url, variables);
			return response.data;
		},
		onSuccess: (_, variables) => {
			const sessionIds = [...new Set(variables.terms.map((t) => t.sessionId))];
			const invalidations = sessionIds.map((id) =>
				queryClient.invalidateQueries({ queryKey: ['getTermsBySessionId', id] })
			);
			Promise.all(invalidations);
		},
	});

	const storeCharacterTerms = useMutation<
		{ termIds: string[] },
		Error,
		{ terms: (CharacterTermCdo | CharacterTermInfo)[] }
	>({
		mutationFn: async (variables) => {
			const url = genApiUrl(MODULE_NAME, 'storeCharacterTerms');
			const response = await apiClient.post(url, variables);
			return response.data;
		},
		onSuccess: (_, variables) => {
			const characterIds = [...new Set(variables.terms.map((t) => t.characterId))];
			const invalidations = characterIds.map((id) =>
				queryClient.invalidateQueries({ queryKey: ['getTermsByCharacterId', id] })
			);
			Promise.all(invalidations);
		},
	});

	const ensureAndGetTermsForPrompt = useMutation<
		Record<string, string>,
		Error,
		{ sessionId: string; userId: string; koreanTermsToEnsure: string[] }
	>({
		mutationFn: async (variables) => {
			const url = genApiUrl(MODULE_NAME, 'ensureAndGetTermsForPrompt');
			const response = await apiClient.post<Record<string, string>>(url, variables);
			return response.data;
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ['getTermsBySessionId', variables.sessionId] });
		},
	});

	const clearSessionCache = useMutation<void, Error, string>({
		mutationFn: async (sessionId) => {
			const url = genApiUrl(MODULE_NAME, 'clearSessionCache', [sessionId]);
			await apiClient.delete(url);
		},
		onSuccess: (_, sessionId) => {
			queryClient.invalidateQueries({ queryKey: ['getTermsBySessionId', sessionId] });
		},
	});

	const clearCharacterCache = useMutation<void, Error, string>({
		mutationFn: async (characterId) => {
			const url = genApiUrl(MODULE_NAME, 'clearCharacterCache', [characterId]);
			await apiClient.delete(url);
		},
		onSuccess: (_, characterId) => {
			queryClient.invalidateQueries({ queryKey: ['getTermsByCharacterId', characterId] });
		},
	});

	// --- Queries ---

	const getTermByKorean = (id: string, koreanTerm: string, type: TermType) =>
		useQuery<TermResponse | null, Error>({
			queryKey: ['getTermByKorean', id, koreanTerm, type],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getTermByKorean', [id, koreanTerm, type]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<TermResponse>(response.data.payload);
			},
			enabled: !!id && !!koreanTerm && !!type,
			retry: (failureCount, error: any) => (error.response?.status === 404 ? false : failureCount < 3),
		});

	const getTermsBySessionId = (sessionId: string) =>
		useQuery<TermResponse | null, Error>({
			queryKey: ['getTermsBySessionId', sessionId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getTermsBySessionId', [sessionId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<TermResponse>(response.data.payload);
			},
			enabled: !!sessionId,
		});

	const getTermsByCharacterId = (characterId: string) =>
		useQuery<TermResponse | null, Error>({
			queryKey: ['getTermsByCharacterId', characterId],
			queryFn: async () => {
				const url = genApiUrl(MODULE_NAME, 'getTermsByCharacterId', [characterId]);
				const response = await apiClient.get<Payload>(url);
				return decompressData<TermResponse>(response.data.payload);
			},
			enabled: !!characterId,
		});

	return {
		storeSessionTerm: storeSessionTerm.mutateAsync,
		storeCharacterTerm: storeCharacterTerm.mutateAsync,
		storeSessionTerms: storeSessionTerms.mutateAsync,
		storeCharacterTerms: storeCharacterTerms.mutateAsync,
		getTermByKorean,
		getTermsBySessionId,
		getTermsByCharacterId,
		ensureAndGetTermsForPrompt: ensureAndGetTermsForPrompt.mutateAsync,
		clearSessionCache: clearSessionCache.mutateAsync,
		clearCharacterCache: clearCharacterCache.mutateAsync,
	};
};

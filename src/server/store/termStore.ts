// src/server/services/glossaryService.ts

import { Collection, Where } from 'chromadb'; // Or your specific Collection type
import { COLLECTIONS, METADATA_TYPES } from '#shared/domain/chromadb/index.js';
import { chromaDbClient } from '../db/chromaDbClient.js';
import { TermCdo, TermInfo, TermMetadata } from '#shared/domain/term/TermInterfaces.js';
import { buildTermId } from '../util/buildIdUtils.js';
import {
	flatTermToDoc,
	handleServiceError,
	inflateChatTurnDoc,
	inflateTermDoc,
	validateChromaResponse,
} from '../util/index.js';
import { ChromaResponse, Term, TermResponse } from '#shared/api/ModuleResponse.js';
import { metadataToChatTurn } from '#root/src/shared/util/dbConvertUtils.js';
import { llmService } from '../service/index.js';
import { isTermInfo } from '#root/src/shared/index.js';

const { getTermCollection, upsertRecord, getRecordById, getRecords } = chromaDbClient;
const collectionType = COLLECTIONS.TERM;

export const termStore = {
	_termCollection: null as Collection | null,
	_sessionTermCache: new Map<string, Map<string, TermInfo>>(),

	_getCollection: async (): Promise<Collection> => {
		if (termStore._termCollection) {
			return termStore._termCollection;
		}
		const collection = await getTermCollection();
		termStore._termCollection = collection;
		return collection;
	},

	_constuctTermInfo: (results: ChromaResponse): TermResponse => {
		const { ids, documents, metadatas } = results;
		const { terms, termInfos } = ids.reduce(
			(acc, id, index) => {
				const document = documents[index];
				const metadata = metadatas[index];

				acc.terms.push(inflateTermDoc(document!));
				acc.termInfos.push(metadata! as unknown as TermInfo);

				return acc;
			},
			{ terms: [] as Term[], termInfos: [] as TermInfo[] }
		);

		return {
			ids,
			documents,
			metadatas,
			terms: terms.filter((t) => !!t),
			term: terms[0],
			termInfos: termInfos.filter((t) => !!t),
			termInfo: termInfos[0],
		};
	},

	_getOrBuildSessionTermMap: async (sessionId: string): Promise<Map<string, TermInfo>> => {
		// 1. Check the service-level cache first.
		if (termStore._sessionTermCache.has(sessionId)) {
			console.log(`TermService Cache HIT for session: ${sessionId}`);
			return termStore._sessionTermCache.get(sessionId)!;
		}

		// 2. If not cached (CACHE MISS), fetch from DB and build the map.
		console.log(`TermService Cache MISS for session: ${sessionId}. Building from DB.`);
		const { termInfos } = await termStore.getTermsBySessionId(sessionId);
		const newTermMap = new Map<string, TermInfo>(termInfos.map((info) => [info.koreanTerm, info]));

		// 3. Store the newly built map in the cache for subsequent requests.
		termStore._sessionTermCache.set(sessionId, newTermMap);
		return newTermMap;
	},

	storeTerm: async (termInfo: TermCdo | TermInfo): Promise<void> => {
		const collection = await termStore._getCollection();
		const now = new Date().toISOString();
		const isTerm = isTermInfo(termInfo);

		const metadata: TermMetadata = {
			...termInfo,
			termId: isTerm ? termInfo.termId : buildTermId(termInfo.sessionId),
			type: METADATA_TYPES.TERM,
			initialTerm: termInfo.initialTerm,
			englishTerm: isTerm ? termInfo.englishTerm : termInfo.initialTerm,
			createdAt: isTerm ? termInfo.createdAt : now,
			updatedAt: now,
		};

		const documentForEmbedding = flatTermToDoc(metadata);

		try {
			await chromaDbClient.upsertRecord(collection, metadata.termId, documentForEmbedding, metadata);

			const sessionCache = await termStore._getOrBuildSessionTermMap(metadata.sessionId);
			sessionCache.set(metadata.koreanTerm, metadata);
			console.log(
				`TermService: Updated cache for term "${metadata.koreanTerm}" in session ${metadata.sessionId}.`
			);
		} catch (error: any) {
			handleServiceError(
				error,
				`[termService] Internal error storing term, ${documentForEmbedding}`,
				`Failed to store term for session ${termInfo.sessionId}`
			);
		}
	},

	getTermByKorean: async (sessionId: string, koreanTerm: string): Promise<TermResponse> => {
		const collection = await termStore._getCollection();
		const where: Where = {
			$and: [
				{ type: { $eq: METADATA_TYPES.TERM } },
				{ koreanTerm: { $eq: koreanTerm } }, // Query by the specific metadata field
				{ sessionId: { $eq: sessionId } }, // Ensure it matches the sessionId
			],
		};
		try {
			const rawResults = await chromaDbClient.getRecords(collection, where, 1); // Expecting one or none
			const results = validateChromaResponse(rawResults, 'getOne', collectionType); // Adapt validation if needed
			return termStore._constuctTermInfo(results);
		} catch (error: any) {
			handleServiceError(
				error,
				'An internal error occurred while fetching glossary entry by Korean term.',
				`Failed to get glossary entry for '${koreanTerm}'`
			);
		}
	},

	getTermsBySessionId: async (sessionId: string): Promise<TermResponse> => {
		const collection = await termStore._getCollection();
		const where: Where = {
			$and: [
				{ type: { $eq: METADATA_TYPES.TERM } },
				{ sessionId: { $eq: sessionId } }, // Ensure it matches the sessionId
			],
		};
		try {
			const rawResults = await chromaDbClient.getRecords(collection, where); // Expecting one or none
			const results = validateChromaResponse(rawResults, 'getList', collectionType); // Adapt validation if needed
			return termStore._constuctTermInfo(results);
		} catch (error: any) {
			handleServiceError(
				error,
				'An internal error occurred while fetching glossary entry by Korean term.',
				`Failed to get glossary entry for session '${sessionId}`
			);
		}
	},

	ensureAndGetTermsForPrompt: async (
		sessionId: string,
		koreanTermsToEnsure: string[]
	): Promise<Map<string, string>> => {
		const sessionTermMap = await termStore._getOrBuildSessionTermMap(sessionId);
		const termsForPromptMap = new Map<string, string>();

		for (const koreanTerm of new Set(koreanTermsToEnsure)) {
			if (!koreanTerm || koreanTerm.trim() === '') continue;

			if (sessionTermMap.has(koreanTerm)) {
				const termInfo = sessionTermMap.get(koreanTerm)!;
				termsForPromptMap.set(koreanTerm, termInfo.englishTerm);
			} else {
				console.log(
					`TermService: Term "${koreanTerm}" not found in cache for session ${sessionId}. Auto-translating.`
				);
				const initialTerm = await llmService.translateProperNoun(koreanTerm);

				if (initialTerm && initialTerm.trim() !== '') {
					const newTermCdo: TermCdo = { sessionId, koreanTerm, initialTerm, termId: '' };
					try {
						await termStore.storeTerm(newTermCdo);
						termsForPromptMap.set(koreanTerm, initialTerm);
					} catch (storeError) {
						console.error(`Failed to auto-insert term "${koreanTerm}":`, storeError);
						continue;
					}
				} else {
					console.warn(`LLM translation for "${koreanTerm}" was empty.`);
				}
			}
		}
		return termsForPromptMap;
	},

	clearSessionCache: (sessionId: string): void => {
		termStore._sessionTermCache.delete(sessionId);
		console.log(`TermService: Cleared cache for session ${sessionId}.`);
	},

	/**
	 * Clear collection cache
	 */
	clearCollectionCache: (): void => {
		console.log('[termService] Clearing cached recap collection.');
		termStore._termCollection = null;
	},
};

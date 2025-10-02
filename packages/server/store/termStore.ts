// src/server/services/termStore.ts

import { ChromaResponse, TermResponse, Term } from '@rita-berenice/shared/api';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import {
	CharacterTermInfo,
	SessionTermInfo,
	CharacterTermCdo,
	CharacterTermMetadata,
	SessionTermCdo,
	SessionTermMetadata,
	TermType,
} from '@rita-berenice/shared/domain';
import {
	isCharacterTermInfo,
	buildCharacterTermId,
	isSessionTermInfo,
	parseSessionId,
	buildSessionTermId,
} from '@rita-berenice/shared/util';
import { Collection, Where } from 'chromadb';
import { COLLECTIONS, toChromaMetadata } from '../db/chroma.type.js';
import chromaDbClient from '../db/chromaDbClient.js';
import { llmService } from '../service/llmService.js';
import { inflateTermDoc, flatTermToDoc } from '../util/documentUtils.js';
import { handleServiceError, validateChromaResponse } from '../util/serviceHelpers.js';

const { getTermCollection } = chromaDbClient;
const collectionType = COLLECTIONS.TERM;

export const termStore = {
	_termCollection: null as Collection | null,
	_characterTermCache: new Map<string, Map<string, CharacterTermInfo>>(),
	_sessionTermCache: new Map<string, Map<string, SessionTermInfo>>(),

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
		const { terms, characterTermInfos, sessionTermInfos } = ids.reduce(
			(acc, id, index) => {
				const document = documents[index];
				const metadata = metadatas[index];

				acc.terms.push(inflateTermDoc(document!));
				metadata?.type === 'character'
					? acc.characterTermInfos.push(metadata! as unknown as CharacterTermInfo)
					: acc.sessionTermInfos.push(metadata! as unknown as SessionTermInfo);

				return acc;
			},
			{
				terms: [] as Term[],
				characterTermInfos: [] as CharacterTermInfo[],
				sessionTermInfos: [] as SessionTermInfo[],
			}
		);

		return {
			ids,
			documents,
			metadatas,
			terms: terms.filter((t) => !!t),
			term: terms[0],
			characterTermInfos: characterTermInfos.filter((t) => !!t),
			sessionTermInfos: sessionTermInfos.filter((t) => !!t),
		};
	},

	_getOrBuildCharacterTermMap: async (
		characterId: string
	): Promise<Map<string, CharacterTermInfo>> => {
		// 1. Check the service-level cache first.
		if (termStore._characterTermCache.has(characterId)) {
			console.log(`TermService Cache HIT for character: ${characterId}`);
			return termStore._characterTermCache.get(characterId)!;
		}

		// 2. If not cached (CACHE MISS), fetch from DB and build the map.
		console.log(`TermService Cache MISS for character: ${characterId}. Building from DB.`);
		const { characterTermInfos } = await termStore.getTermsByCharacterId(characterId);
		const newTermMap = new Map<string, CharacterTermInfo>(
			characterTermInfos.map((info) => [info.koreanTerm, info])
		);

		// 3. Store the newly built map in the cache for subsequent requests.
		termStore._characterTermCache.set(characterId, newTermMap);
		return newTermMap;
	},

	_getOrBuildSessionTermMap: async (sessionId: string): Promise<Map<string, SessionTermInfo>> => {
		// 1. Check the service-level cache first.
		if (termStore._sessionTermCache.has(sessionId)) {
			console.log(`TermService Cache HIT for session: ${sessionId}`);
			return termStore._sessionTermCache.get(sessionId)!;
		}

		// 2. If not cached (CACHE MISS), fetch from DB and build the map.
		console.log(`TermService Cache MISS for session: ${sessionId}. Building from DB.`);
		const { sessionTermInfos } = await termStore.getTermsBySessionId(sessionId);
		const newTermMap = new Map<string, SessionTermInfo>(
			sessionTermInfos.map((info) => [info.koreanTerm, info])
		);

		// 3. Store the newly built map in the cache for subsequent requests.
		termStore._sessionTermCache.set(sessionId, newTermMap);
		return newTermMap;
	},

	storeCharacterTerm: async (
		termInfo: CharacterTermCdo | CharacterTermInfo
	): Promise<{ termId: string }> => {
		const collection = await termStore._getCollection();
		const now = new Date().toISOString();
		const isTerm = isCharacterTermInfo(termInfo);

		const metadata: CharacterTermMetadata = {
			...termInfo,
			termId: isTerm ? termInfo.termId : buildCharacterTermId(termInfo.characterId),
			type: METADATA_TYPES.CHARACTER,
			initialTerm: termInfo.initialTerm,
			englishTerm: isTerm ? termInfo.englishTerm : termInfo.initialTerm,
			createdAt: isTerm ? termInfo.createdAt : now,
			updatedAt: now,
		};

		const documentForEmbedding = flatTermToDoc(metadata);

		try {
			const chromaMetadata = toChromaMetadata(metadata);
			await chromaDbClient.upsertRecord(
				collection,
				metadata.termId,
				documentForEmbedding,
				chromaMetadata
			);

			const sessionCache = await termStore._getOrBuildCharacterTermMap(metadata.characterId);
			sessionCache.set(metadata.koreanTerm, metadata);
			console.log(
				`TermService: Updated cache for term "${metadata.koreanTerm}" in character ${metadata.characterId}.`
			);
			return { termId: metadata.termId };
		} catch (error: any) {
			handleServiceError(
				error,
				`[termService] Internal error storing term, ${documentForEmbedding}`,
				`Failed to store term for character ${termInfo.characterId}`
			);
		}
	},

	/**
	 * Stores multiple glossary terms in a single bulk operation.
	 * @param terms An array of TermCdo or TermInfo objects.
	 */
	storeCharacterTerms: async (
		terms: (CharacterTermCdo | CharacterTermInfo)[]
	): Promise<{ termIds: string[] }> => {
		if (!terms || terms.length === 0) {
			return { termIds: [] };
		}
		const collection = await termStore._getCollection();
		const now = new Date().toISOString();

		const recordsToUpsert = terms.map((termInfo) => {
			const isTerm = isCharacterTermInfo(termInfo);

			const metadata: CharacterTermMetadata = {
				...termInfo,
				termId: isTerm ? termInfo.termId : buildCharacterTermId(termInfo.characterId),
				type: METADATA_TYPES.CHARACTER,
				initialTerm: termInfo.initialTerm,
				englishTerm: isTerm ? termInfo.englishTerm : termInfo.initialTerm,
				createdAt: isTerm ? termInfo.createdAt : now,
				updatedAt: now,
			};
			const document = flatTermToDoc(metadata);
			return { id: metadata.termId, document, metadata };
		});

		try {
			await chromaDbClient.upsertRecords(
				collection,
				recordsToUpsert.map((r) => r.id),
				recordsToUpsert.map((r) => r.document),
				recordsToUpsert.map((r) => toChromaMetadata(r.metadata))
			);

			// Group terms by session to update caches efficiently
			const termsByCharacter = new Map<string, CharacterTermMetadata[]>();
			for (const record of recordsToUpsert) {
				const { characterId } = record.metadata;
				if (!termsByCharacter.has(characterId)) {
					termsByCharacter.set(characterId, []);
				}
				termsByCharacter.get(characterId)!.push(record.metadata);
			}

			// Update the session cache for each affected session
			for (const [characterId, characterTerms] of termsByCharacter.entries()) {
				const characterCache = await termStore._getOrBuildCharacterTermMap(characterId);
				for (const term of characterTerms) {
					characterCache.set(term.koreanTerm, term);
				}
				console.log(
					`TermService: Bulk updated cache for ${characterTerms.length} terms in session ${characterId}.`
				);
			}
			return { termIds: recordsToUpsert.map((r) => r.id) };
		} catch (error: any) {
			handleServiceError(
				error,
				`[termService] Internal error during bulk storing of ${terms.length} terms.`,
				`Failed to bulk store terms.`
			);
		}
	},

	storeSessionTerm: async (
		termInfo: SessionTermCdo | SessionTermInfo
	): Promise<{ termId: string }> => {
		const collection = await termStore._getCollection();
		const now = new Date().toISOString();
		const isTerm = isSessionTermInfo(termInfo);
		const { characterId } = parseSessionId(termInfo.sessionId);

		const metadata: SessionTermMetadata = {
			...termInfo,
			characterId,
			termId: isTerm ? termInfo.termId : buildSessionTermId(termInfo.sessionId),
			type: METADATA_TYPES.SESSION,
			initialTerm: termInfo.initialTerm,
			englishTerm: isTerm ? termInfo.englishTerm : termInfo.initialTerm,
			createdAt: isTerm ? termInfo.createdAt : now,
			updatedAt: now,
		};

		const documentForEmbedding = flatTermToDoc(metadata);

		try {
			const chromaMetadata = toChromaMetadata(metadata);
			await chromaDbClient.upsertRecord(
				collection,
				metadata.termId,
				documentForEmbedding,
				chromaMetadata
			);

			const sessionCache = await termStore._getOrBuildSessionTermMap(metadata.sessionId);
			sessionCache.set(metadata.koreanTerm, metadata);
			console.log(
				`TermService: Updated cache for term "${metadata.koreanTerm}" in session ${metadata.sessionId}.`
			);
			return { termId: metadata.termId };
		} catch (error: any) {
			handleServiceError(
				error,
				`[termService] Internal error storing term, ${documentForEmbedding}`,
				`Failed to store term for session ${termInfo.sessionId}`
			);
		}
	},

	/**
	 * Stores multiple glossary terms in a single bulk operation.
	 * @param terms An array of TermCdo or TermInfo objects.
	 */
	storeSessionTerms: async (
		terms: (SessionTermCdo | SessionTermInfo)[]
	): Promise<{ termIds: string[] }> => {
		if (!terms || terms.length === 0) {
			return { termIds: [] };
		}
		const collection = await termStore._getCollection();
		const now = new Date().toISOString();

		const recordsToUpsert = terms.map((termInfo) => {
			const isTerm = isSessionTermInfo(termInfo);
			const { characterId } = parseSessionId(termInfo.sessionId);

			const metadata: SessionTermMetadata = {
				...termInfo,
				characterId,
				termId: isTerm ? termInfo.termId : buildSessionTermId(termInfo.sessionId),
				type: METADATA_TYPES.SESSION,
				initialTerm: termInfo.initialTerm,
				englishTerm: isTerm ? termInfo.englishTerm : termInfo.initialTerm,
				createdAt: isTerm ? termInfo.createdAt : now,
				updatedAt: now,
			};
			const document = flatTermToDoc(metadata);
			return { id: metadata.termId, document, metadata };
		});

		try {
			await chromaDbClient.upsertRecords(
				collection,
				recordsToUpsert.map((r) => r.id),
				recordsToUpsert.map((r) => r.document),
				recordsToUpsert.map((r) => toChromaMetadata(r.metadata))
			);

			// Group terms by session to update caches efficiently
			const termsBySession = new Map<string, SessionTermMetadata[]>();
			for (const record of recordsToUpsert) {
				const { sessionId } = record.metadata;
				if (!termsBySession.has(sessionId)) {
					termsBySession.set(sessionId, []);
				}
				termsBySession.get(sessionId)!.push(record.metadata);
			}

			// Update the session cache for each affected session
			for (const [sessionId, sessionTerms] of termsBySession.entries()) {
				const sessionCache = await termStore._getOrBuildSessionTermMap(sessionId);
				for (const term of sessionTerms) {
					sessionCache.set(term.koreanTerm, term);
				}
				console.log(
					`TermService: Bulk updated cache for ${sessionTerms.length} terms in session ${sessionId}.`
				);
			}
			return { termIds: recordsToUpsert.map((r) => r.id) };
		} catch (error: any) {
			handleServiceError(
				error,
				`[termService] Internal error during bulk storing of ${terms.length} terms.`,
				`Failed to bulk store terms.`
			);
		}
	},

	getTermByKorean: async (id: string, koreanTerm: string, type: TermType): Promise<TermResponse> => {
		const collection = await termStore._getCollection();
		const whereCondition: Where =
			type === 'character'
				? { $and: [{ type: { $eq: METADATA_TYPES.CHARACTER } }, { characterId: { $eq: id } }] }
				: { $and: [{ type: { $eq: METADATA_TYPES.SESSION } }, { sessionId: { $eq: id } }] };

		const where: Where = { $and: [{ koreanTerm: { $eq: koreanTerm } }, whereCondition] };

		try {
			const rawResults = await chromaDbClient.getRecords(collection, where, undefined, 1); // Expecting one or none
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

	getTermsByCharacterId: async (characterId: string): Promise<TermResponse> => {
		const collection = await termStore._getCollection();
		const where: Where = {
			$and: [
				{ type: { $eq: METADATA_TYPES.CHARACTER } },
				{ characterId: { $eq: characterId } }, // Ensure it matches the sessionId
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
				`Failed to get glossary entry for character '${characterId}`
			);
		}
	},

	getTermsBySessionId: async (sessionId: string): Promise<TermResponse> => {
		const collection = await termStore._getCollection();
		const where: Where = {
			$and: [
				{ type: { $eq: METADATA_TYPES.SESSION } },
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
		userId: string,
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
				const initialTerm = await llmService.translateProperNoun(koreanTerm, userId);

				if (initialTerm && initialTerm.trim() !== '') {
					const newTermCdo: SessionTermCdo = { sessionId, koreanTerm, initialTerm };
					try {
						await termStore.storeSessionTerm(newTermCdo);
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

	clearCharacterCache: (characterId: string): void => {
		termStore._characterTermCache.delete(characterId);
		console.log(`TermService: Cleared cache for character ${characterId}.`);
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

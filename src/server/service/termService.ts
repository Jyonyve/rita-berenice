// src/server/services/glossaryService.ts

import { Collection, Where } from 'chromadb'; // Or your specific Collection type
import { COLLECTIONS, METADATA_TYPES } from '#shared/domain/chromadb/index.ts';
import { chromaDbClient } from '../db/chromaDbClient.ts';
import { TermCdo, TermInfo, TermMetadata } from '#shared/domain/term/TermInterfaces.ts';
import { buildTermId } from '../util/buildIdUtils.ts';
import {
	flatTermToDoc,
	handleServiceError,
	inflateChatTurnDoc,
	inflateTermDoc,
	validateChromaResponse,
} from '../util/index.ts';
import { ChromaResponse, Term, TermResponse } from '#shared/api/ModuleResponse.ts';
import { metadataToChatTurn } from '#root/src/shared/util/dbConvertUtils.ts';

const { getTermCollection, upsertRecord, getRecordById, getRecords } = chromaDbClient;
const collectionType = COLLECTIONS.TERM;

export const termService = {
	_termCollection: null as Collection | null,

	_getCollection: async (): Promise<Collection> => {
		if (termService._termCollection) {
			return termService._termCollection;
		}
		const collection = await getTermCollection();
		termService._termCollection = collection;
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

	storeTerm: async (termInfo: TermInfo): Promise<void> => {
		const collection = await termService._getCollection();
		const now = new Date().toISOString();

		const termId = termInfo.termId || buildTermId(termInfo.sessionId); // Generate a new ID if not provided
		const metadata: TermMetadata = {
			...termInfo,
			termId,
			type: METADATA_TYPES.TERM,
			initialTerm: termInfo.initialTerm || termInfo.englishTerm,
			createdAt: termInfo.createdAt || now,
			updatedAt: now,
		};

		const documentForEmbedding = flatTermToDoc(termInfo);

		try {
			await chromaDbClient.upsertRecord(collection, termId, documentForEmbedding, metadata);
		} catch (error: any) {
			handleServiceError(
				error,
				`[termService] Internal error storing term, ${documentForEmbedding}`,
				`Failed to store term for session ${termInfo.sessionId}`
			);
		}
	},

	getTermByKorean: async (sessionId: string, koreanTerm: string): Promise<TermResponse> => {
		const collection = await termService._getCollection();
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
			return termService._constuctTermInfo(results);
		} catch (error: any) {
			handleServiceError(
				error,
				'An internal error occurred while fetching glossary entry by Korean term.',
				`Failed to get glossary entry for '${koreanTerm}'`
			);
		}
	},

	getTermsBySessionId: async (sessionId: string): Promise<TermResponse> => {
		const collection = await termService._getCollection();
		const where: Where = {
			$and: [
				{ type: { $eq: METADATA_TYPES.TERM } },
				{ sessionId: { $eq: sessionId } }, // Ensure it matches the sessionId
			],
		};
		try {
			const rawResults = await chromaDbClient.getRecords(collection, where); // Expecting one or none
			const results = validateChromaResponse(rawResults, 'getList', collectionType); // Adapt validation if needed
			return termService._constuctTermInfo(results);
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
		// llmService is imported directly now
	): Promise<Map<string, string>> => {
		// Maps Korean term to its official English term for the prompt
		const termsForPromptMap = new Map<string, string>();

		for (const korTerm of koreanTermsToEnsure) {
			if (!korTerm || korTerm.trim() === '') continue;

			let termToUse: TermInfo | null = await termService.getTermByKorean(sessionId, korTerm);

			if (!termToUse) {
				// Term not found, auto-translate and insert
				console.log(
					`TermService: Term "${korTerm}" not found for session ${sessionId}. Auto-translating.`
				);
				// Call llmService to translate this specific Korean term
				const initialEnglishTranslation = await llmService.translateProperNoun(korTerm); // llmService needs this method

				if (initialEnglishTranslation && initialEnglishTranslation.trim() !== '') {
					const newTermCdo: TermCdo = {
						sessionId,
						characterId, // Pass characterId
						koreanTerm: korTerm,
						englishTerm: initialEnglishTranslation,
						initialLlmEnglishTerm: initialEnglishTranslation,
						// type, createdAt, updatedAt will be handled by storeTerm or TermInfo constructor
					};
					try {
						termToUse = await termService.storeTerm(newTermCdo);
						console.log(
							`TermService: Auto-inserted new term "${korTerm}" -> "${termToUse.englishTerm}" for session ${sessionId}.`
						);
					} catch (storeError) {
						console.error(
							`TermService: Failed to auto-insert term "${korTerm}" for session ${sessionId}:`,
							storeError
						);
						// Decide how to handle: skip this term, use a fallback, or rethrow
						continue; // Skip this term for prompt guidance if storage fails
					}
				} else {
					console.warn(`TermService: LLM translation for "${korTerm}" was empty. Skipping for prompt.`);
					continue;
				}
			}
			// If termToUse is now populated (either found or newly created)
			if (termToUse && termToUse.englishTerm) {
				termsForPromptMap.set(korTerm, termToUse.englishTerm);
			}
		}
		return termsForPromptMap;
	},
};

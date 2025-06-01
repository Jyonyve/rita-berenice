// src/server/services/glossaryService.ts

import { Collection, Where } from 'chromadb'; // Or your specific Collection type
import { COLLECTIONS, METADATA_TYPES } from '#shared/domain/chromadb/index.ts';
import { chromaDbClient } from '../db/chromaDbClient.ts';
import { TermInfo, TermMetadata } from '#shared/domain/term/TermInterfaces.ts';
import { buildTermId } from '../util/buildIdUtils.ts';
import {
	flatTermToDoc,
	handleServiceError,
	inflateChatTurnDoc,
	inflateTermDoc,
	validateChromaResponse,
} from '../util/index.ts';
import { ChromaResponse, TermResponse } from '#shared/api/ModuleResponse.ts';
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

	_constuctPartialTermInfo: (results: ChromaResponse): TermResponse => {
		const { ids, documents, metadatas } = results;
		const terms = ids.map((id, index) => {
			const metadata = metadatas[index];
			const document = documents[index];
			const term = inflateTermDoc(document!);
			return term;
		});
		return { ids, documents, metadatas, terms, term: terms[0] || null };
	},

	storeTerm: async (termInfo: TermInfo): Promise<void> => {
		const collection = await termService._getCollection();
		const now = new Date().toISOString();

		const termId = termInfo.termId || buildTermId(termInfo.sessionId); // Generate a new ID if not provided

		const metadata: TermMetadata = {
			...termInfo,
			termId,
			type: METADATA_TYPES.TERM,
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

	getTermByKorean: async (koreanTerm: string, sessionId: string): Promise<TermResponse> => {
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
			const { ids, documents, metadatas } = results;
			const term = JSON.parse(documents[0]!);
			return { ids, documents, metadatas, term, terms: [term] };
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
			return termService._constuctPartialTermInfo(results);
		} catch (error: any) {
			handleServiceError(
				error,
				'An internal error occurred while fetching glossary entry by Korean term.',
				`Failed to get glossary entry for session '${sessionId}`
			);
		}
	},
	// Add other methods as needed: getAllEntries, updateEntry, deleteEntry, etc.
};

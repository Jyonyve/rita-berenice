import { and, desc, eq, sql } from 'drizzle-orm';
import {
	ApiError,
	documentInfoSchema,
	type DocumentDraftRewrite,
	type DocumentDraftUpdate,
	type DocumentInfo,
} from '@rita-berenice/shared/domain';
import { buildDocumentId } from '@rita-berenice/shared/util';
import { getDatabase } from '../db/postgresClient.js';
import { documents } from '../db/schema.js';
import {
	deleteMemoryEmbeddings,
	type QueryEmbeddingCache,
	searchMemoryEmbeddings,
} from '../service/embeddingService.js';
import type { RagTraceContext } from '../util/ragTraceUtils.js';
import { embeddingJobService } from '../service/embeddingJobService.js';

export type CreateDocumentDraftInput = Pick<
	DocumentInfo,
	| 'userId'
	| 'sessionId'
	| 'characterId'
	| 'origin'
	| 'title'
	| 'body'
	| 'documentKind'
	| 'issuer'
	| 'viewpoint'
	| 'claimMode'
	| 'eventKey'
	| 'timelineOrder'
	| 'inWorldTime'
	| 'groundingMode'
	| 'requestText'
	| 'sourceRefs'
	| 'modelName'
	| 'promptVersion'
	| 'includeInRag'
>;

const normalizeDocumentInfo = (document: DocumentInfo): DocumentInfo =>
	documentInfoSchema.parse(document);

const getOwnedDocument = async (documentId: string, userId: string): Promise<DocumentInfo> => {
	const row = await getDatabase().query.documents.findFirst({
		where: and(eq(documents.documentId, documentId), eq(documents.userId, userId)),
	});
	if (!row) throw new ApiError(404, `Document '${documentId}' was not found.`);
	return normalizeDocumentInfo(row.data);
};

export const documentToEmbeddingContent = (document: DocumentInfo): string =>
	[
		`In-world document: ${document.title}`,
		document.documentKind ? `Document type: ${document.documentKind}` : undefined,
		document.issuer ? `Issuer: ${document.issuer}` : undefined,
		document.viewpoint ? `Viewpoint: ${document.viewpoint}` : undefined,
		`Claim mode: ${document.claimMode ?? 'unknown'}`,
		document.eventKey ? `Event identity: ${document.eventKey}` : undefined,
		document.timelineOrder !== undefined
			? `In-world timeline order: ${document.timelineOrder}`
			: undefined,
		document.inWorldTime ? `In-world time: ${document.inWorldTime}` : undefined,
		`Grounding: ${document.groundingMode}`,
		'',
		document.body,
	]
		.filter((line): line is string => line !== undefined)
		.join('\n');

export const applyDocumentDraftUpdate = (
	document: DocumentInfo,
	input: DocumentDraftUpdate,
	updatedAt: string
): DocumentInfo => {
	if (document.status !== 'draft') {
		throw new ApiError(409, 'Only draft documents can be edited.');
	}
	if (document.revision !== input.expectedRevision) {
		throw new ApiError(409, 'This document changed after it was opened. Reload it before editing.');
	}

	return {
		...document,
		...(input.title !== undefined ? { title: input.title } : {}),
		...(input.body !== undefined ? { body: input.body } : {}),
		...(input.documentKind !== undefined ? { documentKind: input.documentKind || undefined } : {}),
		...(input.issuer !== undefined ? { issuer: input.issuer || undefined } : {}),
		...(input.viewpoint !== undefined ? { viewpoint: input.viewpoint || undefined } : {}),
		...(input.claimMode !== undefined ? { claimMode: input.claimMode } : {}),
		...(input.eventKey !== undefined ? { eventKey: input.eventKey || undefined } : {}),
		...(input.timelineOrder !== undefined ? { timelineOrder: input.timelineOrder ?? undefined } : {}),
		...(input.inWorldTime !== undefined ? { inWorldTime: input.inWorldTime || undefined } : {}),
		...(input.includeInRag !== undefined ? { includeInRag: input.includeInRag } : {}),
		revision: document.revision + 1,
		updatedAt,
	};
};

export type ApplyDocumentDraftRewriteInput = Pick<
	DocumentInfo,
	| 'title'
	| 'body'
	| 'documentKind'
	| 'issuer'
	| 'viewpoint'
	| 'claimMode'
	| 'eventKey'
	| 'timelineOrder'
	| 'inWorldTime'
	| 'groundingMode'
	| 'requestText'
	| 'sourceRefs'
	| 'modelName'
	| 'promptVersion'
>;

export const applyDocumentDraftRewrite = (
	document: DocumentInfo,
	input: DocumentDraftRewrite,
	rewrite: ApplyDocumentDraftRewriteInput,
	updatedAt: string
): DocumentInfo => {
	if (document.status !== 'draft') {
		throw new ApiError(409, 'Only draft documents can be edited.');
	}
	if (document.revision !== input.expectedRevision) {
		throw new ApiError(409, 'This document changed after it was opened. Reload it before editing.');
	}

	return {
		...document,
		...rewrite,
		origin: 'generated',
		status: 'draft',
		retrievalEnabled: false,
		includeInRag: document.includeInRag,
		revision: document.revision + 1,
		updatedAt,
	};
};

export const applyDocumentApproval = (document: DocumentInfo, updatedAt: string): DocumentInfo => {
	if (document.status !== 'draft') throw new ApiError(409, 'Only draft documents can be approved.');
	if (!document.body.trim())
		throw new ApiError(400, 'A document must have content before approval.');
	const includeInRag = document.includeInRag ?? document.retrievalEnabled;
	return {
		...document,
		status: 'approved',
		retrievalEnabled: includeInRag,
		includeInRag,
		revision: document.revision + 1,
		updatedAt,
	};
};

export const applyDocumentRetrievalPreference = (
	document: DocumentInfo,
	enabled: boolean,
	updatedAt: string
): DocumentInfo => {
	if (document.status !== 'approved') {
		throw new ApiError(409, 'Only approved documents can change retrieval eligibility.');
	}
	if (document.retrievalEnabled === enabled && document.includeInRag === enabled) return document;
	return {
		...document,
		includeInRag: enabled,
		retrievalEnabled: enabled,
		revision: document.revision + 1,
		updatedAt,
	};
};

export const applyDocumentArchive = (document: DocumentInfo, updatedAt: string): DocumentInfo =>
	document.status === 'archived'
		? document
		: {
				...document,
				status: 'archived',
				retrievalEnabled: false,
				revision: document.revision + 1,
				updatedAt,
			};

export interface DocumentRetrievalScope {
	userId: string;
	sessionId: string;
	characterId: string;
}

export interface DocumentRetrievalRow extends DocumentRetrievalScope {
	documentId: string;
	origin: string;
	status: string;
	retrievalEnabled: boolean;
	data: DocumentInfo;
}

export const hydrateEligibleDocuments = (
	rows: DocumentRetrievalRow[],
	results: { sourceId: string }[],
	scope: DocumentRetrievalScope
): DocumentInfo[] => {
	const eligibleById = new Map<string, DocumentInfo>();
	for (const row of rows) {
		if (
			row.userId !== scope.userId ||
			row.sessionId !== scope.sessionId ||
			row.characterId !== scope.characterId ||
			row.status !== 'approved' ||
			!row.retrievalEnabled
		) {
			continue;
		}
		eligibleById.set(row.documentId, {
			...normalizeDocumentInfo(row.data),
			documentId: row.documentId,
			userId: row.userId,
			sessionId: row.sessionId,
			characterId: row.characterId,
			origin: row.origin as DocumentInfo['origin'],
			status: 'approved',
			retrievalEnabled: true,
			includeInRag: true,
		});
	}
	return results
		.map((result) => eligibleById.get(result.sourceId))
		.filter((document): document is DocumentInfo => Boolean(document));
};

export const documentStore = {
	createDraft: async (input: CreateDocumentDraftInput): Promise<DocumentInfo> => {
		const now = new Date().toISOString();
		const document: DocumentInfo = {
			...input,
			documentId: buildDocumentId(input.sessionId),
			status: 'draft',
			retrievalEnabled: false,
			includeInRag: input.includeInRag,
			revision: 1,
			createdAt: now,
			updatedAt: now,
		};
		await getDatabase()
			.insert(documents)
			.values({
				documentId: document.documentId,
				userId: document.userId,
				sessionId: document.sessionId,
				characterId: document.characterId,
				origin: document.origin,
				status: document.status,
				retrievalEnabled: false,
				data: document,
				createdAt: now,
				updatedAt: now,
			});
		return document;
	},

	getDocument: getOwnedDocument,

	getDocumentsBySession: async (sessionId: string, userId: string): Promise<DocumentInfo[]> => {
		const rows = await getDatabase()
			.select({ data: documents.data })
			.from(documents)
			.where(and(eq(documents.sessionId, sessionId), eq(documents.userId, userId)))
			.orderBy(desc(documents.updatedAt));
		return rows.map((row) => normalizeDocumentInfo(row.data));
	},

	queryApproved: async (
		sessionId: string,
		userId: string,
		characterId: string,
		queryTexts: string[],
		limit = 5,
		queryEmbeddingCache?: QueryEmbeddingCache,
		ragTraceContext?: RagTraceContext
	): Promise<DocumentInfo[]> => {
		const rows = await getDatabase()
			.select({
				documentId: documents.documentId,
				userId: documents.userId,
				sessionId: documents.sessionId,
				characterId: documents.characterId,
				origin: documents.origin,
				status: documents.status,
				retrievalEnabled: documents.retrievalEnabled,
				data: documents.data,
			})
			.from(documents)
			.where(
				and(
					eq(documents.sessionId, sessionId),
					eq(documents.userId, userId),
					eq(documents.characterId, characterId),
					eq(documents.status, 'approved'),
					eq(documents.retrievalEnabled, true)
				)
			);
		if (!rows.length) return [];
		const scope = { sessionId, userId, characterId };
		const candidates = hydrateEligibleDocuments(
			rows,
			rows.map((row) => ({ sourceId: row.documentId })),
			scope
		);
		const results = await searchMemoryEmbeddings(
			queryTexts,
			{
				sourceType: 'document',
				userId,
				sessionId,
				characterId,
				sourceIds: candidates.map((item) => item.documentId),
			},
			limit,
			queryEmbeddingCache,
			ragTraceContext
		);
		return hydrateEligibleDocuments(rows, results, scope);
	},

	updateDraft: async (
		documentId: string,
		userId: string,
		input: DocumentDraftUpdate
	): Promise<DocumentInfo> => {
		const current = await getOwnedDocument(documentId, userId);
		const next = applyDocumentDraftUpdate(current, input, new Date().toISOString());
		const rows = await getDatabase()
			.update(documents)
			.set({ data: next, updatedAt: next.updatedAt })
			.where(
				and(
					eq(documents.documentId, documentId),
					eq(documents.userId, userId),
					eq(documents.status, 'draft'),
					sql`(${documents.data}->>'revision')::integer = ${input.expectedRevision}`
				)
			)
			.returning({ data: documents.data });
		if (!rows[0]) throw new ApiError(409, 'The document is no longer editable.');
		return rows[0].data;
	},

	rewriteDraft: async (
		documentId: string,
		userId: string,
		input: DocumentDraftRewrite,
		rewrite: ApplyDocumentDraftRewriteInput
	): Promise<DocumentInfo> => {
		const current = await getOwnedDocument(documentId, userId);
		const next = applyDocumentDraftRewrite(current, input, rewrite, new Date().toISOString());
		const rows = await getDatabase()
			.update(documents)
			.set({ data: next, updatedAt: next.updatedAt })
			.where(
				and(
					eq(documents.documentId, documentId),
					eq(documents.userId, userId),
					eq(documents.status, 'draft'),
					sql`(${documents.data}->>'revision')::integer = ${input.expectedRevision}`
				)
			)
			.returning({ data: documents.data });
		if (!rows[0]) throw new ApiError(409, 'The document is no longer editable.');
		return rows[0].data;
	},

	approve: async (documentId: string, userId: string): Promise<DocumentInfo> => {
		const current = await getOwnedDocument(documentId, userId);
		const now = new Date().toISOString();
		const approved = applyDocumentApproval(current, now);
		const rows = await getDatabase()
			.update(documents)
			.set({
				status: 'approved',
				retrievalEnabled: approved.retrievalEnabled,
				data: approved,
				updatedAt: now,
			})
			.where(
				and(
					eq(documents.documentId, documentId),
					eq(documents.userId, userId),
					eq(documents.status, 'draft')
				)
			)
			.returning({ data: documents.data });
		if (!rows[0]) throw new ApiError(409, 'The document is no longer awaiting approval.');

		if (approved.retrievalEnabled)
			embeddingJobService.enqueue({
				sourceType: 'document',
				sourceId: documentId,
				contentType: 'in-world-document',
				userId,
				characterId: approved.characterId,
				sessionId: approved.sessionId,
				content: documentToEmbeddingContent(approved),
				metadata: {
					title: approved.title,
					origin: approved.origin,
					groundingMode: approved.groundingMode,
					issuer: approved.issuer ?? null,
					viewpoint: approved.viewpoint ?? null,
					claimMode: approved.claimMode ?? 'unknown',
					eventKey: approved.eventKey ?? null,
					timelineOrder: approved.timelineOrder ?? null,
					inWorldTime: approved.inWorldTime ?? null,
				},
			});
		return rows[0].data;
	},

	setRetrievalPreference: async (
		documentId: string,
		userId: string,
		enabled: boolean
	): Promise<DocumentInfo> => {
		const current = await getOwnedDocument(documentId, userId);
		const now = new Date().toISOString();
		const updated = applyDocumentRetrievalPreference(current, enabled, now);
		if (updated === current) return current;
		const rows = await getDatabase()
			.update(documents)
			.set({ retrievalEnabled: enabled, data: updated, updatedAt: now })
			.where(
				and(
					eq(documents.documentId, documentId),
					eq(documents.userId, userId),
					eq(documents.status, 'approved')
				)
			)
			.returning({ data: documents.data });
		if (!rows[0]) throw new ApiError(409, 'The document retrieval setting changed concurrently.');

		if (enabled) {
			embeddingJobService.enqueue({
				sourceType: 'document',
				sourceId: documentId,
				contentType: 'in-world-document',
				userId,
				characterId: updated.characterId,
				sessionId: updated.sessionId,
				content: documentToEmbeddingContent(updated),
				metadata: {
					title: updated.title,
					origin: updated.origin,
					groundingMode: updated.groundingMode,
					issuer: updated.issuer ?? null,
					viewpoint: updated.viewpoint ?? null,
					claimMode: updated.claimMode ?? 'unknown',
					eventKey: updated.eventKey ?? null,
					timelineOrder: updated.timelineOrder ?? null,
					inWorldTime: updated.inWorldTime ?? null,
				},
			});
		} else {
			embeddingJobService.invalidate({ sourceType: 'document', sourceId: documentId });
			await deleteMemoryEmbeddings('document', documentId);
		}
		return updated;
	},

	archive: async (documentId: string, userId: string): Promise<DocumentInfo> => {
		const current = await getOwnedDocument(documentId, userId);
		const now = new Date().toISOString();
		const archived = applyDocumentArchive(current, now);
		if (archived === current) return current;
		await getDatabase()
			.update(documents)
			.set({ status: 'archived', retrievalEnabled: false, data: archived, updatedAt: now })
			.where(and(eq(documents.documentId, documentId), eq(documents.userId, userId)));
		embeddingJobService.invalidate({ sourceType: 'document', sourceId: documentId });
		await deleteMemoryEmbeddings('document', documentId);
		return archived;
	},

	deleteDraft: async (documentId: string, userId: string): Promise<void> => {
		const rows = await getDatabase()
			.delete(documents)
			.where(
				and(
					eq(documents.documentId, documentId),
					eq(documents.userId, userId),
					eq(documents.status, 'draft')
				)
			)
			.returning({ documentId: documents.documentId });
		if (!rows[0]) throw new ApiError(409, 'Only draft documents can be deleted.');
		embeddingJobService.invalidate({ sourceType: 'document', sourceId: documentId });
		await deleteMemoryEmbeddings('document', documentId);
	},
};

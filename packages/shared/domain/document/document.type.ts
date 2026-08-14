import { z } from 'zod';

export const DOCUMENT_ORIGINS = ['manual', 'generated'] as const;
export const DOCUMENT_STATUSES = ['draft', 'approved', 'archived'] as const;
export const DOCUMENT_GROUNDING_MODES = ['grounded', 'mixed', 'invented'] as const;
export const DOCUMENT_CLAIM_MODES = [
	'record',
	'statement',
	'report',
	'rumor',
	'opinion',
	'propaganda',
	'unknown',
] as const;

export type DocumentOrigin = (typeof DOCUMENT_ORIGINS)[number];
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
export type DocumentGroundingMode = (typeof DOCUMENT_GROUNDING_MODES)[number];
export type DocumentClaimMode = (typeof DOCUMENT_CLAIM_MODES)[number];

const optionalLabel = z.string().trim().max(200).optional();

export const documentSourceRefsSchema = z.object({
	chatTurnIds: z.array(z.string().min(1)).default([]),
	loreIds: z.array(z.string().min(1)).default([]),
	historyIds: z.array(z.string().min(1)).default([]),
	recapIds: z.array(z.string().min(1)).default([]),
	documentIds: z.array(z.string().min(1)).default([]),
});

export type DocumentSourceRefs = z.infer<typeof documentSourceRefsSchema>;

export const documentInfoSchema = z.object({
	documentId: z.string().min(1),
	userId: z.string().min(1),
	sessionId: z.string().min(1),
	characterId: z.string().min(1),
	origin: z.enum(DOCUMENT_ORIGINS),
	status: z.enum(DOCUMENT_STATUSES),
	retrievalEnabled: z.boolean(),
	includeInRag: z.boolean().default(false),
	title: z.string().trim().min(1).max(300),
	body: z.string().max(100_000),
	documentKind: optionalLabel,
	issuer: optionalLabel,
	viewpoint: optionalLabel,
	claimMode: z.enum(DOCUMENT_CLAIM_MODES).default('unknown'),
	eventKey: optionalLabel,
	timelineOrder: z.number().int().nonnegative().optional(),
	inWorldTime: optionalLabel,
	groundingMode: z.enum(DOCUMENT_GROUNDING_MODES),
	requestText: z.string().trim().max(5_000).optional(),
	sourceRefs: documentSourceRefsSchema,
	modelName: z.string().trim().max(200).optional(),
	promptVersion: z.string().trim().max(100).optional(),
	revision: z.number().int().positive(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});

export type DocumentInfo = z.infer<typeof documentInfoSchema>;

export const manualDocumentDraftCreateSchema = z.object({
	sessionId: z.string().min(1),
	title: z.string().trim().min(1).max(300),
	body: z.string().max(100_000).default(''),
	documentKind: optionalLabel,
	issuer: optionalLabel,
	viewpoint: optionalLabel,
	claimMode: z.enum(DOCUMENT_CLAIM_MODES).default('unknown'),
	eventKey: optionalLabel,
	timelineOrder: z.number().int().nonnegative().optional(),
	inWorldTime: optionalLabel,
});

export type ManualDocumentDraftCreate = z.infer<typeof manualDocumentDraftCreateSchema>;

export const documentDraftUpdateSchema = z
	.object({
		title: z.string().trim().min(1).max(300).optional(),
		body: z.string().max(100_000).optional(),
		documentKind: optionalLabel,
		issuer: optionalLabel,
		viewpoint: optionalLabel,
		claimMode: z.enum(DOCUMENT_CLAIM_MODES).optional(),
		eventKey: optionalLabel,
		timelineOrder: z.number().int().nonnegative().nullable().optional(),
		inWorldTime: optionalLabel,
		includeInRag: z.boolean().optional(),
		expectedRevision: z.number().int().positive(),
	})
	.refine(
		(value) =>
			value.title !== undefined ||
			value.body !== undefined ||
			value.documentKind !== undefined ||
			value.issuer !== undefined ||
			value.viewpoint !== undefined ||
			value.claimMode !== undefined ||
			value.eventKey !== undefined ||
			value.timelineOrder !== undefined ||
			value.inWorldTime !== undefined ||
			value.includeInRag !== undefined,
		{ message: 'At least one document field must be updated.' }
	);

export type DocumentDraftUpdate = z.infer<typeof documentDraftUpdateSchema>;

export const documentRetrievalPreferenceSchema = z.object({ enabled: z.boolean() });
export type DocumentRetrievalPreference = z.infer<typeof documentRetrievalPreferenceSchema>;

export const generatedDocumentDraftCreateSchema = z.object({
	sessionId: z.string().min(1),
	requestText: z.string().trim().min(1).max(5_000),
	modelName: z.string().trim().min(1).max(200),
	includeInRag: z.boolean(),
});

export type GeneratedDocumentDraftCreate = z.infer<typeof generatedDocumentDraftCreateSchema>;

export const documentDraftRewriteSchema = z.object({
	editInstruction: z.string().trim().min(1).max(5_000),
	modelName: z.string().trim().min(1).max(200),
	expectedRevision: z.number().int().positive(),
});

export type DocumentDraftRewrite = z.infer<typeof documentDraftRewriteSchema>;

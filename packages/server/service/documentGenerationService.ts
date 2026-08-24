import { z } from 'zod';
import type { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import type { MemoryResponse } from '@rita-berenice/shared/api';
import type {
	DocumentDraftRewrite,
	DocumentInfo,
	DocumentSourceRefs,
	GeneratedDocumentDraftCreate,
	SessionInfo,
} from '@rita-berenice/shared/domain';
import { ApiError, DOCUMENT_CLAIM_MODES } from '@rita-berenice/shared/domain';
import { RECENT_CHAT_TURN } from '@rita-berenice/shared/config';
import { detectLanguage } from '../util/languageUtils.js';
import { characterStore } from '../store/characterStore.js';
import { chatStore } from '../store/chatStore.js';
import { documentStore } from '../store/documentStore.js';
import { memoryEngine } from './memoryEngine.js';
import { llmService } from './llmService.js';
import { modelCatalogService } from './modelCatalogService.js';

export const generatedDocumentSchema = z.object({
	title: z.string().trim().min(1).max(300),
	body: z.string().min(1).max(100_000),
	documentKind: z.string().trim().max(200).nullable(),
	issuer: z.string().trim().max(200).nullable(),
	viewpoint: z.string().trim().max(200).nullable(),
	claimMode: z.enum(DOCUMENT_CLAIM_MODES),
	eventKey: z.string().trim().max(200).nullable(),
	timelineOrder: z.number().int().nonnegative().nullable(),
	inWorldTime: z.string().trim().max(200).nullable(),
	includesInventedDetails: z.boolean(),
});

const unique = (values: string[]): string[] => [...new Set(values)];

export const buildDocumentSourceRefs = (memories: MemoryResponse): DocumentSourceRefs => ({
	chatTurnIds: unique(
		[...memories.shortTermHistory, ...memories.longTermHistory].map((turn) => turn.chatTurnId)
	),
	loreIds: unique(memories.relevantLore.map((lore) => lore.loreId)),
	historyIds: unique(memories.relevantHistory.map((history) => history.historyId)),
	recapIds: unique((memories.relevantRecaps ?? []).map((recap) => recap.recapId)),
	documentIds: unique((memories.relevantDocuments ?? []).map((document) => document.documentId)),
});

export const resolveDocumentGroundingMode = (
	sourceRefs: DocumentSourceRefs,
	includesInventedDetails: boolean
): 'grounded' | 'mixed' | 'invented' => {
	const hasSources = Object.values(sourceRefs).some((ids) => ids.length > 0);
	if (!hasSources) return 'invented';
	return includesInventedDetails ? 'mixed' : 'grounded';
};

const buildEvidence = (memories: MemoryResponse): string =>
	JSON.stringify(
		{
			recentTurns: memories.shortTermHistory,
			recalledTurns: memories.longTermHistory,
			lore: memories.relevantLore,
			history: memories.relevantHistory,
			recaps: memories.relevantRecaps,
			approvedDocuments: memories.relevantDocuments?.map((document) => ({
				title: document.title,
				issuer: document.issuer,
				viewpoint: document.viewpoint,
				claimMode: document.claimMode ?? 'unknown',
				eventKey: document.eventKey,
				timelineOrder: document.timelineOrder,
				inWorldTime: document.inWorldTime,
				body: document.body,
			})),
		},
		null,
		2
	);

const buildCurrentDraft = (document: DocumentInfo): string =>
	JSON.stringify(
		{
			title: document.title,
			body: document.body,
			documentKind: document.documentKind ?? null,
			issuer: document.issuer ?? null,
			viewpoint: document.viewpoint ?? null,
			claimMode: document.claimMode ?? 'unknown',
			eventKey: document.eventKey ?? null,
			timelineOrder: document.timelineOrder ?? null,
			inWorldTime: document.inWorldTime ?? null,
			groundingMode: document.groundingMode,
			includeInRag: document.includeInRag,
			previousRequest: document.requestText ?? null,
		},
		null,
		2
	);

export const documentGenerationService = {
	generateDraft: async (
		input: GeneratedDocumentDraftCreate,
		userId: string,
		session: SessionInfo
	) => {
		const [characterResponse, chatResponse, aiModelInfo] = await Promise.all([
			characterStore.getCharacter(session.characterId),
			chatStore.getAllChatTurns(session.sessionId),
			modelCatalogService.resolveAiModelInfo(input.modelName),
		]);
		const recentTurns = chatResponse.chatTurns
			.sort((a, b) => a.sequence - b.sequence)
			.slice(-RECENT_CHAT_TURN);
		const langCode = detectLanguage(input.requestText);
		const memories: MemoryResponse = recentTurns.length
			? await memoryEngine.recallRelevantMemories(
					session.sessionId,
					input.requestText,
					userId,
					recentTurns,
					langCode,
					aiModelInfo.model
				)
			: { langCode, shortTermHistory: [], longTermHistory: [], relevantLore: [], relevantHistory: [] };
		const character = characterResponse.characterInfo;
		const messages: ChatCompletionMessageParam[] = [
			{
				role: 'system',
				content: `Create one free-form in-world document for a fictional roleplay session.
Write the body as the requested artifact itself, not an explanation of how it was made.
Infer a fitting document kind, issuer, viewpoint, and claimMode when the request omits them.
Use claimMode=record for an attributed record, statement for what a named speaker said, report for an account, rumor for unverified circulating claims, opinion for sentiment, propaganda for intentional persuasion, and unknown when none is safe.
Identify one underlying occurrence with a concise eventKey. Keep repeated similar occurrences separate. Set timelineOrder only from explicit in-world ordering or source turn sequence, and set inWorldTime only when evidence or the request supplies it; otherwise return null.
An official document is authoritative evidence of the issuer's position, not automatically objective truth. Rumor and opinion establish circulation or sentiment, not the underlying event.
Treat official lore and direct conversation evidence as constraints. Treat approved in-world documents as viewpoint-bound claims, not objective truth.
You may invent fitting details when the request requires a fictional artifact or evidence is incomplete, but set includesInventedDetails=true. Never claim source IDs in the output.
${
	input.includeInRag
		? 'This document is intended for future RAG use. Prefer established evidence, minimize invented claims, and keep uncertain or viewpoint-bound statements explicit.'
		: 'This is a fun standalone document. Creative invention is allowed when it fits the setting and request.'
}
Use the user's language unless the requested artifact clearly requires another language.`,
			},
			{
				role: 'user',
				content: `Request:\n${input.requestText}\n\nWorld introduction:\n${character.worldIntroduction ?? ''}\n\nCharacter introduction:\n${character.description ?? ''}\n\nCharacter instruction:\n${character.instruction ?? ''}\n\nServer-selected evidence:\n${buildEvidence(memories)}`,
			},
		];
		const generated = await llmService.invokeStructuredLlm(
			messages,
			aiModelInfo,
			userId,
			generatedDocumentSchema
		);
		const sourceRefs = buildDocumentSourceRefs(memories);
		return documentStore.createDraft({
			userId,
			sessionId: session.sessionId,
			characterId: session.characterId,
			origin: 'generated',
			includeInRag: input.includeInRag,
			title: generated.title,
			body: generated.body,
			documentKind: generated.documentKind ?? undefined,
			issuer: generated.issuer ?? undefined,
			viewpoint: generated.viewpoint ?? undefined,
			claimMode: generated.claimMode,
			eventKey: generated.eventKey ?? undefined,
			timelineOrder: generated.timelineOrder ?? undefined,
			inWorldTime: generated.inWorldTime ?? undefined,
			groundingMode: resolveDocumentGroundingMode(sourceRefs, generated.includesInventedDetails),
			requestText: input.requestText,
			sourceRefs,
			modelName: aiModelInfo.model,
			promptVersion: 'in-world-document-v2',
		});
	},

	rewriteDraft: async (
		documentId: string,
		input: DocumentDraftRewrite,
		userId: string,
		session: SessionInfo
	) => {
		const [current, characterResponse, chatResponse, aiModelInfo] = await Promise.all([
			documentStore.getDocument(documentId, userId),
			characterStore.getCharacter(session.characterId),
			chatStore.getAllChatTurns(session.sessionId),
			modelCatalogService.resolveAiModelInfo(input.modelName),
		]);
		if (current.sessionId !== session.sessionId || current.characterId !== session.characterId) {
			throw new ApiError(403, 'Document scope does not match the active session.');
		}
		const recentTurns = chatResponse.chatTurns
			.sort((a, b) => a.sequence - b.sequence)
			.slice(-RECENT_CHAT_TURN);
		const queryText = `${input.editInstruction}\n\n${current.title}\n${current.body.slice(0, 4_000)}`;
		const langCode = detectLanguage(input.editInstruction);
		const memories: MemoryResponse = recentTurns.length
			? await memoryEngine.recallRelevantMemories(
					session.sessionId,
					queryText,
					userId,
					recentTurns,
					langCode,
					aiModelInfo.model
				)
			: { langCode, shortTermHistory: [], longTermHistory: [], relevantLore: [], relevantHistory: [] };
		const character = characterResponse.characterInfo;
		const messages: ChatCompletionMessageParam[] = [
			{
				role: 'system',
				content: `Rewrite one existing draft in-world document for a fictional roleplay session.
Return the complete replacement document, not a diff, notes, or commentary.
Use the current draft as the base. Preserve its title, document kind, issuer, viewpoint, claimMode, eventKey, timelineOrder, and inWorldTime unless the edit instruction asks to change them or the current metadata is clearly incomplete.
Keep repeated similar occurrences separate. Never change event identity or in-world ordering merely because newer evidence uses similar words.
An official document is authoritative evidence of the issuer's position, not automatically objective truth. Rumor and opinion establish circulation or sentiment, not the underlying event.
Treat official lore and direct conversation evidence as constraints. Treat approved in-world documents as viewpoint-bound claims, not objective truth.
You may invent fitting details when the edit requires a fictional artifact or evidence is incomplete, but set includesInventedDetails=true. Never claim source IDs in the output.
${
	current.includeInRag
		? 'This draft is intended for future RAG use. Prefer established evidence, minimize invented claims, and keep uncertain or viewpoint-bound statements explicit.'
		: 'This draft is a fun standalone document. Creative invention is allowed when it fits the setting and edit instruction.'
}
Use the user's language unless the requested artifact clearly requires another language.
If a nullable metadata field should be unchanged, return its current value; only return null when the field should be blank.`,
			},
			{
				role: 'user',
				content: `Edit instruction:\n${input.editInstruction}\n\nCurrent draft:\n${buildCurrentDraft(current)}\n\nWorld introduction:\n${character.worldIntroduction ?? ''}\n\nCharacter introduction:\n${character.description ?? ''}\n\nCharacter instruction:\n${character.instruction ?? ''}\n\nServer-selected evidence:\n${buildEvidence(memories)}`,
			},
		];
		const generated = await llmService.invokeStructuredLlm(
			messages,
			aiModelInfo,
			userId,
			generatedDocumentSchema
		);
		const sourceRefs = buildDocumentSourceRefs(memories);
		return documentStore.rewriteDraft(documentId, userId, input, {
			title: generated.title,
			body: generated.body,
			documentKind: generated.documentKind ?? undefined,
			issuer: generated.issuer ?? undefined,
			viewpoint: generated.viewpoint ?? undefined,
			claimMode: generated.claimMode,
			eventKey: generated.eventKey ?? undefined,
			timelineOrder: generated.timelineOrder ?? undefined,
			inWorldTime: generated.inWorldTime ?? undefined,
			groundingMode: resolveDocumentGroundingMode(sourceRefs, generated.includesInventedDetails),
			requestText: input.editInstruction,
			sourceRefs,
			modelName: aiModelInfo.model,
			promptVersion: 'in-world-document-rewrite-v2',
		});
	},
};

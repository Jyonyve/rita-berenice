// src/server/routes/memory.routes.ts

import express, { type Request, type Response } from 'express';

import { memoryEngine } from '../service/memoryEngine.js';
import { genRoutePattern } from '#shared/util/apiHelpers.js';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { asyncHandler, validateRequestData, validateServiceId } from '../util/routeHelpers.js';
import { MemoryResponse } from '#shared/api/ModuleResponse.js';
import { ChatTurn, ChatTurnMetadata } from '#shared/domain/chat/ChatInterfaces.js';

const router = express.Router();
// Use CHAT collection type for validating session IDs
const collectionType = COLLECTIONS.CHAT;

/**
 * POST /api/memory/recall-relevant-memories
 * Gathers all relevant context (short/long-term memory, lore, history, recaps)
 * for a given user prompt to aid in generating a response.
 * @param {object} req.body - Contains the `sessionId` and `userRequestText`.
 * @returns {MemoryResponse} A payload containing various forms of recalled context.
 */
router.post(
	genRoutePattern('recallRelevantMemories'),
	asyncHandler(
		async (
			req: Request<object, MemoryResponse, { sessionId: string; userRequestText: string }>,
			res: Response<MemoryResponse>
		): Promise<void> => {
			const { sessionId, userRequestText } = req.body;
			const requiredFields = ['sessionId', 'userRequestText'];

			validateRequestData(req.body, 'body', requiredFields);
			validateServiceId(sessionId, collectionType);

			const path = genRoutePattern('recallRelevantMemories');
			console.log(`API HIT: POST ${path} for session ${sessionId}`);

			const response = await memoryEngine.recallRelevantMemories(sessionId, userRequestText);
			res.status(200).json(response);
		}
	)
);

/**
 * POST /api/memory/enrich-chat-turn-metadata-via-llm
 * Processes a finalized ChatTurn, using an LLM to generate rich metadata (summaries, keywords, emotions, etc.)
 * for long-term memory storage. This also standardizes terms using the session's glossary.
 * @param {ChatTurn} req.body - The complete ChatTurn object to be enriched.
 * @returns {ChatTurn} The generated, database-ready metadata for the chat turn.
 */
router.post(
	genRoutePattern('enrichChatTurnMetadataViaLlm'),
	asyncHandler(
		async (
			req: Request<object, ChatTurnMetadata, ChatTurn>,
			res: Response<ChatTurn>
		): Promise<void> => {
			const chatTurn = req.body;
			const requiredFields: (keyof ChatTurn)[] = ['sessionId', 'sequence', 'request', 'response'];

			validateRequestData(chatTurn, 'body', requiredFields);
			validateServiceId(chatTurn.sessionId, collectionType);

			const path = genRoutePattern('enrichChatTurnMetadataViaLlm');
			console.log(
				`API HIT: POST ${path} for session ${chatTurn.sessionId}, turn ${chatTurn.sequence}`
			);

			const response = await memoryEngine.enrichChatTurnViaLlm(chatTurn);
			res.status(200).json(response);
		}
	)
);

export default router;

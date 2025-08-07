// src/server/routes/chat.routes.ts

import express, { type Request, type Response } from 'express';

import { Where } from 'chromadb';
import { chatStore } from '../store/chatStore.js';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import {
	asyncHandler,
	compressData,
	genRoutePattern,
	validateRequestData,
	validateSequenceRule,
	validateServiceId,
} from '../util/routeHelpers.js';
import { ChatResponse } from '#shared/api/ModuleResponse.js';
import { Payload } from '#shared/util/apiHelpers.js';

const router = express.Router();
const collectionType = COLLECTIONS.CHAT;

// --- Fixed Chat Turn Operations ---

/**
 * POST /api/chat/store-chat-turn
 * Stores a finalized ChatTurn, including its request and response messages, into the permanent CHAT collection.
 * This is typically called after a user has selected a response from a set of generated options.
 * @param {ChatTurn} req.body - The complete ChatTurn object to be stored.
 * @returns {string} A JSON string of the stored ChatTurn.
 */
router.post(
	genRoutePattern('storeChatTurn'),
	asyncHandler(
		async (req: Request<object, string, ChatTurn>, res: Response<void>): Promise<void> => {
			validateServiceId(req.body.sessionId, collectionType);
			const requiredFields: (keyof ChatTurn)[] = ['sessionId', 'sequence', 'request', 'response'];
			validateRequestData(req.body, 'body', requiredFields);

			const path = genRoutePattern('storeChatTurn');
			console.log(
				`API HIT: POST ${path} for sessionId: ${req.body.sessionId}, sequence: ${req.body.sequence}`
			);

			await chatStore.storeChatTurn(req.body);
			res.status(201).json();
		}
	)
);

router.get(
	genRoutePattern('getAllChatTurns', ['sessionId']),
	asyncHandler(async (req: Request, res: Response<Payload>): Promise<void> => {
		const { sessionId } = req.params;
		validateServiceId(sessionId, collectionType);
		validateRequestData(req.params, 'params', ['sessionId']);
		const path = genRoutePattern('getAllChatTurns', ['sessionId']);
		console.log(`API HIT: GET ${path.replace(':sessionId', sessionId)}`);

		const response = await chatStore.getAllChatTurns(sessionId);
		const payload = compressData(response);
		res.status(200).json({ payload });
	})
);

/**
 * GET /api/chat/get-chat-turns/:sessionId
 * Retrieves previous chat turns for a session, used for loading history.
 * @param {string} sessionId - The session ID to fetch turns for.
 * @returns {ChatResponse} An object containing the list of chat turns.
 */
router.get(
	genRoutePattern('getAllDisplayTurns', ['sessionId']),
	asyncHandler(async (req: Request, res: Response<Payload>): Promise<void> => {
		const { sessionId } = req.params;
		validateServiceId(sessionId, collectionType);
		const path = genRoutePattern('getAllDisplayTurns', ['sessionId']);
		console.log(`API HIT: GET ${path.replace(':sessionId', sessionId)}`);

		const response = await chatStore.getAllDisplayTurns(sessionId);
		const payload = compressData(response);
		res.status(200).json({ payload });
	})
);

/**
 * GET /api/chat/get-chat-turn-by-sequence/:sessionId/:sequence
 * Retrieves a single, specific chat turn by its sequence number.
 * @param {string} sessionId - The session ID of the turn.
 * @param {number} sequence - The sequence number of the turn.
 * @returns {ChatTurn} An object containing the single chat turn.
 */
router.get(
	genRoutePattern('getChatTurnBySequence', ['sessionId', 'sequence']),
	asyncHandler(async (req: Request, res: Response<Payload>): Promise<void> => {
		const { sessionId, sequence: sequenceParam } = req.params;
		validateServiceId(sessionId, collectionType);
		validateRequestData(req.params, 'params', ['sequence'], [validateSequenceRule('sequence')]);
		const sequence = parseInt(sequenceParam, 10);

		const path = genRoutePattern('getChatTurnBySequence', ['sessionId', 'sequence']);
		console.log(
			`API HIT: GET ${path.replace(':sessionId', sessionId).replace(':sequence', sequenceParam)}`
		);

		const response = await chatStore.getChatTurnBySequence(sessionId, sequence);
		const payload = compressData(response);
		res.status(200).json({ payload });
	})
);

// --- Query Operations ---

/**
 * POST /api/chat/query-chat-turns
 * Performs a semantic search over finalized chat turns within a session.
 * @param {object} req.body - Contains sessionId, queryTexts, and optional filters.
 * @returns {ChatResponse} Search results containing matching chat turns.
 */
router.post(
	genRoutePattern('queryChatTurns'),
	asyncHandler(
		async (
			req: Request<
				object,
				ChatResponse,
				{ sessionId: string; queryTexts: string[]; where?: Where; limit?: number }
			>,
			res: Response<Payload>
		): Promise<void> => {
			const { sessionId, queryTexts, where, limit } = req.body;
			validateServiceId(sessionId, collectionType);
			validateRequestData(req.body, 'body', ['sessionId', 'queryTexts']);

			const path = genRoutePattern('queryChatTurns');
			console.log(`API HIT: POST ${path} for session ${sessionId}`);

			const response = await chatStore.queryChatTurns(sessionId, queryTexts, where, undefined, limit);
			const payload = compressData(response);
			res.status(200).json({ payload });
		}
	)
);

// /**
//  * POST /api/chat/query-chat-messages
//  * Performs a semantic search over individual messages (request or response) within a session.
//  * @param {object} req.body - Contains sessionId, queryTexts, messageType, and optional filters.
//  * @returns {string[]} An array of JSON strings, each representing a matching ChatMessage.
//  */
// router.post(
// 	genRoutePattern('queryChatMessages'),
// 	asyncHandler(
// 		async (
// 			req: Request<
// 				object,
// 				string[],
// 				{
// 					sessionId: string;
// 					queryTexts: string[];
// 					messageType: ChatMessageType;
// 					where?: Where;
// 					whereDocument?: WhereDocument;
// 					limit?: number;
// 				}
// 			>,
// 			res: Response<string[]>
// 		): Promise<void> => {
// 			const { sessionId, queryTexts, messageType, where, whereDocument, limit } = req.body;
// 			validateServiceId(sessionId, collectionType);
// 			validateRequestData(req.body, 'body', ['sessionId', 'queryTexts', 'messageType']);

// 			const path = genRoutePattern('queryChatMessages');
// 			console.log(`API HIT: POST ${path} for session ${sessionId}`);

// 			const results = await chatStore.queryChatMessages(
// 				sessionId,
// 				queryTexts,
// 				messageType,
// 				where,
// 				whereDocument,
// 				limit
// 			);
// 			res.status(200).json(results);
// 		}
// 	)
// );

export default router;

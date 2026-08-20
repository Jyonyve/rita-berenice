// src/server/routes/chat.routes.ts

import express, { type Request, type Response, type Router } from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import { chatStore } from '../store/chatStore.js';
import { RESOURCES } from '../db/resource.type.js';
import {
	asyncHandler,
	genRoutePattern,
	validateRequestData,
	validateSequenceRule,
	validateServiceId,
} from '../util/routeHelpers.js';
import { ChatTurn } from '@rita-berenice/shared/domain';
import { buildChatTurnId } from '@rita-berenice/shared/util';
import { assertOwnedSession, getSessionUserId } from '../util/authUtils.js';

const router: Router = express.Router();
router.use(verifySession());
const collectionType = RESOURCES.CHAT;

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
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateServiceId(req.body.sessionId, collectionType);
		const requiredFields: (keyof ChatTurn)[] = ['sessionId', 'sequence', 'request', 'response'];
		validateRequestData(req.body, 'body', requiredFields);
		const session = await assertOwnedSession(req, req.body.sessionId);
		req.body.userId = getSessionUserId(req);
		req.body.characterId = session.characterId;
		req.body.profileId = session.profileId;

		const response = await chatStore.storeChatTurn(req.body);
		res.status(201).json(response);
	})
);

router.get(
	genRoutePattern('getAllChatTurns', ['sessionId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { sessionId } = req.params;
		validateServiceId(sessionId, collectionType);
		validateRequestData(req.params, 'params', ['sessionId']);
		await assertOwnedSession(req, sessionId);

		const response = await chatStore.getAllChatTurns(sessionId);
		res.status(200).json(response);
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
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { sessionId } = req.params;
		validateServiceId(sessionId, collectionType);
		await assertOwnedSession(req, sessionId);

		const response = await chatStore.getAllDisplayTurns(sessionId);
		res.status(200).json(response);
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
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { sessionId, sequence: sequenceParam } = req.params;
		validateServiceId(sessionId, collectionType);
		validateRequestData(req.params, 'params', ['sequence'], [validateSequenceRule('sequence')]);
		await assertOwnedSession(req, sessionId);
		const sequence = parseInt(sequenceParam, 10);

		const response = await chatStore.getChatTurnBySequence(sessionId, sequence);
		res.status(200).json(response);
	})
);

/**
 * PATCH /api/chat/update-chat-turn/:sessionId/:sequence
 * Edits an already-finalized turn's request and/or response content in place.
 * Always re-enqueues the turn's embedding, since editing the message text changes the
 * document the embedding's contentHash is derived from.
 * @param {string} sessionId - The session ID of the turn.
 * @param {number} sequence - The sequence number of the turn.
 * @param {object} req.body - { request?: ChatMessage, response?: ChatMessage }
 * @returns {object} The updated turn's chatTurnId.
 */
router.patch(
	genRoutePattern('updateChatTurn', ['sessionId', 'sequence']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { sessionId, sequence: sequenceParam } = req.params;
		validateServiceId(sessionId, collectionType);
		validateRequestData(req.params, 'params', ['sequence'], [validateSequenceRule('sequence')]);
		await assertOwnedSession(req, sessionId);
		const sequence = parseInt(sequenceParam, 10);

		const chatTurnId = buildChatTurnId(sessionId, sequence);
		const response = await chatStore.updateChatTurn(chatTurnId, req.body);
		res.status(200).json(response);
	})
);

/**
 * DELETE /api/chat/delete-chat-turns-from-sequence/:sessionId/:sequence
 * Deletes the turn at the given sequence and every turn after it in the session
 * (tail truncation, not renumbering), along with their embeddings. Temp candidates at
 * those sequences are left untouched (orphaned) rather than deleted - if the caller passes
 * (target turn - 1) here, that preceding turn's own temp candidates survive and resurface
 * as the next reselectable/rerollable turn.
 * @param {string} sessionId - The session ID of the turn.
 * @param {number} sequence - The first sequence number to delete; everything after it goes too.
 * @returns {object} The number of turns deleted.
 */
router.delete(
	genRoutePattern('deleteChatTurnsFromSequence', ['sessionId', 'sequence']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { sessionId, sequence: sequenceParam } = req.params;
		validateServiceId(sessionId, collectionType);
		validateRequestData(req.params, 'params', ['sequence'], [validateSequenceRule('sequence')]);
		await assertOwnedSession(req, sessionId);
		const sequence = parseInt(sequenceParam, 10);

		const response = await chatStore.deleteChatTurnsFromSequence(sessionId, sequence);
		res.status(200).json(response);
	})
);

// --- Query Operations ---

// /**
//  * POST /api/chat/query-chat-turns
//  * Performs a semantic search over finalized chat turns within a session.
//  * @param {object} req.body - Contains sessionId, queryTexts, and optional filters.
//  * @returns {ChatResponse} Search results containing matching chat turns.
//  */
// router.post(
// 	genRoutePattern('queryChatTurns'),
// 	asyncHandler(
// 		async (
// 			req: Request<
// 				object,
// 				ChatResponse,
// 				{ sessionId: string; queryTexts: string[]; where?: Where; limit?: number }
// 			>,
// 			res: Response
// 		): Promise<void> => {
// 			const { sessionId, queryTexts, where, limit } = req.body;
// 			validateServiceId(sessionId, collectionType);
// 			validateRequestData(req.body, 'body', ['sessionId', 'queryTexts']);

// 			const response = await chatStore.queryChatTurns(sessionId, queryTexts, where, undefined, limit);
// 			res.status(200).json(response);
// 		}
// 	)
// );

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

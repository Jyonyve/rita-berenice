// src/server/routes/chat.routes.ts

import express, { type Request, type Response } from 'express';

import { Where, WhereDocument } from 'chromadb';
import { chatStore } from '../store/chatStore.js';
import { genRoutePattern } from '#shared/util/apiHelpers.js';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { ChatMessage, ChatMessageType, ChatTurn } from '#shared/domain/chat/ChatInterfaces.js';
import {
	asyncHandler,
	validateRequestData,
	validateSequenceRule,
	validateServiceId,
} from '../util/routeHelpers.js';
import { ChatResponse } from '#shared/api/ModuleResponse.js';
import { ApiError } from '#shared/domain/error/errors.js';

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
		async (req: Request<object, string, ChatTurn>, res: Response<string>): Promise<void> => {
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
	asyncHandler(async (req: Request, res: Response<ChatResponse>): Promise<void> => {
		const { sessionId } = req.params;
		validateServiceId(sessionId, collectionType);
		validateRequestData(req.params, 'params', ['sessionId']);
		const path = genRoutePattern('getAllChatTurns', ['sessionId']);
		console.log(`API HIT: GET ${path.replace(':sessionId', sessionId)}`);

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
	asyncHandler(async (req: Request, res: Response<ChatResponse>): Promise<void> => {
		const { sessionId } = req.params;
		validateServiceId(sessionId, collectionType);
		const path = genRoutePattern('getAllDisplayTurns', ['sessionId']);
		console.log(`API HIT: GET ${path.replace(':sessionId', sessionId)}`);

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
	asyncHandler(async (req: Request, res: Response<ChatTurn>): Promise<void> => {
		const { sessionId, sequence: sequenceParam } = req.params;
		validateServiceId(sessionId, collectionType);
		validateRequestData(req.params, 'params', ['sequence'], [validateSequenceRule('sequence')]);
		const sequence = parseInt(sequenceParam, 10);

		const path = genRoutePattern('getChatTurnBySequence', ['sessionId', 'sequence']);
		console.log(
			`API HIT: GET ${path.replace(':sessionId', sessionId).replace(':sequence', sequenceParam)}`
		);

		const chatResponse = await chatStore.getChatTurnBySequence(sessionId, sequence);
		res.status(200).json(chatResponse);
	})
);

/**
 * PUT /api/chat/update-request-message
 * Updates a single request message within a chat turn. Useful for editing user prompts after the fact.
 * @param {ChatMessage} req.body - The ChatMessage object for the request to update. Must have messageType: 'request'.
 * @returns {ChatMessage} The updated ChatMessage object.
 */
router.put(
	genRoutePattern('updateRequestMessage'),
	asyncHandler(
		async (
			req: Request<object, ChatMessage, ChatMessage>,
			res: Response<ChatMessage>
		): Promise<void> => {
			const { sessionId, sequence, messageType } = req.body;
			validateServiceId(sessionId, collectionType);
			validateRequestData(req.body, 'body', ['sessionId', 'sequence', 'entries', 'messageType']);

			if (messageType !== 'request') {
				throw new ApiError(400, "Invalid messageType for this endpoint, must be 'request'.");
			}

			const path = genRoutePattern('updateRequestMessage');
			console.log(`API HIT: PUT ${path} for session ${sessionId}, sequence ${sequence}`);

			const updatedMessage = await chatStore._storeRequest(req.body);
			res.status(200).json(updatedMessage);
		}
	)
);

/**
 * PUT /api/chat/update-response-message
 * Updates a single response message within a chat turn.
 * @param {ChatMessage} req.body - The ChatMessage object for the response to update. Must have messageType: 'response'.
 * @returns {ChatMessage} The updated ChatMessage object.
 */
router.put(
	genRoutePattern('updateResponseMessage'),
	asyncHandler(
		async (
			req: Request<object, ChatMessage, ChatMessage>,
			res: Response<ChatMessage>
		): Promise<void> => {
			const { sessionId, sequence, messageType } = req.body;
			validateServiceId(sessionId, collectionType);
			validateRequestData(req.body, 'body', ['sessionId', 'sequence', 'entries', 'messageType']);

			if (messageType !== 'response') {
				throw new ApiError(400, "Invalid messageType for this endpoint, must be 'response'.");
			}

			const path = genRoutePattern('updateResponseMessage');
			console.log(`API HIT: PUT ${path} for session ${sessionId}, sequence ${sequence}`);

			const updatedMessage = await chatStore._storeResponse(req.body);
			res.status(200).json(updatedMessage);
		}
	)
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
			res: Response<ChatResponse>
		): Promise<void> => {
			const { sessionId, queryTexts, where, limit } = req.body;
			validateServiceId(sessionId, collectionType);
			validateRequestData(req.body, 'body', ['sessionId', 'queryTexts']);

			const path = genRoutePattern('queryChatTurns');
			console.log(`API HIT: POST ${path} for session ${sessionId}`);

			const results = await chatStore.queryChatTurns(sessionId, queryTexts, where, undefined, limit);
			res.status(200).json(results);
		}
	)
);

/**
 * POST /api/chat/query-chat-messages
 * Performs a semantic search over individual messages (request or response) within a session.
 * @param {object} req.body - Contains sessionId, queryTexts, messageType, and optional filters.
 * @returns {string[]} An array of JSON strings, each representing a matching ChatMessage.
 */
router.post(
	genRoutePattern('queryChatMessages'),
	asyncHandler(
		async (
			req: Request<
				object,
				string[],
				{
					sessionId: string;
					queryTexts: string[];
					messageType: ChatMessageType;
					where?: Where;
					whereDocument?: WhereDocument;
					limit?: number;
				}
			>,
			res: Response<string[]>
		): Promise<void> => {
			const { sessionId, queryTexts, messageType, where, whereDocument, limit } = req.body;
			validateServiceId(sessionId, collectionType);
			validateRequestData(req.body, 'body', ['sessionId', 'queryTexts', 'messageType']);

			const path = genRoutePattern('queryChatMessages');
			console.log(`API HIT: POST ${path} for session ${sessionId}`);

			const results = await chatStore.queryChatMessages(
				sessionId,
				queryTexts,
				messageType,
				where,
				whereDocument,
				limit
			);
			res.status(200).json(results);
		}
	)
);

export default router;

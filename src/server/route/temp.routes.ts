// src/server/routes/tempChat.routes.ts
import express, { type Request, type Response } from 'express';
import { TempChatTurn, genRoutePattern, COLLECTIONS } from '#shared/index.js'; // Assuming MODULE_NAMES is not directly used in routes
import {
	asyncHandler,
	buildTempChatTurnId,
	validateRequestData,
	validateSequenceRule, // For body validation
	validateServiceId, // For sessionId path param
} from '../util/index.js'; // Assuming these are in your util
import { chatStore } from '../store/chatStore.js';

const router = express.Router();
const collectionType = COLLECTIONS.TEMP; // For validating sessionId if it were used as a serviceId elsewhere
// --- Temporary Chat Turn Operations ---

/**
 * POST /api/chat/save-temp-chat-turn
 * Saves a temporary chat turn, which holds multiple potential AI responses before one is finalized.
 * @param {TempChatTurn} req.body - The temporary chat turn data.
 * @returns {object} A success message.
 */
router.post(
	genRoutePattern('saveTempChatTurn'),
	asyncHandler(
		async (
			req: Request<object, { message: string }, TempChatTurn>,
			res: Response<{ message: string }>
		): Promise<void> => {
			const { sessionId, sequence } = req.body;
			validateServiceId(sessionId, collectionType);
			validateRequestData(req.body, 'body', ['sessionId', 'sequence', 'chatTurnSets']);

			const path = genRoutePattern('saveTempChatTurn');
			console.log(`API HIT: POST ${path} for session ${sessionId}, sequence ${sequence}`);

			await chatStore.saveTempChatTurn(req.body);
			res.status(200).json({ message: 'Temporary chat turn saved successfully.' });
		}
	)
);

/**
 * GET /api/chat/get-temp-chat-turn/:sessionId/:sequence
 * Retrieves a temporary chat turn object, including all generated responses for that turn.
 * @param {string} sessionId - The session ID of the turn.
 * @param {number} sequence - The sequence number of the turn.
 * @returns {TempChatTurn} The temporary chat turn data.
 */
router.get(
	genRoutePattern('getTempChatTurn', ['sessionId', 'sequence']),
	asyncHandler(async (req: Request, res: Response<TempChatTurn>): Promise<void> => {
		const { sessionId, sequence: sequenceParam } = req.params;
		validateServiceId(sessionId, collectionType);
		validateRequestData(req.params, 'params', ['sequence'], [validateSequenceRule('sequence')]);
		const sequence = parseInt(sequenceParam, 10);

		const path = genRoutePattern('getTempChatTurn', ['sessionId', 'sequence']);
		console.log(
			`API HIT: GET ${path.replace(':sessionId', sessionId).replace(':sequence', sequenceParam)}`
		);

		const response = await chatStore.getTempChatTurn(sessionId, sequence);
		res.status(200).json(response);
	})
);

export default router;

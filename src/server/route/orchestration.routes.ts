// src/server/routes/orchestration.routes.ts

import express, { type Request, type Response } from 'express';
import { genRoutePattern, TempChatTurn, TempChatTurnCdo, COLLECTIONS } from '#shared/index.ts';
import { asyncHandler, validateRequestData, validateSequenceRule } from '../util/index.ts';
import { handleChatRequest } from '../service/orchestrationService.ts';

const router = express.Router();

/**
 * POST /api/orchestration/handle-chat-request
 * The main endpoint for handling a new user chat message. This orchestrates fetching
 * context, generating a new response option, and saving it to the temporary chat turn.
 * @param {TempChatTurnCdo} req.body - Contains sessionId, the current turn sequence, and the user's input text.
 * @returns {TempChatTurn} The updated temporary chat turn object, including the newly generated response set.
 */
router.post(
	genRoutePattern('handleChatRequest'),
	asyncHandler(
		async (
			req: Request<object, TempChatTurn, TempChatTurnCdo>,
			res: Response<TempChatTurn>
		): Promise<void> => {
			const { sessionId, sequence } = req.body;

			// Validate the incoming request payload
			const requiredFields: (keyof TempChatTurnCdo)[] = ['sessionId', 'sequence', 'userInput'];
			validateRequestData(req.body, 'body', requiredFields, [validateSequenceRule('sequence')]);

			const path = genRoutePattern('handleChatRequest');
			console.log(`API HIT: POST ${path} for session ${sessionId}, turn ${sequence}`);

			// Call the main orchestration service function with the request body
			const response = await handleChatRequest(req.body);

			// Return the updated temporary turn object, which now includes the new response option
			res.status(200).json(response);
		}
	)
);

export default router;

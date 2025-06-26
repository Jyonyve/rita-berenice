// src/server/routes/orchestration.routes.ts

import express, { type Request, type Response } from 'express';
import {
	genRoutePattern,
	TempChatTurn,
	TempChatTurnCdo,
	CharacterInfo,
	ProfileInfo,
	AiModelInfo,
	COLLECTIONS,
} from '#shared/index.ts';
import {
	asyncHandler,
	validateRequestData,
	validateServiceId,
	validateSequenceRule,
} from '../util/index.ts';
import { handleChatRequest } from '../service/index.ts';

const router = express.Router();

// Define a type for the complex request body for clarity
interface HandleChatRequestBody {
	tempChatTurnCdo: TempChatTurnCdo;
	characterInfo: CharacterInfo;
	profileInfo: ProfileInfo;
	aiModel: AiModelInfo;
}

/**
 * POST /api/orchestration/handle-chat-request
 * The main endpoint for handling a new user chat message. This orchestrates fetching
 * context, generating a new response option, and saving it to the temporary chat turn.
 */
router.post(
	genRoutePattern('handleChatRequest'),
	asyncHandler(
		async (
			req: Request<object, TempChatTurn, HandleChatRequestBody>,
			res: Response<TempChatTurn>
		): Promise<void> => {
			const { tempChatTurnCdo, characterInfo, profileInfo, aiModel } = req.body;

			// Validate the incoming request payload
			const requiredFields: (keyof HandleChatRequestBody)[] = [
				'tempChatTurnCdo',
				'characterInfo',
				'profileInfo',
			];
			validateRequestData(req.body, 'body', requiredFields);
			validateRequestData(tempChatTurnCdo, 'body', ['sessionId', 'sequence', 'userInput']);
			validateServiceId(tempChatTurnCdo.sessionId, COLLECTIONS.CHAT);

			const path = genRoutePattern('handleChatRequest');
			console.log(
				`API HIT: POST ${path} for session ${tempChatTurnCdo.sessionId}, turn ${tempChatTurnCdo.sequence}`
			);

			// Call the main orchestration service function with the unpacked request body
			const response = await handleChatRequest(tempChatTurnCdo, characterInfo, profileInfo, aiModel);

			res.status(200).json(response);
		}
	)
);

export default router;

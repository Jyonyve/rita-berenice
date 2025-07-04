// src/server/routes/orchestration.routes.ts

import express, { type Request, type Response } from 'express';

import { genRoutePattern } from '#shared/util/apiHelpers.js';

import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { asyncHandler, validateRequestData, validateServiceId } from '../util/routeHelpers.js';
import { TempChatTurn, TempChatTurnCdo } from '#shared/domain/chat/ChatInterfaces.js';
import { receiveBotResponse } from '../service/orchestrationService.js';
import { CharacterInfo } from '#shared/domain/character/CharacterInterfaces.js';
import { AiModelInfo } from '#shared/domain/aimodel/AiInfoTypes.js';
import { ProfileInfo } from '#shared/domain/profile/ProfileInterfaces.js';

const router = express.Router();

// Define a type for the complex request body for clarity
interface ReceiveBotResponseBody {
	tempChatTurnCdo: TempChatTurnCdo;
	characterInfo: CharacterInfo;
	profileInfo: ProfileInfo;
	aiModel: AiModelInfo;
	recentChatTurnString: string;
}

/**
 * POST /api/orchestration/handle-chat-request
 * The main endpoint for handling a new user chat message. This orchestrates fetching
 * context, generating a new response option, and saving it to the temporary chat turn.
 */
router.post(
	genRoutePattern('receiveBotResponse'),
	asyncHandler(
		async (
			req: Request<object, TempChatTurn, ReceiveBotResponseBody>,
			res: Response<TempChatTurn>
		): Promise<void> => {
			const { tempChatTurnCdo, characterInfo, profileInfo, aiModel, recentChatTurnString } = req.body;

			// Validate the incoming request payload
			const requiredFields: (keyof ReceiveBotResponseBody)[] = [
				'tempChatTurnCdo',
				'characterInfo',
				'profileInfo',
			];
			validateRequestData(req.body, 'body', requiredFields);
			validateRequestData(tempChatTurnCdo, 'body', ['sessionId', 'sequence', 'userInput']);
			validateServiceId(tempChatTurnCdo.sessionId, COLLECTIONS.CHAT);

			const path = genRoutePattern('receiveBotResponse');
			console.log(
				`API HIT: POST ${path} for session ${tempChatTurnCdo.sessionId}, turn ${tempChatTurnCdo.sequence}`
			);

			// Call the main orchestration service function with the unpacked request body
			const response = await receiveBotResponse(
				tempChatTurnCdo,
				characterInfo,
				profileInfo,
				aiModel,
				recentChatTurnString
			);

			res.status(200).json(response);
		}
	)
);

export default router;

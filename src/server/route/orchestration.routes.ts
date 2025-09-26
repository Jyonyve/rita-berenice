// src/server/routes/orchestration.routes.ts

import express, { type Request, type Response } from 'express';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import {
	asyncHandler,
	compressData,
	genRoutePattern,
	validateRequestData,
	validateServiceId,
} from '../util/routeHelpers.js';
import {
	ChatTurn,
	ChatTurnCdo,
	TempChatTurn,
	TempChatTurnCdo,
} from '#shared/domain/chat/chat.type.js';
import { finalizeChatTurn, receiveBotResponse } from '../service/orchestrationService.js';
import { CharacterInfo } from '#shared/domain/character/character.type.js';
import { AiModelInfo } from '#shared/domain/aimodel/AiInfoTypes.js';
import { ProfileInfo } from '#shared/domain/profile/profile.type.js';
import { Payload } from '#shared/util/apiHelpers.js';

const router = express.Router();

// Define a type for the complex request body for clarity
interface ReceiveBotResponseBody {
	tempChatTurnCdo: TempChatTurnCdo;
	characterInfo: CharacterInfo;
	profileInfo: ProfileInfo;
	aiModelInfo: AiModelInfo;
	recentChatTurnString: string;
	isScene?: boolean;
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
			res: Response<Payload>
		): Promise<void> => {
			const {
				tempChatTurnCdo,
				characterInfo,
				profileInfo,
				aiModelInfo,
				recentChatTurnString,
				isScene,
			} = req.body;

			// Validate the incoming request payload
			const requiredFields: (keyof ReceiveBotResponseBody)[] = [
				'tempChatTurnCdo',
				'characterInfo',
				'profileInfo',
				'aiModelInfo',
			];
			const tempTurnCdoField: (keyof TempChatTurnCdo)[] = [
				'sessionId',
				'sequence',
				'userId',
				'inputJsonString',
			];
			validateRequestData(req.body, 'body', requiredFields);
			validateRequestData(tempChatTurnCdo, 'body', tempTurnCdoField);
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
				aiModelInfo,
				recentChatTurnString,
				isScene
			);

			const payload = compressData(response);
			res.status(200).json({ payload });
		}
	)
);

/**
 * POST /api/orchestration/finalize-chat-turn
 * Finalizes a temporary chat turn by enriching its metadata via LLM and storing it
 * as a permanent ChatTurn in the main chat history.
 */
router.post(
	genRoutePattern('finalizeChatTurn'),
	asyncHandler(
		async (req: Request<object, ChatTurn, ChatTurnCdo>, res: Response<Payload>): Promise<void> => {
			const chatTurnCdo = req.body;

			// Validate the incoming request payload
			const requiredFields: (keyof ChatTurnCdo)[] = [
				'userId',
				'sessionId',
				'sequence',
				'request',
				'response',
			];
			validateRequestData(req.body, 'body', requiredFields);
			validateServiceId(chatTurnCdo.sessionId, COLLECTIONS.CHAT);

			const path = genRoutePattern('finalizeChatTurn');
			console.log(
				`API HIT: POST ${path} for session ${chatTurnCdo.sessionId}, sequence ${chatTurnCdo.sequence}`
			);

			// Call the finalization service function
			const enrichedChatTurn = await finalizeChatTurn(chatTurnCdo);

			const payload = compressData(enrichedChatTurn);
			res.status(200).json({ payload });
		}
	)
);
export default router;

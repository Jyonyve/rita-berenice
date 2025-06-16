// src/server/routes/tempChat.routes.ts
import express, { type Request, type Response } from 'express';
import { TempChatTurn, genRoutePattern, COLLECTIONS } from '#shared/index.ts'; // Assuming MODULE_NAMES is not directly used in routes
import {
	asyncHandler,
	buildTempChatTurnId,
	validateRequestData, // For body validation
	validateServiceId, // For sessionId path param
} from '../util/index.ts'; // Assuming these are in your util
import { chatStore } from '../store/chatStore.ts';

const router = express.Router();
const collectionType = COLLECTIONS.TEMP; // For validating sessionId if it were used as a serviceId elsewhere

// --- POST /api/temp-chat/save-temp-chat-turn ---
// Body: { sessionId: string, sequence: number, chatTurnSets: ChatMessageSet[] } (i.e., TempChatTurn)
router.post(
	genRoutePattern('saveTempChatTurn'), // Assuming this generates "/api/temp-chat/save-temp-chat-turn"
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		// Validate the request body
		validateServiceId(req.body.sessionId, collectionType); // Validate sessionId
		const requiredFields: (keyof TempChatTurn)[] = ['sessionId', 'sequence', 'chatTurnSets'];
		validateRequestData(req.body, 'body', requiredFields);

		const { sessionId, sequence, chatTurnSets } = req.body;
		const path = genRoutePattern('saveTempChatTurn');
		console.log(`API HIT: POST ${path} for sessionId: ${sessionId}`);

		// Service method expects the full TempChatTurn object
		await chatStore.saveTempChatTurn(req.body);

		res
			.status(201)
			.json({ message: `Temp chat stored. session ${sessionId}, setCount: ${chatTurnSets.length}` });
	})
);

// --- GET /api/temp-chat/get-temp-chat-turn/:sessionId/:sequence ---
router.get(
	genRoutePattern('getTempChatTurn', ['sessionId', 'sequence']),
	asyncHandler(async (req: Request, res: Response<TempChatTurn>): Promise<void> => {
		const { sessionId, sequence } = req.params;
		const seq: number = Number(sequence);
		// Validate sessionId from path
		validateServiceId(buildTempChatTurnId(sessionId, seq), collectionType); // Or a more generic ID validation

		const path = genRoutePattern('getTempChatTurn', ['sessionId']);
		console.log(`API HIT: GET ${path.replace(':sessionId', sessionId)}`);

		const tempTurn = await chatStore.getTempChatTurn(sessionId, seq);

		res.status(200).json(tempTurn);
	})
);

export default router;

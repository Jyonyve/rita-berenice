// src/server/routes/tempChat.routes.ts
import express, { type Request, type Response } from 'express';
import { TempChatTurn } from '#root/src/shared/domain/index.ts';
import { chatService } from '#root/src/server/service/index.ts';
import { genRoutePattern } from '#root/src/shared/util/index.ts';
import { MODULE_NAMES } from '#root/src/shared/index.ts';

const router = express.Router();
const MODULE_NAME = MODULE_NAMES.TEMP_CHAT;

// --- POST /api/temp-chat/save-temp-chat-turn ---
router.post(
	genRoutePattern(MODULE_NAME, 'saveTempChatTurn', []),
	async (req: Request, res: Response): Promise<void> => {
		const { tempData } = req.body;
		console.log(`API HIT: POST ${genRoutePattern(MODULE_NAME, 'saveTempChatTurn', [])}`);

		if (!tempData?.sessionId) {
			res.status(400).json({ error: 'Invalid tempData' });
			return;
		}

		try {
			await chatService.saveTempChatTurn(tempData as TempChatTurn);
			res.status(200).json({ message: 'Temp chat stored' });
		} catch (error: any) {
			res.status(500).json({ error: error.message || 'Failed to store temp chat' });
		}
	}
);

// --- GET /api/temp-chat/get-temp-chat-turn/:sessionId ---
router.get(
	genRoutePattern(MODULE_NAME, 'getTempChatTurn', ['sessionId']),
	async (req: Request<{ sessionId: string }>, res: Response): Promise<void> => {
		const { sessionId } = req.params;
		console.log(`API HIT: GET ${genRoutePattern(MODULE_NAME, 'getTempChatTurn', [sessionId])}`);

		try {
			const tempTurn = await chatService.getTempChatTurn(sessionId);
			tempTurn ? res.json(tempTurn) : res.status(404).json({ message: 'No temp data' });
		} catch (error: any) {
			res.status(500).json({ error: error.message || 'Failed to get temp chat' });
		}
	}
);

// --- DELETE /api/temp-chat/remove-temp-chat-turn/:sessionId ---
router.delete(
	genRoutePattern(MODULE_NAME, 'removeTempChatTurn', ['sessionId']),
	async (req: Request<{ sessionId: string }>, res: Response): Promise<void> => {
		const { sessionId } = req.params;
		console.log(`API HIT: DELETE ${genRoutePattern(MODULE_NAME, 'removeTempChatTurn', [sessionId])}`);

		try {
			await chatService.removeTempChatTurn(sessionId);
			res.status(204).send();
		} catch (error: any) {
			res.status(500).json({ error: error.message || 'Failed to delete temp chat' });
		}
	}
);

export default router;

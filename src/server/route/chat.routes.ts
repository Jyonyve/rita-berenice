// src/server/routes/chroma.routes.ts
import express, { type Request, type Response } from 'express';
import { ChatTurn } from '#root/src/shared/domain/index.ts';
import { chatService } from '#root/src/server/service/index.ts';
import { genRoutePattern } from '#root/src/shared/util/index.ts';

const router = express.Router();
const MODULE_NAME = 'chat'; // Define module name once

// --- POST /api/chat/store-chat-turn/:sessionId ---
router.post(
	genRoutePattern(MODULE_NAME, 'storeChatTurn', ['sessionId']),
	async (req: Request, res: Response): Promise<any> => {
		const { sessionId } = req.params;
		const { chatTurn } = req.body;
		const path = genRoutePattern(MODULE_NAME, 'storeChatTurn', ['sessionId']); // For logging
		console.log(`API HIT: POST ${path}`);

		if (!chatTurn) return res.status(400).json({ error: 'Missing chatTurn in request body' });
		try {
			await chatService.storeChatTurn(sessionId, chatTurn as ChatTurn);
			res.status(201).json({ message: 'Chat turn stored successfully' });
		} catch (error: any) {
			console.error(`Error in POST ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to store chat turn' });
		}
	}
);

// --- POST /api/chat/store-summary/:sessionId ---
router.post(
	genRoutePattern(MODULE_NAME, 'storeSummary', ['sessionId']),
	async (req: Request, res: Response): Promise<any> => {
		const { sessionId } = req.params;
		const { summary } = req.body;
		const path = genRoutePattern(MODULE_NAME, 'storeSummary', ['sessionId']);
		console.log(`API HIT: POST ${path}`);

		if (typeof summary !== 'string')
			return res.status(400).json({ error: 'Missing or invalid summary' });
		try {
			await chatService.storeSummary(sessionId, summary);
			res.status(201).json({ message: 'Summary stored successfully' });
		} catch (error: any) {
			console.error(`Error in POST ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to store summary' });
		}
	}
);

// --- GET /api/chat/get-summary/:sessionId ---
router.get(
	genRoutePattern(MODULE_NAME, 'getSummary', ['sessionId']),
	async (req: Request, res: Response): Promise<any> => {
		const { sessionId } = req.params;
		const path = genRoutePattern(MODULE_NAME, 'getSummary', ['sessionId']);
		console.log(`API HIT: GET ${path}`);

		try {
			const summary = await chatService.getSummary(sessionId);
			res.json({ summary: summary ?? '' });
		} catch (error: any) {
			console.error(`Error in GET ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to get summary' });
		}
	}
);

// --- GET /api/chat/query-summary/:sessionId?q=... ---
router.get(
	genRoutePattern(MODULE_NAME, 'querySummary', ['sessionId']),
	async (req: Request, res: Response): Promise<any> => {
		const { sessionId } = req.params;
		const query = req.query.q as string | undefined;
		const path = genRoutePattern(MODULE_NAME, 'querySummary', ['sessionId']);
		console.log(`API HIT: GET ${path}?q=${query}`);

		if (!query) return res.status(400).json({ error: 'Missing query parameter "q"' });
		try {
			const results = await chatService.querySummary(sessionId, query);
			res.json({ result: results?.pop() }); // Send back the last result or undefined
		} catch (error: any) {
			console.error(`Error in GET ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to query summary' });
		}
	}
);

// --- GET /api/chat/query-chat-log/:sessionId?q=...&limit=...&fixedOnly=... ---
router.get(
	genRoutePattern(MODULE_NAME, 'queryChatLog', ['sessionId']),
	async (req: Request, res: Response): Promise<any> => {
		const { sessionId } = req.params;
		const query = req.query.q as string | undefined;
		const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
		const fixedOnly = req.query.fixedOnly !== 'false'; //default: true
		const path = genRoutePattern(MODULE_NAME, 'queryChatLog', ['sessionId']);
		console.log(`API HIT: GET ${path}?q=${query}&limit=${limit}&fixedOnly=${fixedOnly}`);

		if (!query) return res.status(400).json({ error: 'Missing query parameter "q"' });
		try {
			const results = await chatService.queryChatLog(
				sessionId,
				query,
				['request', 'response'],
				fixedOnly
			);
			res.json(results);
		} catch (error: any) {
			console.error(`Error in GET ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to query chat log' });
		}
	}
);

// --- GET /api/chat/get-recent-chat-logs/:sessionId?turnCount=...&fixedOnly=... ---
router.get(
	genRoutePattern(MODULE_NAME, 'getRecentChatLogs', ['sessionId']),
	async (req: Request, res: Response): Promise<any> => {
		const { sessionId } = req.params;
		const turnCount = req.query.turnCount ? parseInt(req.query.turnCount as string, 10) : 10;
		const fixedOnly = req.query.fixedOnly !== 'false';
		const path = genRoutePattern(MODULE_NAME, 'getRecentChatLogs', ['sessionId']);
		console.log(`API HIT: GET ${path}?turnCount=${turnCount}&fixedOnly=${fixedOnly}`);

		try {
			const results = await chatService.getRecentChatLogs(sessionId, turnCount, fixedOnly);
			res.json(results);
		} catch (error: any) {
			console.error(`Error in GET ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to get recent logs' });
		}
	}
);

// --- GET /api/chat/get-chat-turn-by-sequence/:sessionId/:sequence?fixedOnly=... ---
router.get(
	genRoutePattern(MODULE_NAME, 'getChatTurnBySequence', ['sessionId', 'sequence']),
	async (req: Request, res: Response): Promise<any> => {
		const { sessionId } = req.params;
		const sequence = parseInt(req.params.sequence, 10);
		const fixedOnly = req.query.fixedOnly !== 'false';
		const path = genRoutePattern(MODULE_NAME, 'getChatTurnBySequence', ['sessionId', 'sequence']);
		console.log(`API HIT: GET ${path}?fixedOnly=${fixedOnly}`);

		if (isNaN(sequence)) return res.status(400).json({ error: 'Invalid sequence number' });
		try {
			const result = await chatService.getChatTurnBySequence(sessionId, sequence, fixedOnly);
			res.json(result);
		} catch (error: any) {
			console.error(`Error in GET ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to get chat turn by sequence' });
		}
	}
);

// --- GET /api/chat/get-all-responses-for-sequence/:sessionId/:sequence?fixedOnly=... ---
router.get(
	genRoutePattern(MODULE_NAME, 'getAllResponsesForSequence', ['sessionId', 'sequence']),
	async (req: Request, res: Response): Promise<any> => {
		const { sessionId } = req.params;
		const sequence = parseInt(req.params.sequence, 10);
		const fixedOnly = req.query.fixedOnly !== 'false';
		const path = genRoutePattern(MODULE_NAME, 'getAllResponsesForSequence', [
			'sessionId',
			'sequence',
		]);
		console.log(`API HIT: GET ${path}?fixedOnly=${fixedOnly}`);

		if (isNaN(sequence)) return res.status(400).json({ error: 'Invalid sequence number' });
		try {
			const results = await chatService.getAllResponsesForSequence(sessionId, sequence, fixedOnly);
			res.json(results);
		} catch (error: any) {
			console.error(`Error in GET ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to get responses for sequence' });
		}
	}
);

// --- POST /api/chat/build-user-prompt-from-log/:sessionId ---
interface BuildPromptBody {
	userText: string;
	isFullLogQuery?: boolean;
	fixedOnly?: boolean;
}
router.post(
	genRoutePattern(MODULE_NAME, 'buildUserPromptFromLog', ['sessionId']),
	async (req: Request, res: Response): Promise<any> => {
		const { sessionId } = req.params;
		const { userText, isFullLogQuery } = req.body;
		const fixedOnly = req.body.fixedOnly !== false;
		const path = genRoutePattern(MODULE_NAME, 'buildUserPromptFromLog', ['sessionId']);
		console.log(`API HIT: POST ${path}`);

		if (typeof userText !== 'string')
			return res.status(400).json({ error: 'Missing or invalid userText' });
		try {
			const prompt = await chatService.buildUserPromptFromLog(
				sessionId,
				userText,
				!!isFullLogQuery,
				fixedOnly
			);
			res.json({ prompt: prompt ?? '' });
		} catch (error: any) {
			console.error(`Error in POST ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to build prompt' });
		}
	}
);

export default router;

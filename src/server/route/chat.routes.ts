// src/server/routes/chat.routes.ts
import express, { type Request, type Response } from 'express';
import { chatService, recapService } from '../service/index.ts';
import {
	DEFAULT_LOADING_TURN_COUNT,
	DEFAULT_RECENT_TURN_COUNT,
	genRoutePattern,
	ChatTurn,
	ChatMessageType,
	METADATA_TYPES,
	COLLECTIONS,
	QueryChatLogsRequest,
} from '#shared/index.ts';
import { chromaDbClient } from '../db/chromaDbClient.ts'; // Added chromaDbClient for direct access in one route
import { IncludeEnum } from 'chromadb';
import {
	asyncHandler,
	CustomValidationRule,
	validateRequestData,
	validateSequenceRule,
	validateServiceId,
} from '../util/index.ts';

const router = express.Router();
const collectioinType = COLLECTIONS.CHAT;

// --- POST /api/chat/store-chat-turn/ ---
// Stores a completed (fixed) chat turn
router.post(
	genRoutePattern('storeChatTurn'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const requiredFields: (keyof ChatTurn)[] = ['sessionId', 'sequence', 'request', 'response'];
		validateRequestData(req.body, 'body', requiredFields);

		const path = genRoutePattern('storeChatTurn');
		console.log(`API HIT: POST ${path} for ID: ${req.body?.sessionId}`);
		const response = await chatService.storeChatTurn(req.body);

		res.status(200).json(response);
	})
);

// --- GET /api/chat/get-recent-chat-turns/:sessionId ---
// Gets the most recent fixed chat turns for initial load
router.get(
	genRoutePattern('getRecentChatTurns', ['sessionId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { sessionId } = req.params;
		validateServiceId(sessionId, collectioinType);

		// Use query param for limit, default to constant
		const limitParam = req.query.limit as string | undefined;
		const limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_RECENT_TURN_COUNT;
		const path = genRoutePattern('getRecentChatTurns', ['sessionId']);
		console.log(`API HIT: GET ${path.replace(':sessionId', sessionId)}?limit=${limit}`);
		const response = await chatService.getRecentChatTurns(sessionId, limit);

		res.status(200).json(response);
		return;
	})
);

// --- GET /api/chat/get-loading-chat-turns/:sessionId ---
// Gets older fixed chat turns for infinite scroll
router.get(
	genRoutePattern('getLoadingChatTurns', ['sessionId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { sessionId } = req.params;

		// --- Validate Route Parameter: sessionId ---
		validateServiceId(sessionId, collectioinType);

		// --- Validate Query Parameter: beforeSequence ---
		const queryRequiredField = 'beforeSequence';
		validateRequestData(
			req.query,
			'query',
			[queryRequiredField],
			[validateSequenceRule(queryRequiredField)]
		);

		const beforeSequenceString = req.query?.[queryRequiredField] as string;
		const beforeSequence = parseInt(beforeSequenceString, 10);

		// --- Log and Call Service ---
		const path = genRoutePattern('getLoadingChatTurns', ['sessionId']);
		console.log(
			`API HIT: GET ${path.replace(':sessionId', sessionId)}?beforeSequence=${beforeSequence}`
		);

		const response = await chatService.getLoadingChatTurns(sessionId, beforeSequence);
		res.status(200).json(response);
	})
);

// --- GET /api/chat/get-chat-turn-by-sequence/:sessionId/:sequence ---
// Gets a specific fixed turn by its sequence number
router.get(
	genRoutePattern('getChatTurnBySequence', ['sessionId', 'sequence']),
	async (req: Request<{ sessionId: string; sequence: string }>, res: Response): Promise<any> => {
		const { sessionId } = req.params;
		const sequenceParam = req.params.sequence;
		const path = genRoutePattern('getChatTurnBySequence', ['sessionId', 'sequence']);
		console.log(`API HIT: GET ${path}`);

		if (!sessionId) {
			res.status(400).json({ error: 'Missing sessionId parameter' });
			return;
		}
		const sequence = parseInt(sequenceParam, 10);
		if (isNaN(sequence) || sequence < 0) {
			// Adjust if sequence starts at 1
			res.status(400).json({ error: 'Invalid sequence parameter, must be a non-negative number' });
			return;
		}

		try {
			// Directly fetch and parse here for clarity, matching service logic implicitly
			const collection = await chatService._getCollection(sessionId); // Access internal method carefully
			const turnId = buildTurnId(sessionId, sequence);
			const turnJson = await chromaDbClient.getRecordById(collection, turnId);

			if (!turnJson) {
				res.status(404).json({ error: `Chat turn with sequence ${sequence} not found` });
				return;
			}

			// Parse and validate type before sending
			const turn = JSON.parse(turnJson) as ChatTurn;
			const metadata = (await collection.get({ ids: [turnId], include: [IncludeEnum.Metadatas] }))
				.metadatas?.[0];

			// Ensure it's a 'full_turn' type we are serving
			if (!metadata || metadata.type !== METADATA_TYPES.TURN) {
				console.warn(`Attempted to fetch non- via sequence endpoint: ${turnId}`);
				res
					.status(404)
					.json({ error: `Chat turn with sequence ${sequence} not found (or not a fixed turn)` });
				return;
			}

			return res.json(turn);
		} catch (error: any) {
			console.error(`Error in GET ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to get chat turn by sequence' });
		}
	}
);

// --- GET /api/chat/get-recap/:sessionId ---
// Gets the generated recap for the session
router.get(
	genRoutePattern('getRecap', ['sessionId']),
	async (req: Request<{ sessionId: string }>, res: Response): Promise<void> => {
		const { sessionId } = req.params;
		const path = genRoutePattern('getRecap', [sessionId]);
		console.log(`API HIT: GET ${path}`);

		if (!sessionId) {
			res.status(400).json({ error: 'Missing sessionId parameter' });
			return;
		}

		try {
			const recap = await recapService.getRecap(sessionId);
			// Return empty string if no recap, consistent with service
			res.json({ recap: recap ?? '' });
		} catch (error: any) {
			console.error(`Error in GET ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to get recap' });
		}
	}
);

// --- POST /api/chat/query-chat-log/ ---
// Performs a semantic query against the chat log messages (request/response)
// Example: /api/chat/query-chat-log/session123?q=search%20term&limit=5
router.post(
	genRoutePattern('queryChatLogs'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const requiredFields: (keyof QueryChatLogsRequest)[] = ['sessionId', 'queryText'];
		validateRequestData(req.body, 'body', requiredFields);

		const { sessionId, queryText, messageType, limit } = req.body as QueryChatLogsRequest;
		const path = genRoutePattern('queryChatLogs');
		console.log(`API HIT: GET ${path}`);

		const response = await chatService.queryChatMessages(sessionId, queryText, messageType, limit);

		res.status(200).json(response);
		return;
	})
);

// --- POST /api/chat/build-user-prompt-from-log/:sessionId ---
// Builds a context-aware prompt using recap or recent turns
router.post(
	genRoutePattern('buildUserPromptFromLog', ['sessionId']),
	async (req: Request<{ sessionId: string }>, res: Response): Promise<any> => {
		const { sessionId } = req.params;
		const { userText, isFullLogQuery } = req.body; // isFullLogQuery is optional flag
		const path = genRoutePattern('buildUserPromptFromLog', [sessionId]);
		console.log(`API HIT: POST ${path}`);

		if (!sessionId) {
			res.status(400).json({ error: 'Missing sessionId parameter' });
			return;
		}
		if (typeof userText !== 'string') {
			res
				.status(400)
				.json({ error: 'Missing or invalid userText in request body (must be a string)' });
			return;
		}
		// Validate isFullLogQuery if present
		if (isFullLogQuery !== undefined && typeof isFullLogQuery !== 'boolean') {
			res.status(400).json({ error: 'Invalid isFullLogQuery in request body (must be boolean)' });
			return;
		}

		try {
			const prompt = await chatService.buildUserPromptFromLog(
				sessionId,
				userText,
				!!isFullLogQuery // Convert to boolean, defaults to false if undefined
			);
			// Return the generated prompt string
			return res.json({ prompt: prompt ?? '' });
		} catch (error: any) {
			console.error(`Error in POST ${path}:`, error);
			return res.status(500).json({ error: error.message || 'Failed to build prompt from log' });
		}
	}
);

export default router;

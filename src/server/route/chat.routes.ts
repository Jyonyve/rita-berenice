// src/server/routes/chat.routes.ts
import express, { type Request, type Response } from 'express';
import { ChatTurn, ChatMessageType } from '#root/src/shared/domain/index.ts'; // Added ChatMessageType
import { chatService } from '#root/src/server/service/index.ts';
import { genRoutePattern, buildTurnId } from '#root/src/shared/util/index.ts'; // Added buildTurnId
import {
	DEFAULT_LOADING_TURN_COUNT,
	DEFAULT_RECENT_TURN_COUNT,
	MODULE_NAMES,
} from '#root/src/shared/index.ts';
import { chromaDbClient } from '#server/db/chromaDbClient.ts'; // Added chromaDbClient for direct access in one route
import { IncludeEnum } from 'chromadb';

const router = express.Router();
const MODULE_NAME = MODULE_NAMES.CHAT; // Define module name once

// --- POST /api/chat/store-chat-turn/:sessionId ---
// Stores a completed (fixed) chat turn
router.post(
	genRoutePattern(MODULE_NAME, 'storeChatTurn', ['sessionId']),
	async (req: Request<{ sessionId: string }>, res: Response): Promise<void> => {
		const { sessionId } = req.params;
		const { chatTurn } = req.body;
		const path = genRoutePattern(MODULE_NAME, 'storeChatTurn', [sessionId]);
		console.log(`API HIT: POST ${path}`);

		if (!chatTurn) {
			res.status(400).json({ error: 'Missing chatTurn in request body' });
			return;
		}
		// Basic validation: Ensure session ID matches if needed, or rely on chatTurn's ID
		if (!chatTurn.sessionId || chatTurn.sessionId !== sessionId) {
			res
				.status(400)
				.json({
					error: `Session ID mismatch or missing in chatTurn. Param: ${sessionId}, Body: ${chatTurn.sessionId}`,
				});
			return;
		}
		if (typeof chatTurn.sequence !== 'number') {
			res.status(400).json({ error: 'Invalid or missing sequence in chatTurn' });
			return;
		}

		try {
			// storeChatTurn handles storing messages, full turn, deleting temp, and recap trigger
			await chatService.storeChatTurn(chatTurn as ChatTurn);
			res.status(201).json({ message: 'Chat turn stored successfully' });
		} catch (error: any) {
			console.error(`Error in POST ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to store chat turn' });
		}
	}
);

// --- GET /api/chat/get-recent-chat-turns/:sessionId ---
// Gets the most recent fixed chat turns for initial load
router.get(
	genRoutePattern(MODULE_NAME, 'getRecentChatTurns', ['sessionId']),
	async (req: Request<{ sessionId: string }>, res: Response): Promise<void> => {
		const { sessionId } = req.params;
		// Use query param for limit, default to constant
		const limitParam = req.query.limit as string | undefined;
		const limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_RECENT_TURN_COUNT;
		const path = genRoutePattern(MODULE_NAME, 'getRecentChatTurns', [sessionId]);
		console.log(`API HIT: GET ${path}?limit=${limit}`);

		if (!sessionId) {
			res.status(400).json({ error: 'Missing sessionId parameter' });
			return;
		}
		if (isNaN(limit) || limit <= 0) {
			res.status(400).json({ error: 'Invalid limit parameter, must be a positive number' });
			return;
		}

		try {
			const results = await chatService.getRecentChatTurns(sessionId, limit);
			res.json(results); // Returns ChatTurn[] parsed on the server
		} catch (error: any) {
			console.error(`Error in GET ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to get recent chat turns' });
		}
	}
);

// --- GET /api/chat/get-loading-chat-turns/:sessionId ---
// Gets older fixed chat turns for infinite scroll
router.get(
	genRoutePattern(MODULE_NAME, 'getLoadingChatTurns', ['sessionId']),
	async (req: Request<{ sessionId: string }>, res: Response): Promise<void> => {
		const { sessionId } = req.params;
		const beforeSequenceParam = req.query.beforeSequence as string | undefined;
		const limitParam = req.query.limit as string | undefined;

		const limit = limitParam ? parseInt(limitParam, 10) : DEFAULT_LOADING_TURN_COUNT;
		const path = genRoutePattern(MODULE_NAME, 'getLoadingChatTurns', [sessionId]);
		console.log(`API HIT: GET ${path}?beforeSequence=${beforeSequenceParam}&limit=${limit}`);

		if (!sessionId) {
			res.status(400).json({ error: 'Missing sessionId parameter' });
			return;
		}
		if (beforeSequenceParam === undefined) {
			// beforeSequence is mandatory for loading older turns
			res.status(400).json({ error: 'Missing beforeSequence query parameter' });
			return;
		}
		const beforeSequence = parseInt(beforeSequenceParam, 10);
		if (isNaN(beforeSequence) || beforeSequence < 0) {
			// Allow 0 if sequence can be 0, adjust if sequence starts at 1
			res
				.status(400)
				.json({ error: 'Invalid beforeSequence query parameter, must be a non-negative number' });
			return;
		}
		if (isNaN(limit) || limit <= 0) {
			res.status(400).json({ error: 'Invalid limit query parameter, must be a positive number' });
			return;
		}

		try {
			const results = await chatService.getLoadingChatTurns(sessionId, beforeSequence, limit);
			res.json(results); // Returns ChatTurn[] parsed on the server
		} catch (error: any) {
			console.error(`Error in GET ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to load older chat turns' });
		}
	}
);

// --- GET /api/chat/get-chat-turn-by-sequence/:sessionId/:sequence ---
// Gets a specific fixed turn by its sequence number
router.get(
	genRoutePattern(MODULE_NAME, 'getChatTurnBySequence', ['sessionId', 'sequence']),
	async (req: Request<{ sessionId: string; sequence: string }>, res: Response): Promise<void> => {
		const { sessionId } = req.params;
		const sequenceParam = req.params.sequence;
		const path = genRoutePattern(MODULE_NAME, 'getChatTurnBySequence', [sessionId, sequenceParam]);
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
			const turnJson = await chromaDbClient.getDocumentById(collection, turnId);

			if (!turnJson) {
				res.status(404).json({ error: `Chat turn with sequence ${sequence} not found` });
				return;
			}

			// Parse and validate type before sending
			const turn = JSON.parse(turnJson) as ChatTurn;
			const metadata = (await collection.get({ ids: [turnId], include: [IncludeEnum.Metadatas] }))
				.metadatas?.[0];

			// Ensure it's a 'full_turn' type we are serving
			if (!metadata || metadata.type !== 'full_turn') {
				console.warn(`Attempted to fetch non-full_turn via sequence endpoint: ${turnId}`);
				res
					.status(404)
					.json({ error: `Chat turn with sequence ${sequence} not found (or not a fixed turn)` });
				return;
			}

			res.json(turn);
		} catch (error: any) {
			console.error(`Error in GET ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to get chat turn by sequence' });
		}
	}
);

// --- GET /api/chat/get-recap/:sessionId ---
// Gets the generated recap for the session
router.get(
	genRoutePattern(MODULE_NAME, 'getRecap', ['sessionId']),
	async (req: Request<{ sessionId: string }>, res: Response): Promise<void> => {
		const { sessionId } = req.params;
		const path = genRoutePattern(MODULE_NAME, 'getRecap', [sessionId]);
		console.log(`API HIT: GET ${path}`);

		if (!sessionId) {
			res.status(400).json({ error: 'Missing sessionId parameter' });
			return;
		}

		try {
			const recap = await chatService.getRecap(sessionId);
			// Return empty string if no recap, consistent with service
			res.json({ recap: recap ?? '' });
		} catch (error: any) {
			console.error(`Error in GET ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to get recap' });
		}
	}
);

// --- GET /api/chat/query-chat-log/:sessionId ---
// Performs a semantic query against the chat log messages (request/response)
// Example: /api/chat/query-chat-log/session123?q=search%20term&limit=5
router.get(
	genRoutePattern(MODULE_NAME, 'queryChatLog', ['sessionId']),
	async (req: Request<{ sessionId: string }>, res: Response): Promise<void> => {
		const { sessionId } = req.params;
		const queryText = req.query.q as string | undefined;
		const limitParam = req.query.limit as string | undefined;
		const limit = limitParam ? parseInt(limitParam, 10) : 10; // Default query limit

		const path = genRoutePattern(MODULE_NAME, 'queryChatLog', [sessionId]);
		console.log(`API HIT: GET ${path}?q=${queryText}&limit=${limit}`);

		if (!sessionId) {
			res.status(400).json({ error: 'Missing sessionId parameter' });
			return;
		}
		if (!queryText) {
			res.status(400).json({ error: 'Missing query parameter "q"' });
			return;
		}
		if (isNaN(limit) || limit <= 0) {
			res.status(400).json({ error: 'Invalid limit parameter, must be a positive number' });
			return;
		}

		try {
			// Define which message types to query (likely request and response)
			const messageTypesToQuery: ChatMessageType[] = ['request', 'response'];
			const results = await chatService.queryChatLog(sessionId, queryText, messageTypesToQuery, limit);
			res.json(results); // Returns string[] of matching document contents
		} catch (error: any) {
			console.error(`Error in GET ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to query chat log' });
		}
	}
);

// --- POST /api/chat/build-user-prompt-from-log/:sessionId ---
// Builds a context-aware prompt using recap or recent turns
router.post(
	genRoutePattern(MODULE_NAME, 'buildUserPromptFromLog', ['sessionId']),
	async (req: Request<{ sessionId: string }>, res: Response): Promise<void> => {
		const { sessionId } = req.params;
		const { userText, isFullLogQuery } = req.body; // isFullLogQuery is optional flag
		const path = genRoutePattern(MODULE_NAME, 'buildUserPromptFromLog', [sessionId]);
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
			res.json({ prompt: prompt ?? '' });
		} catch (error: any) {
			console.error(`Error in POST ${path}:`, error);
			res.status(500).json({ error: error.message || 'Failed to build prompt from log' });
		}
	}
);

export default router;

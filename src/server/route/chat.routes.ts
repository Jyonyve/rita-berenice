// src/server/routes/chat.routes.ts
import express, { type Request, type Response } from 'express';
import { chatService } from '../service/index.ts'; // recapService not directly used by these chat routes
import {
	genRoutePattern,
	ChatTurn, // Used for request body validation
	COLLECTIONS,
	ChatResponse,
	QueryChatLogsApiRequest,
} from '#shared/index.ts';
// chromaDbClient and IncludeEnum should ideally not be used directly in routes if service handles DB interaction
import {
	asyncHandler,
	CustomValidationRule, // For type if needed, but validateSequenceRule is specific
	validateRequestData,
	validateServiceId,
	validateSequenceRule, // For throwing specific HTTP errors from routes if needed
} from '../util/index.ts'; // Assuming createNonNegativeIntStringRule is in ../util/index.ts

const router = express.Router();
const collectionType = COLLECTIONS.CHAT; // Used for validateServiceId

// --- POST /api/chat/store-chat-turn ---
// Stores a completed (fixed) chat turn.
// The service method chatService.storeChatTurn now returns a string (JSON of the stored turn).
router.post(
	genRoutePattern('storeChatTurn'),
	asyncHandler(
		async (req: Request<object, string, ChatTurn>, res: Response<string>): Promise<void> => {
			// Validate the entire ChatTurn body structure
			validateServiceId(req.body.sessionId, collectionType);
			// Validate request body
			const requiredFields: (keyof ChatTurn)[] = ['sessionId', 'sequence', 'request', 'response'];
			validateRequestData(req.body, 'body', requiredFields);

			const path = genRoutePattern('storeChatTurn');
			console.log(
				`API HIT: POST ${path} for sessionId: ${req.body.sessionId}, sequence: ${req.body.sequence}`
			);

			// chatService.storeChatTurn is expected to handle storing request, response, and the full turn.
			// It returns a stringified version of the successfully stored ChatTurn.
			const storedTurnString = await chatService.storeChatTurn(req.body);

			res.status(201).json(storedTurnString); // 201 Created is often more appropriate for successful POST
		}
	)
);

// --- GET /api/chat/get-loading-chat-turns/:sessionId ---
// Gets older fixed chat turns for infinite scroll
router.get(
	genRoutePattern('getLoadingChatTurns', ['sessionId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { sessionId } = req.params;

		// --- Validate Route Parameter: sessionId ---
		validateServiceId(sessionId, collectionType);

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

		const response = await chatService.getChatTurns(sessionId, beforeSequence);
		res.status(200).json(response);
	})
);

// --- GET /api/chat/get-chat-turn-by-sequence/:sessionId/:sequence ---
// Gets a specific fixed turn by its sequence number.
router.get(
	genRoutePattern('getChatTurnBySequence', ['sessionId', 'sequence']),
	asyncHandler(async (req: Request, res: Response<ChatResponse>): Promise<void> => {
		const { sessionId, sequence: sequenceParam } = req.params;

		// Validate Route Parameters
		validateServiceId(sessionId, collectionType);
		validateRequestData(req.params, 'params', ['sequence'], [validateSequenceRule('sequence')]);

		const sequence = parseInt(sequenceParam, 10);

		const path = genRoutePattern('getChatTurnBySequence', ['sessionId', 'sequence']);
		console.log(
			`API HIT: GET ${path.replace(':sessionId', sessionId).replace(':sequence', sequenceParam)}`
		);

		const chatResponse = await chatService.getChatTurnBySequence(sessionId, sequence);
		res.status(200).json(chatResponse);
	})
);

// --- POST /api/chat/query-chat-logs ---
// Performs a semantic query against chat messages.
// Request body: { sessionId: string, queryText: string, messageType?: ChatMessageType | ChatMessageType[], limit?: number }

router.post(
	genRoutePattern('queryChatLogs'), // Assuming this is /api/chat/query-chat-logs
	asyncHandler(
		async (
			req: Request<object, string[], QueryChatLogsApiRequest>,
			res: Response<string[]>
		): Promise<void> => {
			validateServiceId(req.body.sessionId, collectionType);

			const requiredFields: (keyof QueryChatLogsApiRequest)[] = ['sessionId', 'queryText'];
			const customValidations: CustomValidationRule[] = [
				{
					// Validate queryText is non-empty string
					predicate: (body: QueryChatLogsApiRequest) =>
						typeof body.queryText !== 'string' || body.queryText.trim() === '',
					status: 400,
					errorMessage: "Body field 'queryText' must be a non-empty string.",
					clientMessage: 'A search query is required.',
				},
				{
					// Validate limit if provided
					predicate: (body: QueryChatLogsApiRequest) =>
						body.limit !== undefined &&
						(typeof body.limit !== 'number' || body.limit <= 0 || !Number.isInteger(body.limit)),
					status: 400,
					errorMessage: "Body field 'limit', if provided, must be a positive integer.",
					clientMessage: 'If a limit is specified, it must be a positive number.',
				},
				// messageType validation could be added if specific values are enforced at route level
			];
			validateRequestData(req.body, 'body', requiredFields, customValidations);

			const { sessionId, queryText, messageType, limit } = req.body;
			const path = genRoutePattern('queryChatLogs');
			console.log(
				`API HIT: POST ${path} for session ${sessionId} with query: "${queryText.substring(0, 30)}..."`
			);

			// Assuming service method is queryChatMessages and it handles the messageType logic ('request', 'response', 'both', or array)
			const documents = await chatService.queryChatMessages(sessionId, queryText, messageType, limit);

			res.status(201).json(documents);
		}
	)
);

export default router;

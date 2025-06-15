// src/server/routes/chat.routes.ts
import express, { type Request, type Response } from 'express';
import { chatService } from '../service/index.ts';
import { genRoutePattern, ChatTurn, COLLECTIONS, ChatResponse } from '#shared/index.ts';
import {
	asyncHandler,
	CustomValidationRule,
	validateRequestData,
	validateServiceId,
	validateSequenceRule,
} from '../util/index.ts';
import { Where } from 'chromadb';

const router = express.Router();
const collectionType = COLLECTIONS.CHAT;

// --- POST /api/chat/store-chat-turn ---
router.post(
	genRoutePattern('storeChatTurn'),
	asyncHandler(
		async (req: Request<object, string, ChatTurn>, res: Response<string>): Promise<void> => {
			validateServiceId(req.body.sessionId, collectionType);
			const requiredFields: (keyof ChatTurn)[] = ['sessionId', 'sequence', 'request', 'response'];
			validateRequestData(req.body, 'body', requiredFields);

			const path = genRoutePattern('storeChatTurn');
			console.log(
				`API HIT: POST ${path} for sessionId: ${req.body.sessionId}, sequence: ${req.body.sequence}`
			);

			const storedTurnString = await chatService.storeChatTurn(req.body);
			res.status(201).json(storedTurnString);
		}
	)
);

// --- GET /api/chat/get-loading-chat-turns/:sessionId ---
router.get(
	genRoutePattern('getLoadingChatTurns', ['sessionId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { sessionId } = req.params;
		validateServiceId(sessionId, collectionType);

		const queryRequiredField = 'beforeSequence';
		validateRequestData(
			req.query,
			'query',
			[queryRequiredField],
			[validateSequenceRule(queryRequiredField)]
		);

		const beforeSequence = parseInt(req.query[queryRequiredField] as string, 10);

		const path = genRoutePattern('getLoadingChatTurns', ['sessionId']);
		console.log(
			`API HIT: GET ${path.replace(':sessionId', sessionId)}?beforeSequence=${beforeSequence}`
		);

		const response = await chatService.getChatTurns(sessionId, beforeSequence);
		res.status(200).json(response);
	})
);

// --- GET /api/chat/get-chat-turn-by-sequence/:sessionId/:sequence ---
router.get(
	genRoutePattern('getChatTurnBySequence', ['sessionId', 'sequence']),
	asyncHandler(async (req: Request, res: Response<ChatResponse>): Promise<void> => {
		const { sessionId, sequence: sequenceParam } = req.params;
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

// --- POST /api/chat/query-chat-turns ---
router.post(
	genRoutePattern('queryChatTurns'),
	asyncHandler(
		async (
			req: Request<
				object,
				string[],
				{ sessionId: string; queryTexts: string[]; where?: Where; limit?: number }
			>,
			res: Response<ChatResponse>
		): Promise<void> => {
			const { sessionId, queryTexts, where, limit } = req.body;
			validateServiceId(sessionId, collectionType);

			const requiredFields = ['sessionId', 'queryTexts'];
			const customValidations: CustomValidationRule[] = [
				{
					predicate: (body) => !Array.isArray(body.queryTexts) || body.queryTexts.length === 0,
					status: 400,
					errorMessage: "'queryTexts' must be a non-empty string array.",
					clientMessage: '검색어를 입력하세요.',
				},
				{
					predicate: (body) => body.where !== undefined && typeof body.where !== 'object',
					status: 400,
					errorMessage: "'where' must be an object if provided.",
					clientMessage: '검색 조건이 잘못되었습니다.',
				},
			];
			validateRequestData(req.body, 'body', requiredFields, customValidations);

			const path = genRoutePattern('queryChatTurns');
			console.log(
				`API HIT: POST ${path} for session ${sessionId} with queryTexts: ${queryTexts
					.slice(0, 3)
					.join(', ')}${queryTexts.length > 3 ? '...' : ''}`
			);

			const results = await chatService.queryChatTurns(sessionId, queryTexts, where);
			res.status(200).json(results);
		}
	)
);

export default router;

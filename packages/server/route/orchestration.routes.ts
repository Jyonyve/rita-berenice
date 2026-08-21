// src/server/routes/orchestration.routes.ts

import express, { type Request, type Response, type Router } from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import type { SessionRequest } from 'supertokens-node/framework/express';
import { RESOURCES } from '../db/resource.type.js';
import { asyncHandler, genRoutePattern, validateServiceId } from '../util/routeHelpers.js';
import {
	TempChatTurnCdo,
	TempChatTurn,
	ChatTurn,
	ChatTurnCdo,
	ApiError,
	ApiKeyError,
} from '@rita-berenice/shared/domain';
import { RECENT_CHAT_TURN } from '@rita-berenice/shared/config';
import { receiveBotResponse, finalizeChatTurn } from '../service/orchestrationService.js';
import { ChatTurnCdoSchema, ReceiveBotResponseBodySchema } from '../util/schemaUtils.js';
import { sessionStore } from '../store/sessionStore.js';
import { characterStore } from '../store/characterStore.js';
import { profileStore } from '../store/profileStore.js';
import { chatStore } from '../store/chatStore.js';
import z from 'zod';
import { ReceiveBotResponseStreamEvent } from '@rita-berenice/shared/api';
import { finalizationJobService } from '../service/finalizationJobService.js';
import { modelCatalogService } from '../service/modelCatalogService.js';
import { getSessionUserId } from '../util/authUtils.js';

const router: Router = express.Router();

const parseRequestBody = <T>(schema: z.ZodSchema<T>, body: unknown): T => {
	const result = schema.safeParse(body);
	if (result.success) {
		return result.data;
	}

	throw new ApiError(
		400,
		'Invalid orchestration request body.',
		'The chat request payload is malformed.',
		{ issues: result.error.flatten() }
	);
};

// Define a type for the complex request body for clarity
interface ReceiveBotResponseBody {
	sessionId: string;
	sequence: number;
	entries: { type: 'dialogue' | 'action'; prompt: string }[];
	modelName: string;
}

const getOwnedSession = async (sessionId: string, userId: string) => {
	const sessionInfo = (await sessionStore.getSession(sessionId)).sessionInfo;
	if (!sessionInfo || sessionInfo.userId !== userId) {
		throw new ApiError(403, 'Session access denied.', 'This chat session does not belong to you.');
	}
	return sessionInfo;
};

const resolveReceiveBotResponseContext = async (body: ReceiveBotResponseBody, userId: string) => {
	const { sessionId, sequence, entries, modelName } = body;
	validateServiceId(sessionId, RESOURCES.CHAT);
	const sessionInfo = await getOwnedSession(sessionId, userId);
	if (!sessionInfo.profileId) {
		throw new ApiError(
			409,
			'Session profile is not initialized.',
			'Select a profile before sending a message.'
		);
	}

	const [characterResponse, profileResponse, chatResponse] = await Promise.all([
		characterStore.getCharacter(sessionInfo.characterId),
		profileStore.getProfile(sessionInfo.profileId),
		chatStore.getAllChatTurns(sessionId),
	]);
	const characterInfo = characterResponse.characterInfo;
	const profileInfo = profileResponse.profileInfo;
	if (!characterInfo || !profileInfo) {
		throw new ApiError(404, 'Chat context not found.', 'Character or profile data is missing.');
	}
	if (profileInfo.userId !== userId || profileInfo.sessionId !== sessionId) {
		throw new ApiError(403, 'Profile access denied.', 'The session profile is invalid.');
	}

	const tempChatTurnCdo: TempChatTurnCdo = {
		sessionId,
		sequence,
		userId,
		inputJsonString: JSON.stringify(entries),
	};
	const aiModelInfo = await modelCatalogService.resolveAiModelInfo(modelName);
	const recentChatTurnString = JSON.stringify(
		chatResponse.chatTurns.sort((a, b) => a.sequence - b.sequence).slice(-RECENT_CHAT_TURN)
	);

	return {
		sessionId,
		sequence,
		adultContentEnabled: sessionInfo.contentPolicy === 'adult',
		tempChatTurnCdo,
		characterInfo,
		profileInfo,
		aiModelInfo,
		recentChatTurnString,
	};
};

const writeStreamEvent = (res: Response, event: ReceiveBotResponseStreamEvent): void => {
	res.write(`${JSON.stringify(event)}\n`);
	(res as Response & { flush?: () => void }).flush?.();
};

/**
 * POST /api/orchestration/handle-chat-request
 * The main endpoint for handling a new user chat message. This orchestrates fetching
 * context, generating a new response option, and saving it to the temporary chat turn.
 */
router.post(
	genRoutePattern('receiveBotResponse'),
	verifySession(),
	asyncHandler(
		async (
			req: SessionRequest & Request<object, TempChatTurn, ReceiveBotResponseBody>,
			res: Response
		): Promise<void> => {
			const parsedBody = parseRequestBody(
				ReceiveBotResponseBodySchema,
				req.body
			) as unknown as ReceiveBotResponseBody;
			const userId = getSessionUserId(req);
			const context = await resolveReceiveBotResponseContext(parsedBody, userId);

			// Call the main orchestration service function with the unpacked request body
			const response = await receiveBotResponse(
				context.tempChatTurnCdo,
				context.characterInfo,
				context.profileInfo,
				context.aiModelInfo,
				context.recentChatTurnString,
				{ adultContentEnabled: context.adultContentEnabled }
			);

			res.status(200).json(response);
		}
	)
);

router.post(
	genRoutePattern('receiveBotResponseStream'),
	verifySession(),
	asyncHandler(
		async (
			req: SessionRequest & Request<object, void, ReceiveBotResponseBody>,
			res: Response
		): Promise<void> => {
			const parsedBody = parseRequestBody(
				ReceiveBotResponseBodySchema,
				req.body
			) as unknown as ReceiveBotResponseBody;
			const userId = getSessionUserId(req);
			const context = await resolveReceiveBotResponseContext(parsedBody, userId);

			res.status(200);
			res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
			res.setHeader('Cache-Control', 'no-cache, no-transform');
			res.setHeader('X-Accel-Buffering', 'no');
			res.flushHeaders();

			const disconnectController = new AbortController();
			res.on('close', () => {
				if (!res.writableEnded) {
					disconnectController.abort(new Error('The client disconnected.'));
				}
			});

			try {
				const tempChatTurn = await receiveBotResponse(
					context.tempChatTurnCdo,
					context.characterInfo,
					context.profileInfo,
					context.aiModelInfo,
					context.recentChatTurnString,
					{
						adultContentEnabled: context.adultContentEnabled,
						signal: disconnectController.signal,
						onStatus: (stage) => writeStreamEvent(res, { type: 'status', stage }),
						onDelta: (text) => writeStreamEvent(res, { type: 'delta', text }),
					}
				);
				writeStreamEvent(res, { type: 'complete', data: tempChatTurn });
			} catch (error: unknown) {
				if (!disconnectController.signal.aborted) {
					const apiError =
						error instanceof ApiError
							? error
							: new ApiError(
									500,
									error instanceof Error ? error.message : 'Unknown streaming error',
									'The character response could not be generated.'
								);
					writeStreamEvent(res, {
						type: 'error',
						message: apiError.message,
						clientMessage: apiError.clientMessage,
						// Forwarded so the client can react to an actionable failure - a missing or
						// rejected API key - instead of only printing the text.
						...(apiError instanceof ApiKeyError
							? { code: apiError.code, keyType: apiError.keyType }
							: {}),
					});
				}
			} finally {
				res.end();
			}
		}
	)
);

router.post(
	genRoutePattern('enqueueFinalization'),
	verifySession(),
	asyncHandler(
		async (
			req: SessionRequest & Request<object, void, ChatTurnCdo>,
			res: Response
		): Promise<void> => {
			const chatTurnCdo = parseRequestBody(ChatTurnCdoSchema, req.body) as ChatTurnCdo;
			validateServiceId(chatTurnCdo.sessionId, RESOURCES.CHAT);
			const userId = getSessionUserId(req);
			await getOwnedSession(chatTurnCdo.sessionId, userId);
			chatTurnCdo.userId = userId;

			const response = await finalizationJobService.enqueue(chatTurnCdo);
			res.status(202).json(response);
		}
	)
);

router.get(
	genRoutePattern('getFinalizationJob', ['sessionId', 'sequence']),
	verifySession(),
	asyncHandler(async (req: SessionRequest, res: Response): Promise<void> => {
		const { sessionId, sequence: sequenceParam } = req.params;
		validateServiceId(sessionId, RESOURCES.CHAT);
		const sequence = Number(sequenceParam);
		if (!Number.isInteger(sequence) || sequence < 0) {
			throw new ApiError(400, 'Invalid finalization job sequence.');
		}

		const userId = getSessionUserId(req);
		await getOwnedSession(sessionId, userId);
		const job = await finalizationJobService.get(sessionId, sequence);
		if (!job) {
			throw new ApiError(404, 'Finalization job not found.');
		}
		res.status(200).json(job);
	})
);

/**
 * POST /api/orchestration/finalize-chat-turn
 * Finalizes a temporary chat turn by enriching its metadata via LLM and storing it
 * as a permanent ChatTurn in the main chat history.
 */
router.post(
	genRoutePattern('finalizeChatTurn'),
	verifySession(),
	asyncHandler(
		async (
			req: SessionRequest & Request<object, ChatTurn, ChatTurnCdo>,
			res: Response
		): Promise<void> => {
			const chatTurnCdo = parseRequestBody(ChatTurnCdoSchema, req.body) as ChatTurnCdo;
			validateServiceId(chatTurnCdo.sessionId, RESOURCES.CHAT);
			const userId = getSessionUserId(req);
			await getOwnedSession(chatTurnCdo.sessionId, userId);
			chatTurnCdo.userId = userId;

			// Call the finalization service function
			const enrichedChatTurn = await finalizeChatTurn(chatTurnCdo);

			res.status(200).json(enrichedChatTurn);
		}
	)
);
export default router;

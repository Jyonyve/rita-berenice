// src/server/routes/tempChat.routes.ts
import express, { type Request, type Response, type Router } from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';

import { tempStore } from '../store/tempStore.js';
import { RESOURCES } from '../db/resource.type.js';
import {
  asyncHandler,
  genRoutePattern,
  validateRequestData,
  validateSequenceRule,
  validateServiceId,
} from '../util/routeHelpers.js';
import { ApiError, TempChatTurn } from '@rita-berenice/shared/domain';
import { isResponseEditAllowed, serializeChatEntries } from '@rita-berenice/shared/util';
import { assertOwnedSession, getSessionUserId } from '../util/authUtils.js';

const router: Router = express.Router();
router.use(verifySession());

const collectionType = RESOURCES.TEMP;
// --- Temporary Chat Turn Operations ---

/**
 * POST /api/chat/save-temp-chat-turn
 * Saves a temporary chat turn, which holds multiple potential AI responses before one is finalized.
 * @param {TempChatTurn} req.body - The temporary chat turn data.
 * @returns {object} A success message.
 */
router.post(
  genRoutePattern('saveTempChatTurn'),
  asyncHandler(async (req: Request, res: Response<{ tempTurnId: string }>): Promise<void> => {
    const { sessionId, sequence } = req.body;
    validateServiceId(sessionId, collectionType);
    validateRequestData(req.body, 'body', ['sessionId', 'sequence', 'chatTurnSets']);
    await assertOwnedSession(req, sessionId);
    req.body.userId = getSessionUserId(req);

    const incomingTurn = req.body as TempChatTurn;
    const storedResponse = await tempStore.getTempChatTurn(sessionId, sequence).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) return undefined;
      throw error;
    });
    const storedTurn = storedResponse?.tempChatTurn;
    if (storedTurn) {
      for (const incomingSet of incomingTurn.chatTurnSets) {
        const storedSet = storedTurn.chatTurnSets.find((candidate) => candidate.setNo === incomingSet.setNo);
        if (!storedSet) continue;
        const originalText = serializeChatEntries(storedSet.response.entries, 'quoted-dialogue');
        const candidateText = serializeChatEntries(incomingSet.response.entries, 'quoted-dialogue');
        if (!isResponseEditAllowed(originalText, candidateText)) {
          throw new ApiError(
            400,
            'Responses over the edit limit may only be shortened until they reach the ordinary edit limit.',
          );
        }
      }
    }

    const response = await tempStore.saveTempChatTurn(incomingTurn);
    res.status(200).json(response);
  }),
);

/**
 * GET /api/chat/get-temp-chat-turn/:sessionId/:sequence
 * Retrieves a temporary chat turn object, including all generated responses for that turn.
 * @param {string} sessionId - The session ID of the turn.
 * @param {number} sequence - The sequence number of the turn.
 * @returns {TempChatTurn} The temporary chat turn data.
 */
router.get(
  genRoutePattern('getTempChatTurn', ['sessionId', 'sequence']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId, sequence: sequenceParam } = req.params;
    validateServiceId(sessionId, collectionType);
    validateRequestData(req.params, 'params', ['sequence'], [validateSequenceRule('sequence')]);
    await assertOwnedSession(req, sessionId);
    const sequence = parseInt(sequenceParam, 10);

    const response = await tempStore.getTempChatTurn(sessionId, sequence);
    res.status(200).json(response);
  }),
);

/**
 * ✅ NEW ROUTE
 * GET /api/temp/get-last-temp-turns-for-sessions
 * Fetches the single most recent temp turn for a list of session IDs.
 * @param {string} req.query.sessionIds - A comma-separated string of session IDs.
 * @returns {TempChatResponse} An object containing the list of latest temp chat turns.
 * @throws {400} If sessionIds parameter is missing or empty.
 */
router.get(
  // The path will be something like: /api/temp/get-last-temp-turns-for-sessions
  genRoutePattern('getLastTempTurnsForSessions'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Validate that the sessionIds query parameter exists.
    validateRequestData(req.query, 'query', ['sessionIds']);
    const { sessionIds: sessionIdsQueryParam } = req.query;

    if (typeof sessionIdsQueryParam !== 'string') {
      // 2. If it's not a string (e.g., it's an array or object from a malformed URL),
      //    throw a clear bad request error.
      throw new ApiError(400, "The 'sessionIds' parameter must be a single, comma-separated string.");
    }
    const sessionIds = sessionIdsQueryParam.split(',');
    await Promise.all(sessionIds.map((sessionId) => assertOwnedSession(req, sessionId)));

    // Call the new store function we created.
    const response = await tempStore.getLastTempTurnsForSessions(sessionIds);
    res.status(200).json(response);
  }),
);

/**
 * DELETE /api/temp/delete-temp-chat-turn/:sessionId/:sequence
 * Deletes a temporary chat turn (and all of its candidate response sets).
 * @param {string} sessionId - The session ID of the turn.
 * @param {number} sequence - The sequence number of the turn.
 * @returns {object} A success message.
 */
router.delete(
  genRoutePattern('deleteTempChatTurn', ['sessionId', 'sequence']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { sessionId, sequence: sequenceParam } = req.params;
    validateServiceId(sessionId, collectionType);
    validateRequestData(req.params, 'params', ['sequence'], [validateSequenceRule('sequence')]);
    await assertOwnedSession(req, sessionId);
    const sequence = parseInt(sequenceParam, 10);

    await tempStore.deleteTempChatTurn(sessionId, sequence);
    res.status(200).json({ success: true });
  }),
);

export default router;

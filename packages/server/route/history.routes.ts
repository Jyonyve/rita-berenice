// src/server/routes/lore.routes.ts

import express, { type Request, type Response, type Router } from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';

import { historyStore } from '../store/historyStore.js';
import { assertCharacterVisibleToUser } from '../store/characterStore.js';
import { characterStore } from '../store/characterStore.js';
import { asyncHandler, genRoutePattern, validateServiceId } from '../util/routeHelpers.js';
import { RESOURCES } from '../db/resource.type.js';
import { assertOwnedCharacter, getSessionUserId } from '../util/authUtils.js';
import { ApiError, HistoryInfo, historyWriteSchema } from '@rita-berenice/shared/domain';

const router: Router = express.Router();

const collectionType = RESOURCES.HISTORY;

// --- HISTORY ROUTES ---

/**
 * GET /api/lore/get-histories/:characterId
 * Retrieves all history entries for a specific character, sorted by sequence.
 * @param {string} characterId - The ID of the character.
 * @returns {HistoryResponse} An object containing the list of histories.
 */
router.get(
  genRoutePattern('getHistories', ['characterId']),
  verifySession(),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { characterId } = req.params;
    validateServiceId(characterId, collectionType);
    const viewerUserId = getSessionUserId(req);
    const character = assertCharacterVisibleToUser(
      await characterStore.getCharacter(characterId),
      viewerUserId,
    ).characterInfo;

    const response = await historyStore.getHistories(characterId, character.userId);
    res.status(200).json(response);
  }),
);

/**
 * POST /api/lore/store-history
 * Creates or updates a history entry in the database.
 * @param {HistoryInfo} req.body - The complete history data payload.
 * @returns {object} A confirmation message.
 */
router.post(
  genRoutePattern('storeHistory'),
  verifySession(),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const parsed = historyWriteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'Invalid history payload.', 'The history data is malformed.', {
        issues: parsed.error.flatten(),
      });
    }
    const { characterId } = parsed.data;
    await assertOwnedCharacter(req, characterId);
    const historyInfo: HistoryInfo = { ...parsed.data, userId: getSessionUserId(req) };

    const response = await historyStore.storeHistory(historyInfo);
    res.status(201).json(response);
  }),
);

/**
 * GET /api/lore/get-history/:historyId
 * Retrieves a single lore entry by its unique ID.
 * @param {string} loreId - The unique ID of the lore entry.
 * @returns {HistoryResponse} An object containing the single lore entry.
 */
router.get(
  genRoutePattern('getHistory', ['historyId']),
  verifySession(),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { historyId } = req.params;
    validateServiceId(historyId, collectionType);
    const scope = await historyStore.getHistoryScope(historyId);
    if (!scope) throw new ApiError(404, `History '${historyId}' not found.`);
    const character = assertCharacterVisibleToUser(
      await characterStore.getCharacter(scope.characterId),
      getSessionUserId(req),
    ).characterInfo;
    if (scope.userId !== character.userId) {
      throw new ApiError(404, `History '${historyId}' not found.`);
    }

    const response = await historyStore.getHistory(historyId, character.userId);
    res.status(200).json(response);
  }),
);

// /**
//  * POST /api/lore/query-histories
//  * Performs a semantic search for history entries for a character.
//  * @param {object} req.body - Contains characterId and queryTexts.
//  * @returns {HistoryResponse} Search results containing matching history entries.
//  */
// router.post(
// 	genRoutePattern('queryHistories'),
// 	asyncHandler(async (req: Request, res: Response): Promise<void> => {
// 		const requiredFields = ['characterId', 'queryTexts'];
// 		validateRequestData(req.body, 'body', requiredFields);

// 		const { characterId, queryTexts, options } = req.body;
// 		validateServiceId(characterId, collectionType);

// 		const response = await loreStore.queryHistories(characterId, queryTexts, options);
// 		res.status(200).json(response);
// 	})
// );

export default router;

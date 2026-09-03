// src/server/routes/recap.routes.ts

import express, { type Request, type Response, type Router } from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import { asyncHandler, genRoutePattern, validateRequestData } from '../util/routeHelpers.js';
import { recapStore } from '../store/recapStore.js';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import { ApiError, RecapInfo, recapWriteSchema } from '@rita-berenice/shared/domain';
import { assertOwnedSession, getSessionUserId } from '../util/authUtils.js';

const router: Router = express.Router();
router.use(verifySession());

/**
 * POST /api/recap/store
 * Creates or updates a single recap entry (factual or relationship).
 * The recap type is determined by the 'type' property within the RecapInfo object.
 */
router.post(
  genRoutePattern('storeRecap'),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = recapWriteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'Invalid recap payload.', 'The recap data is malformed.', {
        issues: parsed.error.flatten(),
      });
    }
    const session = await assertOwnedSession(req, parsed.data.sessionId);
    if (!session.profileId) {
      throw new ApiError(409, 'Session profile is not initialized.', 'Select a profile before saving a recap.');
    }
    const recapInfo: RecapInfo = {
      ...parsed.data,
      userId: getSessionUserId(req),
      characterId: session.characterId,
      profileId: session.profileId,
    };

    const response = await recapStore.storeRecap(recapInfo);
    res.status(201).json(response); // Returns { recapId: string }
  }),
);

/**
 * GET /api/recap/get-by-session/:sessionId/:type
 * Retrieves all recaps for a session, filtered by type ('recap' or 'relationship').
 */
router.get(
  genRoutePattern('getRecapsBySessionId', ['sessionId', 'type']),
  asyncHandler(async (req: Request, res: Response) => {
    validateRequestData(req.params, 'params', ['sessionId', 'type']);
    const { sessionId, type } = req.params;
    await assertOwnedSession(req, sessionId);
    const userId = getSessionUserId(req);

    if (type !== METADATA_TYPES.RECAP && type !== METADATA_TYPES.RELATIONSHIP) {
      return res.status(400).json({ error: 'Invalid recap type specified.' });
    }

    const response = await recapStore.getRecapsBySessionId(sessionId, userId, type);
    res.status(200).json(response);
  }),
);

/**
 * POST /api/recap/query
 * Performs a complex semantic and metadata search for recaps.
 */
router.post(
  genRoutePattern('queryRecaps'),
  asyncHandler(async (req: Request, res: Response) => {
    validateRequestData(req.body, 'body', ['sessionId', 'queryTexts', 'type']);
    const { sessionId, queryTexts, type, filterCriteria, whereDocument, limit } = req.body;
    await assertOwnedSession(req, sessionId);
    const userId = getSessionUserId(req);
    if (type !== METADATA_TYPES.RECAP && type !== METADATA_TYPES.RELATIONSHIP) {
      throw new ApiError(400, 'Invalid recap type specified.');
    }

    const response = await recapStore.queryRecaps(
      sessionId,
      userId,
      queryTexts,
      type,
      filterCriteria,
      whereDocument,
      limit,
    );
    res.status(200).json(response);
  }),
);

export default router;

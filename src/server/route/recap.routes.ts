// src/server/routes/recap.routes.ts

import { Router, Request, Response } from 'express';
import {
	asyncHandler,
	compressData,
	genRoutePattern,
	validateRequestData,
} from '../util/routeHelpers.js';
import { Payload } from '#shared/util/apiHelpers.js';
import { recapStore } from '../store/recapStore.js';
import { RecapInfo } from '#shared/domain/recap/recap.routes.js';
import { METADATA_TYPES } from '#shared/config/constants.js';

const router = Router();

/**
 * POST /api/recap/store
 * Creates or updates a single recap entry (factual or relationship).
 * The recap type is determined by the 'type' property within the RecapInfo object.
 */
router.post(
	genRoutePattern('storeRecap'),
	asyncHandler(async (req: Request, res: Response) => {
		// Basic validation, more can be added
		validateRequestData(req.body, 'body', ['recapId', 'sessionId', 'content', 'type']);
		const recapInfo: RecapInfo = req.body;

		console.log(`API HIT: POST /api/recap/store for recap ${recapInfo.recapId}`);

		const response = await recapStore.storeRecap(recapInfo);
		res.status(201).json(response); // Returns { recapId: string }
	})
);

/**
 * GET /api/recap/get-by-session/:sessionId/:type
 * Retrieves all recaps for a session, filtered by type ('recap' or 'relationship').
 */
router.get(
	genRoutePattern('getRecapsBySessionId', ['sessionId', 'type']),
	asyncHandler(async (req: Request, res: Response<Payload>) => {
		validateRequestData(req.params, 'params', ['sessionId', 'type']);
		const { sessionId, type } = req.params;

		if (type !== METADATA_TYPES.RECAP && type !== METADATA_TYPES.RELATIONSHIP) {
			return res.status(400).json({ payload: 'Invalid recap type specified.' });
		}

		console.log(`API HIT: GET /api/recap/get-by-session/${sessionId}/${type}`);

		const response = await recapStore.getRecapsBySessionId(sessionId, type);
		const payload = compressData(response);
		res.status(200).json({ payload });
	})
);

/**
 * POST /api/recap/query
 * Performs a complex semantic and metadata search for recaps.
 */
router.post(
	genRoutePattern('queryRecaps'),
	asyncHandler(async (req: Request, res: Response<Payload>) => {
		validateRequestData(req.body, 'body', ['sessionId', 'queryTexts', 'type']);
		const { sessionId, queryTexts, type, filterCriteria, whereDocument, limit } = req.body;

		console.log(`API HIT: POST /api/recap/query for session ${sessionId}`);

		const response = await recapStore.queryRecaps(
			sessionId,
			queryTexts,
			type,
			filterCriteria,
			whereDocument,
			limit
		);
		const payload = compressData(response);
		res.status(200).json({ payload });
	})
);

export default router;

// src/server/routes/lore.routes.ts

import express, { type Request, type Response, type Router } from 'express';

import { historyStore } from '../store/historyStore.js';
import {
	asyncHandler,
	genRoutePattern,
	validateRequestData,
	validateServiceId,
} from '../util/routeHelpers.js';
import { RESOURCES } from '../db/resource.type.js';

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
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { characterId } = req.params;
		validateServiceId(characterId, collectionType);

		const path = genRoutePattern('getHistories', ['characterId']);
		console.log(`API HIT: GET ${path.replace(':characterId', characterId)}`);

		const response = await historyStore.getHistories(characterId);
		res.status(200).json(response);
	})
);

/**
 * POST /api/lore/store-history
 * Creates or updates a history entry in the database.
 * @param {HistoryInfo} req.body - The complete history data payload.
 * @returns {object} A confirmation message.
 */
router.post(
	genRoutePattern('storeHistory'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.body, 'body', ['characterId', 'content', 'sequence']);
		const { characterId, historyId } = req.body;

		const path = genRoutePattern('storeHistory');
		console.log(`API HIT: POST ${path} for character ${characterId}, historyId ${historyId}`);

		const response = await historyStore.storeHistory(req.body);
		res.status(201).json(response);
	})
);

/**
 * GET /api/lore/get-history/:historyId
 * Retrieves a single lore entry by its unique ID.
 * @param {string} loreId - The unique ID of the lore entry.
 * @returns {HistoryResponse} An object containing the single lore entry.
 */
router.get(
	genRoutePattern('getHistory', ['historyId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { historyId } = req.params;
		validateServiceId(historyId, collectionType);

		const path = genRoutePattern('getHistory', ['historyId']);
		console.log(`API HIT: GET ${path.replace(':historyId', historyId)}`);

		const response = await historyStore.getHistory(historyId);
		res.status(200).json(response);
	})
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

// 		const path = genRoutePattern('queryHistories');
// 		console.log(`API HIT: POST ${path} for character ${characterId}`);

// 		const response = await loreStore.queryHistories(characterId, queryTexts, options);
// 		res.status(200).json(response);
// 	})
// );

export default router;

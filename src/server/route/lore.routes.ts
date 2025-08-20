// src/server/routes/lore.routes.ts

import express, { type Request, type Response } from 'express';

import { loreStore } from '../store/loreStore.js'; // Assuming store is at this path

import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import {
	asyncHandler,
	compressData,
	genRoutePattern,
	validateRequestData,
	validateServiceId,
} from '../util/routeHelpers.js';
import { HistoryInfo, LoreInfo } from '#shared/domain/lore/LoreInterfaces.js';
import { Payload } from '#shared/util/apiHelpers.js';

const router = express.Router();
const collectionType = COLLECTIONS.LORE;

// --- LORE ROUTES ---

/**
 * GET /api/lore/get-lores/:characterId
 * Retrieves all lore entries for a specific character.
 * @param {string} characterId - The ID of the character.
 * @returns {LoreResponse} An object containing the list of lores.
 */
router.get(
	genRoutePattern('getLores', ['characterId']),
	asyncHandler(async (req: Request, res: Response<Payload>): Promise<void> => {
		const { characterId } = req.params;
		validateServiceId(characterId, collectionType);

		const path = genRoutePattern('getLores', ['characterId']);
		console.log(`API HIT: GET ${path.replace(':characterId', characterId)}`);

		const response = await loreStore.getLores(characterId);
		const payload = compressData(response);
		res.status(200).json({ payload });
	})
);

/**
 * GET /api/lore/get-lore/:loreId
 * Retrieves a single lore entry by its unique ID.
 * @param {string} loreId - The unique ID of the lore entry.
 * @returns {LoreResponse} An object containing the single lore entry.
 */
router.get(
	genRoutePattern('getLore', ['loreId']),
	asyncHandler(async (req: Request, res: Response<Payload>): Promise<void> => {
		const { loreId } = req.params;
		validateServiceId(loreId, collectionType);

		const path = genRoutePattern('getLore', ['loreId']);
		console.log(`API HIT: GET ${path.replace(':loreId', loreId)}`);

		const response = await loreStore.getLore(loreId);
		const payload = compressData(response);
		res.status(200).json({ payload });
	})
);

/**
 * POST /api/lore/store-lore
 * Creates or updates a lore entry in the database.
 * @param {LoreInfo} req.body - The complete lore data payload.
 * @returns {object} A confirmation message.
 */
router.post(
	genRoutePattern('storeLore'),
	asyncHandler(
		async (
			req: Request<object, { message: string }, LoreInfo>,
			res: Response<{ message: string }>
		): Promise<void> => {
			validateRequestData(req.body, 'body', ['characterId', 'content']);
			const { characterId, loreId } = req.body;

			const path = genRoutePattern('storeLore');
			console.log(`API HIT: POST ${path} for character ${characterId}, loreId ${loreId}`);

			await loreStore.storeLore(req.body);
			res.status(201).json({ message: 'Lore stored successfully.' });
		}
	)
);

// /**
//  * POST /api/lore/query-lores
//  * Performs a semantic search for lore entries for a character, with optional filters.
//  * @param {object} req.body - Contains characterId, queryTexts, and optional filters.
//  * @returns {LoreResponse} Search results containing matching lore entries.
//  */
// router.post(
// 	genRoutePattern('queryLores'),
// 	asyncHandler(async (req: Request, res: Response<Payload>): Promise<void> => {
// 		const requiredFields = ['characterId', 'queryTexts'];
// 		validateRequestData(req.body, 'body', requiredFields);

// 		const { characterId, queryTexts, options } = req.body;
// 		validateServiceId(characterId, collectionType);

// 		const path = genRoutePattern('queryLores');
// 		console.log(`API HIT: POST ${path} for character ${characterId}`);

// 		const response = await loreStore.queryLores(characterId, queryTexts, options);
// 		const payload = compressData(response);
// 		res.status(200).json({ payload });
// 	})
// );

// --- HISTORY ROUTES ---

/**
 * GET /api/lore/get-histories/:characterId
 * Retrieves all history entries for a specific character, sorted by sequence.
 * @param {string} characterId - The ID of the character.
 * @returns {HistoryResponse} An object containing the list of histories.
 */
router.get(
	genRoutePattern('getHistories', ['characterId']),
	asyncHandler(async (req: Request, res: Response<Payload>): Promise<void> => {
		const { characterId } = req.params;
		validateServiceId(characterId, collectionType);

		const path = genRoutePattern('getHistories', ['characterId']);
		console.log(`API HIT: GET ${path.replace(':characterId', characterId)}`);

		const response = await loreStore.getHistories(characterId);
		const payload = compressData(response);
		res.status(200).json({ payload });
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
	asyncHandler(
		async (
			req: Request<object, { message: string }, HistoryInfo>,
			res: Response<{ message: string }>
		): Promise<void> => {
			validateRequestData(req.body, 'body', ['characterId', 'content', 'sequence']);
			const { characterId, historyId } = req.body;

			const path = genRoutePattern('storeHistory');
			console.log(`API HIT: POST ${path} for character ${characterId}, historyId ${historyId}`);

			await loreStore.storeHistory(req.body);
			res.status(201).json({ message: 'History stored successfully.' });
		}
	)
);

// /**
//  * POST /api/lore/query-histories
//  * Performs a semantic search for history entries for a character.
//  * @param {object} req.body - Contains characterId and queryTexts.
//  * @returns {HistoryResponse} Search results containing matching history entries.
//  */
// router.post(
// 	genRoutePattern('queryHistories'),
// 	asyncHandler(async (req: Request, res: Response<Payload>): Promise<void> => {
// 		const requiredFields = ['characterId', 'queryTexts'];
// 		validateRequestData(req.body, 'body', requiredFields);

// 		const { characterId, queryTexts, options } = req.body;
// 		validateServiceId(characterId, collectionType);

// 		const path = genRoutePattern('queryHistories');
// 		console.log(`API HIT: POST ${path} for character ${characterId}`);

// 		const response = await loreStore.queryHistories(characterId, queryTexts, options);
// 		const payload = compressData(response);
// 		res.status(200).json({ payload });
// 	})
// );

export default router;

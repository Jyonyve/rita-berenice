// src/server/routes/lore.routes.ts

import express, { type Request, type Response, type Router } from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';

import { loreStore } from '../store/loreStore.js'; // Assuming store is at this path
import { RESOURCES } from '../db/resource.type.js';
import {
	asyncHandler,
	genRoutePattern,
	validateRequestData,
	validateServiceId,
} from '../util/routeHelpers.js';
import { assertOwnedCharacter, getSessionUserId } from '../util/authUtils.js';

const router: Router = express.Router();

const collectionType = RESOURCES.LORE;

// --- LORE ROUTES ---

/**
 * GET /api/lore/get-lores-by-character/:characterId
 * Retrieves all lore entries for a specific character.
 * @param {string} characterId - The ID of the character.
 * @returns {LoreResponse} An object containing the list of lores.
 */
router.get(
	genRoutePattern('getLoresByCharacter', ['characterId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { characterId } = req.params;
		validateServiceId(characterId, collectionType);

		const path = genRoutePattern('getLoresByCharacter', ['characterId']);
		console.log(`API HIT: GET ${path.replace(':characterId', characterId)}`);

		const response = await loreStore.getLoresByCharacter(characterId);
		res.status(200).json(response);
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
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { loreId } = req.params;
		validateServiceId(loreId, collectionType);

		const path = genRoutePattern('getLore', ['loreId']);
		console.log(`API HIT: GET ${path.replace(':loreId', loreId)}`);

		const response = await loreStore.getLore(loreId);
		res.status(200).json(response);
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
	verifySession(),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.body, 'body', ['characterId', 'content']);
		const { characterId, loreId } = req.body;
		await assertOwnedCharacter(req, characterId);
		req.body.userId = getSessionUserId(req);

		const path = genRoutePattern('storeLore');
		console.log(`API HIT: POST ${path} for character ${characterId}, loreId ${loreId}`);

		const response = await loreStore.storeLore(req.body);
		res.status(201).json(response);
	})
);

// /**
//  * POST /api/lore/query-lores
//  * Performs a semantic search for lore entries for a character, with optional filters.
//  * @param {object} req.body - Contains characterId, queryTexts, and optional filters.
//  * @returns {LoreResponse} Search results containing matching lore entries.
//  */
// router.post(
// 	genRoutePattern('queryLores'),
// 	asyncHandler(async (req: Request, res: Response): Promise<void> => {
// 		const requiredFields = ['characterId', 'queryTexts'];
// 		validateRequestData(req.body, 'body', requiredFields);

// 		const { characterId, queryTexts, options } = req.body;
// 		validateServiceId(characterId, collectionType);

// 		const path = genRoutePattern('queryLores');
// 		console.log(`API HIT: POST ${path} for character ${characterId}`);

// 		const response = await loreStore.queryLores(characterId, queryTexts, options);
// 		res.status(200).json(response);
// 	})
// );

export default router;

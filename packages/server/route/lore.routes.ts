// src/server/routes/lore.routes.ts

import express, { type Request, type Response, type Router } from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import { ApiError } from '@rita-berenice/shared/domain';

import { loreStore } from '../store/loreStore.js'; // Assuming store is at this path
import { RESOURCES } from '../db/resource.type.js';
import {
	asyncHandler,
	genRoutePattern,
	validateRequestData,
	validateServiceId,
} from '../util/routeHelpers.js';
import { assertOwnedCharacter, assertOwnedSession, getSessionUserId } from '../util/authUtils.js';

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
	verifySession(),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { characterId } = req.params;
		validateServiceId(characterId, collectionType);
		await assertOwnedCharacter(req, characterId);

		const response = await loreStore.getLoresByCharacter(characterId, getSessionUserId(req));
		res.status(200).json(response);
	})
);

/**
 * GET /api/lore/get-lores-by-session/:sessionId
 * Retrieves character/world lore plus lore scoped to this exact session.
 */
router.get(
	genRoutePattern('getLoresBySession', ['sessionId']),
	verifySession(),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { sessionId } = req.params;
		validateServiceId(sessionId, collectionType);
		const session = await assertOwnedSession(req, sessionId);

		const response = await loreStore.getLoresBySession(
			sessionId,
			session.characterId,
			getSessionUserId(req)
		);
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
	verifySession(),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { loreId } = req.params;
		validateServiceId(loreId, collectionType);

		const response = await loreStore.getLore(loreId, getSessionUserId(req));
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
		validateRequestData(req.body, 'body', ['content']);
		const characterIds = Array.isArray(req.body.characterIds) ? req.body.characterIds : [];
		await Promise.all(
			characterIds.map((characterId: string) => assertOwnedCharacter(req, characterId))
		);

		if (req.body.sessionId) {
			const session = await assertOwnedSession(req, req.body.sessionId);
			if (!characterIds.includes(session.characterId)) {
				req.body.characterIds = [...characterIds, session.characterId];
			}
		} else if (req.body.category !== 'World' && characterIds.length === 0) {
			throw new ApiError(400, 'Character lore must reference at least one owned character.');
		}
		req.body.userId = getSessionUserId(req);

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

// 		const response = await loreStore.queryLores(characterId, queryTexts, options);
// 		res.status(200).json(response);
// 	})
// );

export default router;

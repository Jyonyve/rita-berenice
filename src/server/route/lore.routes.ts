// src/server/routes/lore.routes.ts

import express, { type Request, type Response } from 'express';
import { asyncHandler, validateRequestData, validateServiceId } from '../util/index.ts';
import { genRoutePattern, COLLECTIONS } from '#shared/index.ts';
import { loreStore } from '../store/loreStore.ts';

const router = express.Router();
const collectionType = COLLECTIONS.LORE;

// GET /api/lore/get-lores/:characterId
router.get(
	genRoutePattern('getLores', ['characterId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.params, 'params', ['characterId']);
		const { characterId } = req.params;

		const response = await loreStore.getLores(characterId);
		res.status(200).json(response);
	})
);

// GET /api/lore/get-lore/:loreId
router.get(
	genRoutePattern('getLore', ['loreId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateServiceId(req.params.loreId, collectionType);
		validateRequestData(req.params, 'params', ['loreId']);
		const { loreId } = req.params;

		const response = await loreStore.getLore(loreId);
		res.status(200).json(response);
	})
);

// POST /api/lore/query-lores
router.post(
	genRoutePattern('queryLores'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const requiredFields = ['characterId', 'queryTexts'];
		validateRequestData(req.body, 'body', requiredFields);

		const { characterId, queryTexts, options } = req.body;
		const response = await loreStore.queryLores(characterId, queryTexts, options);
		res.status(200).json(response);
	})
);

export default router;

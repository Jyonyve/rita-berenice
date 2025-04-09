// src/server/routes/character.routes.ts
import { CharacterInfo } from '#root/src/shared/domain/index.ts';
import { genRoutePattern } from '#root/src/shared/index.ts';
import express, { type Request, type Response } from 'express';
import { characterService } from '#server/service/index.ts';

const router = express.Router();
const MODULE_NAME = 'character'; // Define module name once

// --- GET /api/character/get-all-characters ---
// Corresponds to characterService.getAllCharacters
router.get(
	genRoutePattern(MODULE_NAME, 'getAllCharacters'),
	async (req: Request, res: Response): Promise<any> => {
		const path = genRoutePattern(MODULE_NAME, 'getAllCharacters');
		console.log(`API HIT: GET ${path}`);
		try {
			const characters = await characterService.getAllCharacters();
			res.json(characters);
		} catch (error: any) {
			console.error(`Error in GET ${path}:`, error);
			res.status(500).json({ error: 'Failed to fetch characters' });
		}
	}
);

// --- GET /api/character/get-character-by-id/:id ---
// Corresponds to characterService.getCharacterById
router.get(
	genRoutePattern(MODULE_NAME, 'getCharacterById', ['id']),
	async (req: Request<{ id: string }>, res: Response): Promise<any> => {
		const { id } = req.params;
		const path = genRoutePattern(MODULE_NAME, 'getCharacterById', ['id']);
		console.log(`API HIT: GET ${path.replace(':id', id)}`);
		try {
			const character = await characterService.getCharacterById(id);
			if (!character) {
				return res.status(404).json({ error: 'Character not found' });
			}
			res.json(character);
		} catch (error: any) {
			console.error(`Error in GET ${path.replace(':id', id)}:`, error);
			res.status(500).json({ error: 'Failed to fetch character details' });
		}
	}
);

// --- POST /api/character/store-character ---
// Corresponds to characterService.storeCharacter (which uses upsert)
// Expects a full CharacterInfo object in the body
router.post(
	genRoutePattern(MODULE_NAME, 'storeCharacter'),
	async (req: Request<{}, any, CharacterInfo>, res: Response): Promise<any> => {
		const characterData = req.body; // Expects full CharacterInfo
		const path = genRoutePattern(MODULE_NAME, 'storeCharacter');
		console.log(`API HIT: POST ${path} for ID: ${characterData?.id}`);

		// Basic validation
		if (
			!characterData ||
			typeof characterData !== 'object' ||
			!characterData.id ||
			!characterData.metadata?.name
		) {
			return res.status(400).json({ error: 'Invalid character data in request body' });
		}

		try {
			// Call the service which handles upsert logic
			await characterService.storeCharacter(characterData);
			// Respond with the data that was stored/updated
			res.status(200).json(characterData); // 200 OK since it's an upsert
		} catch (error: any) {
			console.error(`Error in POST ${path}:`, error);
			res.status(500).json({ error: 'Failed to store character' });
		}
	}
);

// --- GET /api/character/query-characters?q=...&limit=... ---
// Corresponds to characterService.queryCharacters
router.get(
	genRoutePattern(MODULE_NAME, 'queryCharacters'),
	async (req: Request, res: Response): Promise<any> => {
		const query = req.query.q as string | undefined;
		const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10; // Default limit
		const path = genRoutePattern(MODULE_NAME, 'queryCharacters');
		console.log(`API HIT: GET ${path}?q=${query}&limit=${limit}`);

		if (!query) {
			return res.status(400).json({ error: 'Missing query parameter "q"' });
		}

		try {
			const characters = await characterService.queryCharacters(query, limit);
			res.json(characters);
		} catch (error: any) {
			console.error(`Error in GET ${path}:`, error);
			res.status(500).json({ error: 'Failed to query characters' });
		}
	}
);

// --- Note: The old PUT route is removed as 'storeCharacter' handles upserts via POST ---
// --- Note: The old GET /:characterName route is removed in favour of GET /get-character-by-id/:id ---
// --- You could add a GET /get-character-by-name/:name route if needed, requiring a new service method ---

export default router;

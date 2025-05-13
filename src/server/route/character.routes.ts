// src/server/routes/character.routes.ts
import { genRoutePattern, CharacterMetadata, COLLECTIONS } from '#shared/index.ts';
import express, { type Request, type Response } from 'express';
import { characterService } from '../service/index.ts';
import { asyncHandler, validateRequestData, validateServiceId } from '../util/index.ts';

const router = express.Router();
const collectionType = COLLECTIONS.CHARACTER;

/**
 * GET /api/character/get-all-characters
 * Retrieves all registered characters from the database
 * @returns {CharacterResponse} Array of character objects
 * @throws {500} Internal server error if database fetch fails
 */
router.get(
	genRoutePattern('getAllCharacters'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const path = genRoutePattern('getAllCharacters');
		console.log(`API HIT: GET ${path}`);

		validateRequestData(req.body, 'body');
		const response = await characterService.getAllCharacters();
		res.status(200).json(response);
		return;
	})
);

/**
 * GET /api/character/get-character/:characterId
 * Retrieves a specific character by unique identifier
 * @param {string} characterId - UUID of the character to retrieve
 * @returns {CharacterResponse} Complete character data
 * @throws {404} Character not found with specified ID
 * @throws {500} Internal server error if database fetch fails
 */
router.get(
	genRoutePattern('getCharacter', ['characterId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { characterId } = req.params;
		validateServiceId(characterId, collectionType);

		const path = genRoutePattern('getCharacter', ['characterId']);
		console.log(`API HIT: GET ${path.replace(':characterId', characterId)}`);
		const response = await characterService.getCharacter(characterId);

		res.status(200).json(response);
		return;
	})
);

/**
 * GET /api/character/get-characters-by-show-name/:showName
 * Retrieves characters associated with a specific show
 * @param {string} showName - Exact name of the show to filter by
 * @returns {CharacterResponse} Array of matching character objects
 * @throws {404} No characters found for specified show name
 * @throws {500} Internal server error if database fetch fails
 */
router.get(
	genRoutePattern('getCharactersByShowName', ['showName']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.params, 'params', ['showName']);
		const { showName } = req.params;
		const path = genRoutePattern('getCharactersByShowName', ['showName']);
		console.log(`API HIT: GET ${path.replace(':showName', showName)}`);

		const response = await characterService.getCharactersByShowName(showName);

		res.status(200).json(response);
		return;
	})
);

/**
 * POST /api/character/store-character
 * Creates or updates a character record in the database
 * @param {CharacterMetadata} req.body - Complete character data payload
 * @returns {void} Successfully stored character data
 * @throws {400} Invalid request body structure
 * @throws {500} Internal server error if database operation fails
 */
router.post(
	genRoutePattern('storeCharacter'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		// req validation
		const requiredFields: (keyof CharacterMetadata)[] = ['characterId', 'description', 'instruction'];
		validateRequestData(req.body, 'body', requiredFields);

		// api
		const path = genRoutePattern('storeCharacter');
		console.log(`API HIT: POST ${path} for ID: ${req.body?.characterId}`);

		const response = await characterService.storeCharacter(req.body);

		res.status(200).json(response);
		return;
	})
);

export default router;

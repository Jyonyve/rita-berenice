// src/server/routes/character.routes.ts

import express, { type Request, type Response, type Router } from 'express';
import { COLLECTIONS } from '../db/chroma.type.js';
import { characterStore } from '../store/characterStore.js';
import {
	asyncHandler,
	genRoutePattern,
	validateRequestData,
	validateServiceId,
} from '../util/routeHelpers.js';

import fs from 'fs';
import path from 'path';
import {
	BASE_CHARACTER_IMAGE_DIR,
	RUNTIME_CHARACTER_IMAGE_DIR,
} from '@rita-berenice/shared/config';
import { characterUpload, processCharacterImage } from '../util/imageProcessingUtils.js';
import { CharacterInfo } from '@rita-berenice/shared/domain';

const router: Router = express.Router();
const collectionType = COLLECTIONS.CHARACTER;

/**
 * GET /api/character/get-all-characters
 * Retrieves all registered characters, sorted by most recently updated
 * @returns {CharacterResponse} Array of character objects
 * @throws {500} Internal server error if database fetch fails
 */
router.get(
	genRoutePattern('getAllCharacters'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const path = genRoutePattern('getAllCharacters');
		console.log(`API HIT: GET ${path}`);

		const response = await characterStore.getAllCharacters();
		res.status(200).json(response);
	})
);

/**
 * GET /api/character/get-character/:characterId
 * Retrieves a specific character by its unique identifier
 * @param {string} characterId - The ID of the character to retrieve
 * @returns {CharacterResponse} The complete character data
 * @throws {404} Character not found with the specified ID
 * @throws {500} Internal server error
 */
router.get(
	genRoutePattern('getCharacter', ['characterId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { characterId } = req.params;
		validateServiceId(characterId, collectionType);

		const path = genRoutePattern('getCharacter', ['characterId']);
		console.log(`API HIT: GET ${path.replace(':characterId', characterId)}`);

		const response = await characterStore.getCharacter(characterId);
		res.status(200).json(response);
	})
);

/**
 * GET /api/character/get-characters-by-show-name/:showName
 * Retrieves all characters associated with a specific show name
 * @param {string} showName - The exact name of the show to filter by
 * @returns {CharacterResponse} Array of matching character objects
 * @throws {404} No characters found for the specified show name
 * @throws {500} Internal server error
 */
router.get(
	genRoutePattern('getCharactersByShowName', ['showName']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.params, 'params', ['showName']);
		const { showName } = req.params;

		const path = genRoutePattern('getCharactersByShowName', ['showName']);
		console.log(`API HIT: GET ${path.replace(':showName', showName)}`);

		const response = await characterStore.getCharactersByShowName(showName);
		res.status(200).json(response);
	})
);

/**
 * GET /api/character/get-characters-by-user-id/:userId
 * Retrieves all characters associated with a specific show name
 * @param {string} showName - The exact name of the show to filter by
 * @returns {CharacterResponse} Array of matching character objects
 * @throws {404} No characters found for the specified show name
 * @throws {500} Internal server error
 */
router.get(
	genRoutePattern('getCharactersByUserId', ['userId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.params, 'params', ['userId']);
		const { userId } = req.params;

		const path = genRoutePattern('getCharactersByUserId', ['userId']);
		console.log(`API HIT: GET ${path.replace(':userId', userId)}`);

		const response = await characterStore.getCharactersByUserId(userId);
		res.status(200).json(response);
	})
);

/**
 * POST /api/character/store-character
 * Creates a new character or updates an existing one
 * @param {CharacterInfo} req.body - The character data payload
 * @returns {StoreCharacterResponse} Confirmation of storage with character ID and timestamp
 * @throws {400} Invalid request body structure
 * @throws {500} Internal server error
 */
router.post(
	genRoutePattern('storeCharacter'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const requiredFields = [
			'title',
			'contact',
			'description',
			'instruction',
			'gender',
			'name',
			'showName',
			'userId',
			'firstMessage',
		];
		validateRequestData(req.body, 'body', requiredFields);

		const characterInfo = req.body as CharacterInfo;
		const path = genRoutePattern('storeCharacter');
		console.log(`API HIT: POST ${path} for character: ${characterInfo.name}`);

		const response = await characterStore.storeCharacter(characterInfo);

		// Use 201 for resource creation/update and handle the object response correctly
		res.status(201).json(response);
	})
);

/**
 * POST /api/character/upload-character-image
 * Uploads and saves character images to the public folder
 */
router.post(
	genRoutePattern('uploadCharacterImage'),
	characterUpload.single('image'), // 'image' is the field name from frontend FormData
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.body, 'body', ['characterId', 'emotionKey']);

		const { characterId, emotionKey, crop } = req.body; // crop comes from FormData body, not file
		const file = req.file;

		if (!file) {
			res.status(400).json({ error: 'No image file provided' });
			return;
		}

		try {
			// Parse crop data if provided (stringified JSON from FormData)
			const cropConfig = crop ? JSON.parse(crop) : undefined;

			const imagePath = await processCharacterImage(file.buffer, characterId, parseInt(emotionKey), {
				crop: cropConfig,
			});

			res.status(200).json({
				success: true,
				message: 'Character image uploaded successfully',
				filePath: imagePath,
				characterId, // Return characterId for frontend cache invalidation
			});
		} catch (error) {
			console.error('Error processing character image:', error);
			res.status(500).json({ error: 'Failed to process character image' });
		}
	})
);

/**
 * POST /api/character/create-character-folder
 * Creates a folder for character assets
 */
router.post(
	genRoutePattern('createCharacterFolder'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.body, 'body', ['characterId']);

		const { characterId } = req.body;
		const routePath = genRoutePattern('createCharacterFolder');
		console.log(`API HIT: POST ${routePath} for character: ${characterId}`);

		// ✅ Use constant for directory path
		const uploadDir = `${BASE_CHARACTER_IMAGE_DIR}/${characterId}`;
		const fullUploadPath = path.join(process.cwd(), uploadDir);

		try {
			if (!fs.existsSync(fullUploadPath)) {
				fs.mkdirSync(fullUploadPath, { recursive: true });
				console.log(`Created directory: ${fullUploadPath}`);
			}

			// ✅ Use constant for URL path
			res
				.status(200)
				.json({
					success: true,
					message: 'Character folder created successfully',
					path: `${RUNTIME_CHARACTER_IMAGE_DIR}/${characterId}`,
				});
		} catch (error) {
			console.error('Error creating directory:', error);
			res.status(500).json({ error: 'Failed to create character folder' });
		}
	})
);

export default router;

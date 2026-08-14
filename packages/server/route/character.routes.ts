// src/server/routes/character.routes.ts

import express, { type Request, type Response, type Router } from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import { RESOURCES } from '../db/resource.type.js';
import { characterStore } from '../store/characterStore.js';
import {
	assertCharacterVisibleToUser,
	filterCharacterResponseByViewer,
} from '../store/characterStore.js';
import {
	asyncHandler,
	genRoutePattern,
	validateRequestData,
	validateServiceId,
} from '../util/routeHelpers.js';

import {
	EmotionKey,
	RUNTIME_CHARACTER_IMAGE_DIR,
	validEmotionKeys,
} from '@rita-berenice/shared/config';
import {
	characterUpload,
	deleteCharacterImage,
	processCharacterImagePair,
} from '../util/imageProcessingUtils.js';
import { CharacterInfo } from '@rita-berenice/shared/domain';
import {
	assertCharacterOwnerIfExists,
	assertOwnedCharacter,
	assertSessionUser,
	getSessionUserId,
} from '../util/authUtils.js';
import { flowLogger, serializeError } from '../util/jsonlLogger.js';
import { ensureImageStorageDirectory } from '../util/imageStorageUtils.js';
import {
	buildCharacterGlossarySource,
	characterGlossaryJobService,
} from '../service/characterGlossaryJobService.js';

const router: Router = express.Router();
const collectionType = RESOURCES.CHARACTER;

/**
 * GET /api/character/get-all-characters
 * Retrieves all registered characters, sorted by most recently updated
 * @returns {CharacterResponse} Array of character objects
 * @throws {500} Internal server error if database fetch fails
 */
router.get(
	genRoutePattern('getAllCharacters'),
	verifySession(),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const viewerUserId = getSessionUserId(req);
		const response = await characterStore.getAllCharacters();
		res.status(200).json(filterCharacterResponseByViewer(response, viewerUserId));
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
	verifySession(),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { characterId } = req.params;
		validateServiceId(characterId, collectionType);

		const viewerUserId = getSessionUserId(req);
		const response = await characterStore.getCharacter(characterId);
		res.status(200).json(assertCharacterVisibleToUser(response, viewerUserId));
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
	verifySession(),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.params, 'params', ['showName']);
		const { showName } = req.params;

		const viewerUserId = getSessionUserId(req);
		const response = await characterStore.getCharactersByShowName(showName);
		res.status(200).json(filterCharacterResponseByViewer(response, viewerUserId));
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
	verifySession(),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.params, 'params', ['userId']);
		const userId = assertSessionUser(req, req.params.userId);

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
	verifySession(),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const requiredFields = [
			'title',
			'contact',
			'description',
			'worldIntroduction',
			'gender',
			'name',
			'showName',
			'userId',
			'firstMessage',
		];
		validateRequestData(req.body, 'body', requiredFields);

		const characterInfo = req.body as CharacterInfo;
		await assertCharacterOwnerIfExists(req, characterInfo.characterId);
		characterInfo.userId = getSessionUserId(req);

		const response = await characterStore.storeCharacter(characterInfo);
		const sourceText = buildCharacterGlossarySource(characterInfo);
		if (sourceText) {
			const glossaryJob = characterGlossaryJobService.enqueue({
				characterId: characterInfo.characterId,
				userId: characterInfo.userId,
				sourceText,
			});
			flowLogger.info('character.routes', 'characterGlossary.queued', {
				characterId: characterInfo.characterId,
				jobId: glossaryJob.jobId,
				status: glossaryJob.status,
				sourceLength: sourceText.length,
			});
		}

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
	verifySession(),
	characterUpload.fields([
		{ name: 'image', maxCount: 1 },
		{ name: 'avatar', maxCount: 1 },
	]),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.body, 'body', ['characterId', 'emotionKey']);

		const { characterId, emotionKey } = req.body;
		await assertOwnedCharacter(req, characterId);
		const parsedEmotionKey = Number(emotionKey);
		if (
			!Number.isInteger(parsedEmotionKey) ||
			!validEmotionKeys.has(parsedEmotionKey as EmotionKey)
		) {
			res.status(400).json({ error: 'Invalid emotion key' });
			return;
		}
		const files = req.files as Record<string, Express.Multer.File[]> | undefined;
		const portraitFile = files?.image?.[0];
		const avatarFile = files?.avatar?.[0];

		if (!portraitFile || !avatarFile) {
			res.status(400).json({ error: 'Both portrait and avatar image files are required' });
			return;
		}

		try {
			const imagePaths = await processCharacterImagePair(
				portraitFile.buffer,
				avatarFile.buffer,
				characterId,
				parsedEmotionKey
			);

			res.status(200).json({
				success: true,
				message: 'Character portrait and avatar uploaded successfully',
				...imagePaths,
				characterId, // Return characterId for frontend cache invalidation
			});
		} catch (error) {
			flowLogger.error('character.routes', 'characterImage.process.failed', {
				characterId,
				...serializeError(error),
			});
			res.status(500).json({ error: 'Failed to process character image' });
		}
	})
);

router.delete(
	genRoutePattern('deleteCharacterImage'),
	verifySession(),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.body, 'body', ['characterId', 'emotionKey']);
		const { characterId, emotionKey } = req.body;
		await assertOwnedCharacter(req, characterId);
		await deleteCharacterImage(characterId, Number(emotionKey));
		res.status(204).send();
	})
);

/**
 * POST /api/character/create-character-folder
 * Creates a folder for character assets
 */
router.post(
	genRoutePattern('createCharacterFolder'),
	verifySession(),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.body, 'body', ['characterId']);

		const { characterId } = req.body;
		await assertOwnedCharacter(req, characterId);

		try {
			ensureImageStorageDirectory(`${RUNTIME_CHARACTER_IMAGE_DIR}/${characterId}`);
			flowLogger.info('character.routes', 'characterFolder.ready', { characterId });

			// ✅ Use constant for URL path
			res
				.status(200)
				.json({
					success: true,
					message: 'Character folder created successfully',
					path: `${RUNTIME_CHARACTER_IMAGE_DIR}/${characterId}`,
				});
		} catch (error) {
			flowLogger.error('character.routes', 'characterFolder.create.failed', {
				characterId,
				...serializeError(error),
			});
			res.status(500).json({ error: 'Failed to create character folder' });
		}
	})
);

export default router;

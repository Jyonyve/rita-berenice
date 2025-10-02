// src/server/routes/glossary.routes.ts
import express, { type Request, type Response, type Router } from 'express';

import { termStore } from '../store/termStore.js';
import { COLLECTIONS } from '../db/chroma.type.js';
import {
	asyncHandler,
	compressData,
	genRoutePattern,
	validateRequestData,
} from '../util/routeHelpers.js';
import { SessionTermInfo, CharacterTermInfo } from '@rita-berenice/shared/domain';
import { Payload } from '@rita-berenice/shared/util';

const router: Router = express.Router();

const collectionType = COLLECTIONS.TERM;

/**
 * POST /api/glossary/store-session-term
 * Creates or updates a session term in the glossary for a specific session.
 * Also updates the in-memory cache for that session.
 * @param {SessionTermCdo | SessionTermInfo} req.body - The session term data to be stored.
 * @returns {object} A success confirmation message.
 */
router.post(
	genRoutePattern('storeSessionTerm'),
	asyncHandler(async (req: Request, res: Response<{ termId: string }>): Promise<void> => {
		const requiredFields: (keyof SessionTermInfo)[] = ['koreanTerm', 'sessionId'];
		validateRequestData(req.body, 'body', requiredFields);

		const path = genRoutePattern('storeSessionTerm');
		console.log(
			`API HIT: POST ${path} for session ${req.body.sessionId}, term "${req.body.koreanTerm}"`
		);

		const response = await termStore.storeSessionTerm(req.body);
		res.status(201).json(response);
	})
);

/**
 * POST /api/glossary/store-character-term
 * Creates or updates a character term in the glossary for a specific character.
 * Also updates the in-memory cache for that character.
 * @param {CharacterTermCdo | CharacterTermInfo} req.body - The character term data to be stored.
 * @returns {object} A success confirmation message.
 */
router.post(
	genRoutePattern('storeCharacterTerm'),
	asyncHandler(async (req: Request, res: Response<{ termId: string }>): Promise<void> => {
		const requiredFields: (keyof CharacterTermInfo)[] = ['koreanTerm', 'characterId'];
		validateRequestData(req.body, 'body', requiredFields);

		const path = genRoutePattern('storeCharacterTerm');
		console.log(
			`API HIT: POST ${path} for character ${req.body.characterId}, term "${req.body.koreanTerm}"`
		);

		const response = await termStore.storeCharacterTerm(req.body);
		res.status(201).json(response);
	})
);

/**
 * POST /api/glossary/store-session-terms
 * Bulk stores multiple session terms for efficiency.
 * @param {(SessionTermCdo | SessionTermInfo)[]} req.body.terms - Array of session terms to store.
 * @returns {object} A success confirmation message.
 */
router.post(
	genRoutePattern('storeSessionTerms'),
	asyncHandler(async (req: Request, res: Response<{ termIds: string[] }>): Promise<void> => {
		validateRequestData(req.body, 'body', ['terms']);

		const path = genRoutePattern('storeSessionTerms');
		console.log(`API HIT: POST ${path} for bulk storing ${req.body.terms.length} session terms`);

		const response = await termStore.storeSessionTerms(req.body.terms);
		res.status(201).json(response);
	})
);

/**
 * POST /api/glossary/store-character-terms
 * Bulk stores multiple character terms for efficiency.
 * @param {(CharacterTermCdo | CharacterTermInfo)[]} req.body.terms - Array of character terms to store.
 * @returns {object} A success confirmation message.
 */
router.post(
	genRoutePattern('storeCharacterTerms'),
	asyncHandler(async (req: Request, res: Response<{ termIds: string[] }>): Promise<void> => {
		validateRequestData(req.body, 'body', ['terms']);

		const path = genRoutePattern('storeCharacterTerms');
		console.log(`API HIT: POST ${path} for bulk storing ${req.body.terms.length} character terms`);

		const response = await termStore.storeCharacterTerms(req.body.terms);
		res.status(201).json(response);
	})
);

/**
 * GET /api/glossary/get-term-by-korean/:id/:koreanTerm/:type
 * Retrieves a specific term by its Korean name for a given session or character.
 * @param {string} id - The ID of the session or character.
 * @param {string} koreanTerm - The Korean term to look up.
 * @param {string} type - The type of term ('session' or 'character').
 * @returns {TermResponse} An object containing the found term information.
 */
router.get(
	genRoutePattern('getTermByKorean', ['id', 'koreanTerm', 'type']),
	asyncHandler(async (req: Request, res: Response<Payload>): Promise<void> => {
		const { id, koreanTerm, type } = req.params;

		validateRequestData(req.params, 'params', ['koreanTerm', 'type']);

		const path = genRoutePattern('getTermByKorean', ['id', 'koreanTerm', 'type']);
		console.log(
			`API HIT: GET ${path.replace(':id', id).replace(':koreanTerm', koreanTerm).replace(':type', type)}`
		);

		const response = await termStore.getTermByKorean(id, koreanTerm, type as 'session' | 'character');
		const payload = compressData(response);
		res.status(200).json({ payload });
	})
);

/**
 * GET /api/glossary/get-terms-by-session-id/:sessionId
 * Retrieves all glossary terms associated with a specific session.
 * @param {string} sessionId - The ID of the session.
 * @returns {TermResponse} An object containing a list of all terms for the session.
 */
router.get(
	genRoutePattern('getTermsBySessionId', ['sessionId']),
	asyncHandler(async (req: Request, res: Response<Payload>): Promise<void> => {
		const { sessionId } = req.params;

		const path = genRoutePattern('getTermsBySessionId', ['sessionId']);
		console.log(`API HIT: GET ${path.replace(':sessionId', sessionId)}`);

		const response = await termStore.getTermsBySessionId(sessionId);
		const payload = compressData(response);
		res.status(200).json({ payload });
	})
);

/**
 * GET /api/glossary/get-terms-by-character-id/:characterId
 * Retrieves all glossary terms associated with a specific character.
 * @param {string} characterId - The ID of the character.
 * @returns {TermResponse} An object containing a list of all terms for the character.
 */
router.get(
	genRoutePattern('getTermsByCharacterId', ['characterId']),
	asyncHandler(async (req: Request, res: Response<Payload>): Promise<void> => {
		const { characterId } = req.params;

		const path = genRoutePattern('getTermsByCharacterId', ['characterId']);
		console.log(`API HIT: GET ${path.replace(':characterId', characterId)}`);

		const response = await termStore.getTermsByCharacterId(characterId);
		const payload = compressData(response);
		res.status(200).json({ payload });
	})
);

/**
 * POST /api/glossary/ensure-terms
 * Takes an array of Korean terms, translates any that are not already in the session's
 * glossary, stores them, and returns a map of all requested terms to their English counterparts.
 * @param {object} req.body - Contains sessionId, userId, and an array of koreanTermsToEnsure.
 * @returns {object} A key-value map of Korean terms to their English translations.
 */
router.post(
	genRoutePattern('ensureAndGetTermsForPrompt'),
	asyncHandler(async (req: Request, res: Response<object>): Promise<void> => {
		const { sessionId, koreanTermsToEnsure, userId } = req.body;
		validateRequestData(req.body, 'body', ['sessionId', 'koreanTermsToEnsure', 'userId']);

		const path = genRoutePattern('ensureAndGetTermsForPrompt');
		console.log(`API HIT: POST ${path} for session ${sessionId}`);

		const termMap = await termStore.ensureAndGetTermsForPrompt(
			sessionId,
			userId,
			koreanTermsToEnsure
		);
		// Convert Map to a plain object for JSON serialization
		const response = Object.fromEntries(termMap);
		res.status(200).json(response);
	})
);

/**
 * DELETE /api/glossary/session-cache/:sessionId
 * Clears the in-memory cache for a specific session's glossary terms.
 * @param {string} sessionId - The ID of the session whose cache should be cleared.
 * @returns {object} A success confirmation message.
 */
router.delete(
	genRoutePattern('clearSessionCache', ['sessionId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { sessionId } = req.params;

		const path = genRoutePattern('clearSessionCache', ['sessionId']);
		console.log(`API HIT: DELETE ${path.replace(':sessionId', sessionId)}`);

		termStore.clearSessionCache(sessionId);
		res.status(200).json({ message: `Cache cleared for session ${sessionId}.` });
	})
);

/**
 * DELETE /api/glossary/character-cache/:characterId
 * Clears the in-memory cache for a specific character's glossary terms.
 * @param {string} characterId - The ID of the character whose cache should be cleared.
 * @returns {object} A success confirmation message.
 */
router.delete(
	genRoutePattern('clearCharacterCache', ['characterId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { characterId } = req.params;

		const path = genRoutePattern('clearCharacterCache', ['characterId']);
		console.log(`API HIT: DELETE ${path.replace(':characterId', characterId)}`);

		termStore.clearCharacterCache(characterId);
		res.status(200).json({ message: `Cache cleared for character ${characterId}.` });
	})
);

export default router;

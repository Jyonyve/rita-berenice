// src/server/routes/glossary.routes.ts
import express, { type Request, type Response } from 'express';
import { TermInfo, genRoutePattern, COLLECTIONS, TermResponse, TermCdo } from '#shared/index.ts'; // Assuming MODULE_NAMES is not directly used in routes
import {
	asyncHandler,
	validateRequestData, // For body validation
	validateServiceId, // For sessionId path param
} from '../util/index.ts'; // Assuming these are in your util
import { termStore } from '../store/termStore.ts';

const router = express.Router();
const collectionType = COLLECTIONS.TERM; // For validating sessionId if it were used as a serviceId elsewhere
/**
 * POST /api/glossary/store-term
 * Creates or updates a term in the glossary for a specific session.
 * Also updates the in-memory cache for that session.
 * @param {TermCdo | TermInfo} req.body - The term data to be stored.
 * @returns {object} A success confirmation message.
 */
router.post(
	genRoutePattern('storeTerm'),
	asyncHandler(
		async (
			req: Request<object, { message: string }, TermCdo | TermInfo>,
			res: Response<{ message: string }>
		): Promise<void> => {
			const requiredFields: (keyof TermInfo)[] = ['koreanTerm', 'sessionId'];
			validateRequestData(req.body, 'body', requiredFields);
			validateServiceId(req.body.sessionId, collectionType);

			const path = genRoutePattern('storeTerm');
			console.log(
				`API HIT: POST ${path} for session ${req.body.sessionId}, term "${req.body.koreanTerm}"`
			);

			await termStore.storeTerm(req.body);
			res.status(201).json({ message: 'Term stored successfully.' });
		}
	)
);

/**
 * GET /api/glossary/get-term-by-korean/:sessionId/:koreanTerm
 * Retrieves a specific term by its Korean name for a given session.
 * @param {string} sessionId - The ID of the session.
 * @param {string} koreanTerm - The Korean term to look up.
 * @returns {TermResponse} An object containing the found term information.
 */
router.get(
	genRoutePattern('getTermByKorean', ['sessionId', 'koreanTerm']),
	asyncHandler(async (req: Request, res: Response<TermResponse>): Promise<void> => {
		const { sessionId, koreanTerm } = req.params;
		validateServiceId(sessionId, collectionType);
		validateRequestData(req.params, 'params', ['koreanTerm']);

		const path = genRoutePattern('getTermByKorean', ['sessionId', 'koreanTerm']);
		console.log(
			`API HIT: GET ${path.replace(':sessionId', sessionId).replace(':koreanTerm', koreanTerm)}`
		);

		const response = await termStore.getTermByKorean(sessionId, koreanTerm);
		res.status(200).json(response);
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
	asyncHandler(async (req: Request, res: Response<TermResponse>): Promise<void> => {
		const { sessionId } = req.params;
		validateServiceId(sessionId, collectionType);

		const path = genRoutePattern('getTermsBySessionId', ['sessionId']);
		console.log(`API HIT: GET ${path.replace(':sessionId', sessionId)}`);

		const response = await termStore.getTermsBySessionId(sessionId);
		res.status(200).json(response);
	})
);

/**
 * POST /api/glossary/ensure-terms
 * Takes an array of Korean terms, translates any that are not already in the session's
 * glossary, stores them, and returns a map of all requested terms to their English counterparts.
 * @param {object} req.body - Contains sessionId and an array of koreanTermsToEnsure.
 * @returns {object} A key-value map of Korean terms to their English translations.
 */
router.post(
	genRoutePattern('ensureAndGetTermsForPrompt'),
	asyncHandler(
		async (
			req: Request<object, object, { sessionId: string; koreanTermsToEnsure: string[] }>,
			res: Response<object>
		): Promise<void> => {
			const { sessionId, koreanTermsToEnsure } = req.body;
			validateServiceId(sessionId, collectionType);
			validateRequestData(req.body, 'body', ['sessionId', 'koreanTermsToEnsure']);

			const path = genRoutePattern('ensureAndGetTermsForPrompt');
			console.log(`API HIT: POST ${path} for session ${sessionId}`);

			const termMap = await termStore.ensureAndGetTermsForPrompt(sessionId, koreanTermsToEnsure);
			// Convert Map to a plain object for JSON serialization
			const response = Object.fromEntries(termMap);
			res.status(200).json(response);
		}
	)
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
		validateServiceId(sessionId, collectionType);

		const path = genRoutePattern('clearSessionCache', ['sessionId']);
		console.log(`API HIT: DELETE ${path.replace(':sessionId', sessionId)}`);

		termStore.clearSessionCache(sessionId);
		res.status(200).json({ message: `Cache cleared for session ${sessionId}.` });
	})
);

export default router;

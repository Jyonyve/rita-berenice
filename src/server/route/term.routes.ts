// src/server/routes/glossary.routes.ts
import express, { type Request, type Response } from 'express';
import { TermInfo, genRoutePattern, COLLECTIONS } from '#shared/index.ts'; // Assuming MODULE_NAMES is not directly used in routes
import { termService } from '../service/index.ts'; // Correct path
import {
	asyncHandler,
	validateRequestData, // For body validation
	validateServiceId, // For sessionId path param
} from '../util/index.ts'; // Assuming these are in your util

const router = express.Router();
const collectionType = COLLECTIONS.TERM; // For validating sessionId if it were used as a serviceId elsewhere

// Example: POST /api/term/store-term
router.post(
	genRoutePattern('storeTerm'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateServiceId(req.body.termId, collectionType); // Validate sessionId
		const requiredFields: (keyof TermInfo)[] = [
			'koreanTerm',
			'englishTerm',
			'initialTerm',
			'sessionId',
		];
		validateRequestData(req.body, 'body', requiredFields);

		const response = await termService.storeTerm(req.body);
		res.status(201).json(response);
	})
);

// Example: GET /api/term/get-entry-by-korean-term/:sessionId/:koreanTerm
router.get(
	genRoutePattern('getTermByKorean', ['sessionId', 'koreanTerm']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.params, 'params', ['sessionId', 'koreanTerm']);
		const { sessionId, koreanTerm } = req.params;

		const response = await termService.getTermByKorean(sessionId, koreanTerm);
		res.status(200).json(response);
	})
);

router.get(
	genRoutePattern('getTermsBySessionId', ['sessionId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.params, 'params', ['sessionId']);
		const { sessionId } = req.params;

		const response = await termService.getTermsBySessionId(sessionId);
		res.status(200).json(response);
	})
);

export default router;

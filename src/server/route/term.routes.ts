// src/server/routes/glossary.routes.ts
import express, { type Request, type Response } from 'express';
import { TermInfo, genRoutePattern, COLLECTIONS } from '#shared/index.ts'; // Assuming MODULE_NAMES is not directly used in routes
import { chatService, termService } from '../service/index.ts'; // Correct path
import {
	asyncHandler,
	validateRequestData, // For body validation
	validateServiceId, // For sessionId path param
} from '../util/index.ts'; // Assuming these are in your util
import {} from '#root/src/shared/domain/term/TermInterfaces.ts';

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

// Example: GET /api/glossary/get-entry-by-korean-term/:koreanTerm
router.get(
	genRoutePattern('getTermByKorean', ['koreanTerm', 'sessionId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.params, 'params', ['koreanTerm', 'sessionId']);
		const { koreanTerm, sessionId } = req.params;

		const response = await termService.getTermByKorean(koreanTerm, sessionId);
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

// src/server/routes/profile.routes.ts
import express, { type Request, type Response } from 'express';
import { COLLECTIONS, genRoutePattern, ProfileMetadata } from '#shared/index.ts';
import { asyncHandler, validateRequestData, validateServiceId } from '../util/index.ts';
import { profileStore } from '../store/profileStore.ts';

const router = express.Router();
const collectionType = COLLECTIONS.PROFILE;

// --- GET /api/profile/get-all-profiles ---
// Corresponds to profileStore.getAllProfiles
router.get(
	genRoutePattern('getAllProfiles'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const path = genRoutePattern('getAllProfiles');
		console.log(`API HIT: GET ${path}`);
		validateRequestData(req.body, 'body');

		validateRequestData(req.body, 'body');
		const response = await profileStore.getAllProfiles();
		res.status(200).json(response);
		return;
	})
);

// --- GET /api/profile/get-profile-by-id/:id ---
// Corresponds to profileStore.getProfileById
router.get(
	genRoutePattern('getProfile', ['profileId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { profileId } = req.params;
		validateServiceId(profileId, collectionType);
		validateRequestData(req.body, 'body');

		const path = genRoutePattern('getProfile', ['profileId']);
		console.log(`API HIT: GET ${path.replace(':profileId', profileId)}`);
		const response = await profileStore.getProfile(profileId);

		res.status(200).json(response);
		return;
	})
);

// --- GET /api/profile/get-profiles-by-session-id/:sessionId ---
// Corresponds to profileStore.getProfilesBySessionId
router.get(
	genRoutePattern('getProfileBySessionId', ['sessionId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.params, 'params', ['sessionId']);
		const { sessionId } = req.params;
		const path = genRoutePattern('getProfileBySessionId', ['sessionId']);
		console.log(`API HIT: GET ${path.replace(':sessionId', sessionId)}`);

		const response = await profileStore.getProfileBySessionId(sessionId);

		res.status(200).json(response);
		return;
	})
);

// --- POST /api/profile/store-profile ---
// Corresponds to profileStore.storeProfile (upsert)
// Expects ProfileInfo in body
router.post(
	genRoutePattern('storeProfile'),
	async (req: Request<{}, any, ProfileMetadata>, res: Response): Promise<any> => {
		// req validation
		const requiredFields: (keyof ProfileMetadata)[] = ['profileId', 'description', 'creator'];
		validateRequestData(req.body, 'body', requiredFields);

		const path = genRoutePattern('storeProfile');
		console.log(`API HIT: POST ${path} for ID: ${req.body?.profileId}`);
		// api

		const response = await profileStore.storeProfile(req.body);

		res.status(200).json(response);
		return;
	}
);

export default router;

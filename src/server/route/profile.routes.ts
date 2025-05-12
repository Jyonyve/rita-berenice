// src/server/routes/profile.routes.ts
import express, { type Request, type Response } from 'express';
import { profileService } from '../service/index.ts';
import { COLLECTIONS, genRoutePattern, ProfileInfo } from '#shared/index.ts';
import { asyncHandler, validateRequestData, validateServiceId } from '../util/index.ts';

const router = express.Router();
const collectionType = COLLECTIONS.PROFILE;

// --- GET /api/profile/get-all-profiles ---
// Corresponds to profileService.getAllProfiles
router.get(
	genRoutePattern('getAllProfiles'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const path = genRoutePattern('getAllProfiles');
		console.log(`API HIT: GET ${path}`);
		validateRequestData(req.body, 'body');
	})
);

// --- GET /api/profile/get-profile-by-id/:id ---
// Corresponds to profileService.getProfileById
router.get(
	genRoutePattern('getProfile', ['profileId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const { profileId } = req.params;
		validateServiceId(profileId, collectionType);
		validateRequestData(req.body, 'body');

		const path = genRoutePattern('getProfile', ['profileId']);
		console.log(`API HIT: GET ${path.replace(':profileId', profileId)}`);
		const response = await profileService.getProfile(profileId);

		res.status(200).json(response);
		return;
	})
);

// --- GET /api/profile/get-profiles-by-session-id/:sessionId ---
// Corresponds to profileService.getProfilesBySessionId
router.get(
	genRoutePattern('getProfileBySessionId', ['sessionId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.params, 'params', ['sessionId']);
		const { sessionId } = req.params;
		const path = genRoutePattern('getProfileBySessionId', ['sessionId']);
		console.log(`API HIT: GET ${path.replace(':sessionId', sessionId)}`);

		const response = await profileService.getProfileBySessionId(sessionId);

		res.status(200).json(response);
		return;
	})
);

// --- POST /api/profile/store-profile ---
// Corresponds to profileService.storeProfile (upsert)
// Expects ProfileInfo in body
router.post(
	genRoutePattern('storeProfile'),
	async (req: Request<{}, any, ProfileInfo>, res: Response): Promise<any> => {
		validateRequestData(req.body, 'body');
		const path = genRoutePattern('storeProfile');
		console.log(`API HIT: POST ${path} for ID: ${profileData?.profileId}`);

		if (
			!profileData ||
			typeof profileData !== 'object' ||
			!profileData.profileId ||
			!profileData.metadata?.name
		) {
			res.status(400).json({ error: 'Invalid profile data in request body' });
		}

		try {
			await profileService.storeProfile(profileData);
			// Respond with the data that was stored/updated
			res.status(200).json(profileData); // 200 OK for upsert
		} catch (error: any) {
			console.error(`Error in POST ${path}:`, error);
			res.status(500).json({ error: 'Failed to store profile' });
		}
	}
);

// --- GET /api/profile/query-profiles?q=...&limit=... ---
// Corresponds to profileService.queryProfiles
router.get(genRoutePattern('queryProfiles'), async (req: Request, res: Response): Promise<any> => {
	const query = req.query.q as string | undefined;
	const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10; // Default limit
	const path = genRoutePattern('queryProfiles');
	console.log(`API HIT: GET ${path}?q=${query}&limit=${limit}`);

	if (!query) {
		res.status(400).json({ error: 'Missing query parameter "q"' });
	}

	try {
		const profiles = await profileService.queryProfiles(query, limit);
		res.json(profiles);
	} catch (error: any) {
		console.error(`Error in GET ${path}:`, error);
		res.status(500).json({ error: 'Failed to query profiles' });
	}
});

export default router;

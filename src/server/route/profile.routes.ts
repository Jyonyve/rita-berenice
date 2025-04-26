// src/server/routes/profile.routes.ts
import { genRoutePattern, MODULE_NAMES, ProfileInfo } from '#root/src/shared/index.ts';
import express, { type Request, type Response } from 'express';
import { profileService } from '#server/service/index.ts';

const router = express.Router();

// --- GET /api/profile/get-all-profiles ---
// Corresponds to profileService.getAllProfiles
router.get(genRoutePattern('getAllProfiles'), async (req: Request, res: Response): Promise<any> => {
	const path = genRoutePattern('getAllProfiles');
	console.log(`API HIT: GET ${path}`);
	try {
		const profiles = await profileService.getAllProfiles();
		return res.json(profiles);
	} catch (error: any) {
		console.error(`Error in GET ${path}:`, error);
		return res.status(500).json({ error: 'Failed to fetch profiles' });
	}
});

// --- GET /api/profile/get-profile-by-id/:id ---
// Corresponds to profileService.getProfileById
router.get(
	genRoutePattern('getProfileById', ['id']),
	async (req: Request<{ id: string }>, res: Response): Promise<any> => {
		const { id } = req.params;
		const path = genRoutePattern('getProfileById', ['id']);
		console.log(`API HIT: GET ${path.replace(':id', id)}`);
		try {
			const profile = await profileService.getProfileById(id);
			if (!profile) {
				return res.status(404).json({ error: 'Profile not found' });
			}
			return res.json(profile);
		} catch (error: any) {
			console.error(`Error in GET ${path.replace(':id', id)}:`, error);
			return res.status(500).json({ error: 'Failed to fetch profile details' });
		}
	}
);

// --- GET /api/profile/get-profiles-by-session-id/:sessionId ---
// Corresponds to profileService.getProfilesBySessionId
router.get(
	genRoutePattern('getProfilesBySessionId', ['sessionId']),
	async (req: Request<{ sessionId: string }>, res: Response): Promise<any> => {
		const { sessionId } = req.params;
		const path = genRoutePattern('getProfilesBySessionId', ['sessionId']);
		console.log(`API HIT: GET ${path.replace(':sessionId', sessionId)}`);
		try {
			const profiles = await profileService.getProfilesBySessionId(sessionId);
			// Service already handles empty array case, just return results
			return res.json(profiles);
		} catch (error: any) {
			console.error(`Error in GET ${path.replace(':sessionId', sessionId)}:`, error);
			return res.status(500).json({ error: 'Failed to fetch profiles for session' });
		}
	}
);

// --- POST /api/profile/store-profile ---
// Corresponds to profileService.storeProfile (upsert)
// Expects ProfileInfo in body
router.post(
	genRoutePattern('storeProfile'),
	async (req: Request<{}, any, ProfileInfo>, res: Response): Promise<any> => {
		const profileData = req.body;
		const path = genRoutePattern('storeProfile');
		console.log(`API HIT: POST ${path} for ID: ${profileData?.profileId}`);

		if (
			!profileData ||
			typeof profileData !== 'object' ||
			!profileData.profileId ||
			!profileData.metadata?.name
		) {
			return res.status(400).json({ error: 'Invalid profile data in request body' });
		}

		try {
			await profileService.storeProfile(profileData);
			// Respond with the data that was stored/updated
			return res.status(200).json(profileData); // 200 OK for upsert
		} catch (error: any) {
			console.error(`Error in POST ${path}:`, error);
			return res.status(500).json({ error: 'Failed to store profile' });
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
		return res.status(400).json({ error: 'Missing query parameter "q"' });
	}

	try {
		const profiles = await profileService.queryProfiles(query, limit);
		return res.json(profiles);
	} catch (error: any) {
		console.error(`Error in GET ${path}:`, error);
		return res.status(500).json({ error: 'Failed to query profiles' });
	}
});

export default router;

// src/server/routes/profile.routes.ts

import express, { type Request, type Response } from 'express';
import { COLLECTIONS, genRoutePattern, ProfileMetadata, ProfileResponse } from '#shared/index.ts';
import { asyncHandler, validateRequestData, validateServiceId } from '../util/index.ts';
import { profileStore } from '../store/profileStore.ts';

const router = express.Router();
const collectionType = COLLECTIONS.PROFILE;

/**
 * GET /api/profile/get-all-profiles
 * Retrieves all registered profiles from the database.
 * @returns {ProfileResponse} An object containing an array of all profile objects.
 * @throws {500} Internal server error if the database fetch fails.
 */
router.get(
	genRoutePattern('getAllProfiles'),
	asyncHandler(async (req: Request, res: Response<ProfileResponse>): Promise<void> => {
		const path = genRoutePattern('getAllProfiles');
		console.log(`API HIT: GET ${path}`);

		const response = await profileStore.getAllProfiles();
		res.status(200).json(response);
	})
);

/**
 * GET /api/profile/get-profile/:profileId
 * Retrieves a specific profile by its unique identifier.
 * @param {string} profileId - The unique ID of the profile to retrieve.
 * @returns {ProfileResponse} An object containing the requested profile data.
 * @throws {404} Profile not found for the specified ID.
 * @throws {500} Internal server error.
 */
router.get(
	genRoutePattern('getProfile', ['profileId']),
	asyncHandler(async (req: Request, res: Response<ProfileResponse>): Promise<void> => {
		const { profileId } = req.params;
		validateServiceId(profileId, collectionType);

		const path = genRoutePattern('getProfile', ['profileId']);
		console.log(`API HIT: GET ${path.replace(':profileId', profileId)}`);

		const response = await profileStore.getProfile(profileId);
		res.status(200).json(response);
	})
);

/**
 * GET /api/profile/get-profile-by-session-id/:sessionId
 * Retrieves a profile associated with a specific session ID.
 * @param {string} sessionId - The session ID to find the profile for.
 * @returns {ProfileResponse} An object containing the matching profile data.
 * @throws {404} Profile not found for the specified session ID.
 * @throws {500} Internal server error.
 */
router.get(
	genRoutePattern('getProfileBySessionId', ['sessionId']),
	asyncHandler(async (req: Request, res: Response<ProfileResponse>): Promise<void> => {
		const { sessionId } = req.params;
		validateServiceId(sessionId, collectionType);

		const path = genRoutePattern('getProfileBySessionId', ['sessionId']);
		console.log(`API HIT: GET ${path.replace(':sessionId', sessionId)}`);

		const response = await profileStore.getProfileBySessionId(sessionId);
		res.status(200).json(response);
	})
);

/**
 * GET /api/profile/get-profiles-by-show-name/:showName
 * Retrieves profiles associated with a specific show name.
 * @param {string} showName - The exact name of the show to filter by.
 * @returns {ProfileResponse} An object containing an array of matching profiles.
 * @throws {404} No profiles found for the specified show name.
 * @throws {500} Internal server error.
 */
router.get(
	genRoutePattern('getProfilesByShowName', ['showName']),
	asyncHandler(async (req: Request, res: Response<ProfileResponse>): Promise<void> => {
		const { showName } = req.params;
		validateRequestData(req.params, 'params', ['showName']);

		const path = genRoutePattern('getProfilesByShowName', ['showName']);
		console.log(`API HIT: GET ${path.replace(':showName', showName)}`);

		const response = await profileStore.getProfilesByShowName(showName);
		res.status(200).json(response);
	})
);

/**
 * POST /api/profile/store-profile
 * Creates or updates a profile record in the database.
 * @param {ProfileMetadata} req.body - The complete profile data payload.
 * @returns {string} A JSON string with a success message, profileId, and timestamp.
 * @throws {400} Invalid request body structure.
 * @throws {500} Internal server error if the database operation fails.
 */
router.post(
	genRoutePattern('storeProfile'),
	asyncHandler(
		async (req: Request<object, string, ProfileMetadata>, res: Response<string>): Promise<void> => {
			const requiredFields: (keyof ProfileMetadata)[] = [
				'name',
				'sessionId',
				'description',
				'creator',
			];
			validateRequestData(req.body, 'body', requiredFields);

			const path = genRoutePattern('storeProfile');
			console.log(`API HIT: POST ${path} for profile: ${req.body?.name}`);

			const response = await profileStore.storeProfile(req.body);
			res.status(201).json(response);
		}
	)
);

export default router;

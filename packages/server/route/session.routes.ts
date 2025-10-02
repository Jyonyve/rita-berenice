// server/route/session.routes.ts

import express, { type Request, type Response, type Router } from 'express';
import {
	asyncHandler,
	compressData,
	genRoutePattern,
	validateRequestData,
} from '../util/routeHelpers.js';
import { sessionStore } from '../store/sessionStore.js';
import { SessionInfo } from '@rita-berenice/shared/domain';
import { Payload } from '@rita-berenice/shared/util';

const router: Router = express.Router();

/**
 * POST /api/session/create-session
 * Creates a new session record.
 * @body {string} userId - ID of the user creating the session.
 * @body {string} characterId - ID of the character for the session.
 * @body {string} profileId - ID of the user profile for the session.
 * @body {string} firstCharMessage - The initial message from the character to start the session.
 * @returns {string} The newly created session information.
 * @throws {400} If required fields are missing in the request body.
 * @throws {500} Internal server error.
 */
router.post(
	genRoutePattern('createSession'),
	asyncHandler(async (req: Request, res: Response) => {
		validateRequestData(req.body, 'body', ['userId', 'characterId']);
		const { userId, characterId, firstCharMessage = '', title = '' } = req.body;

		console.log(`API HIT: POST /api/session/create-session for user ${userId}`);

		const response = await sessionStore.createSession(userId, characterId, firstCharMessage, title);

		res.status(201).json(response); // 201 for resource creation
	})
);

/**
 * PUT /api/session/update-session
 * Updates a session's metadata but no last message
 * @body {string} sessionId - The ID of the session to update.
 * @body {string} latestCharMessage - The new last message from the character.
 * @returns {204} No content on success.
 * @throws {400} If required fields are missing.
 * @throws {500} Internal server error.
 */
router.put(
	genRoutePattern('updateSession'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		const requiredFields = Object.keys({} as SessionInfo);
		validateRequestData(req.body, 'body', requiredFields);

		// Now you can safely destructure knowing all fields are present
		const sessionInfo: SessionInfo = req.body;

		console.log(`API HIT: PUT /api/session/update-session-on for session ${sessionInfo.sessionId}`);

		await sessionStore.updateSession(sessionInfo);

		res.status(204).send();
	})
);

/**
 * GET /api/session/get-sessions-by-user-id/:userId
 * Retrieves all sessions associated with a specific user, sorted by last update time.
 * @param {string} userId - ID of the user whose sessions are to be retrieved.
 * @returns {SessionResponse} An array of matching session objects.
 * @throws {404} If no sessions are found for the user.
 * @throws {500} Internal server error.
 */
router.get(
	genRoutePattern('getSessionsByUserId', ['userId']),
	asyncHandler(async (req: Request, res: Response<Payload>) => {
		validateRequestData(req.params, 'params', ['userId']);
		const { userId } = req.params;

		console.log(`API HIT: GET /api/session/get-sessions-by-user-id/${userId}`);

		const response = await sessionStore.getSessionsByUserId(userId);
		const payload = compressData(response);
		res.status(200).json({ payload });
	})
);

/**
 * GET /api/session/get-sessions-by-user-id-and-character-id/:userId/:characterId
 * Retrieves all sessions associated with a specific user, sorted by last update time.
 * @param {string} userId - ID of the user whose sessions are to be retrieved.
 * @returns {SessionResponse} An array of matching session objects.
 * @throws {404} If no sessions are found for the user.
 * @throws {500} Internal server error.
 */
router.get(
	genRoutePattern('getSessionsByUserIdAndCharacterId', ['userId', 'characterId']),
	asyncHandler(async (req: Request, res: Response<Payload>) => {
		validateRequestData(req.params, 'params', ['userId', 'characterId']);
		const { userId, characterId } = req.params;

		console.log(
			`API HIT: GET /api/session/get-sessions-by-user-id-and-character-id/${userId}/${characterId}`
		);

		const response = await sessionStore.getSessionsByUserIdAndCharacterId(userId, characterId);
		const payload = compressData(response);
		res.status(200).json({ payload });
	})
);

/**
 * GET /api/session/get-session/:sessionId
 * Retrieves a single session by its ID.
 * @param {string} sessionId - The unique ID of the session.
 * @returns {SessionResponse} The session object.
 * @throws {404} If the session is not found.
 * @throws {500} Internal server error.
 */
router.get(
	genRoutePattern('getSession', ['sessionId']),
	asyncHandler(async (req: Request, res: Response<Payload>) => {
		validateRequestData(req.params, 'params', ['sessionId']);
		const { sessionId } = req.params;

		console.log(`API HIT: GET /api/session/get-session/${sessionId}`);

		const response = await sessionStore.getSession(sessionId);
		const payload = compressData(response);
		res.status(200).json({ payload });
	})
);

/**
 * PUT /api/session/update-session-on-new-message
 * Updates a session's metadata after a new message is added.
 * @body {string} sessionId - The ID of the session to update.
 * @body {string} latestCharMessage - The new last message from the character.
 * @returns {204} No content on success.
 * @throws {400} If required fields are missing.
 * @throws {500} Internal server error.
 */
router.put(
	genRoutePattern('updateSessionOnNewMessage'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.body, 'body', ['sessionId', 'latestCharMessage']);
		const { sessionId, latestCharMessage } = req.body;

		console.log(`API HIT: PUT /api/session/update-session-on-new-message for session ${sessionId}`);

		await sessionStore.updateSessionOnNewMessage(sessionId, latestCharMessage);

		res.status(204).send(); // 204 No Content is appropriate for successful updates with no body
	})
);

/**
 * PUT /api/session/init-session-profileid
 * Updates a session's metadata after a new message is added.
 * @body {string} sessionId - The ID of the session to update.
 * @body {string} profileId - The new last message from the character.
 * @returns {204} No content on success.
 * @throws {400} If required fields are missing.
 * @throws {500} Internal server error.
 */
router.put(
	genRoutePattern('initSessionProfileId'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.body, 'body', ['sessionId', 'profileId']);
		const { sessionId, profileId } = req.body;

		console.log(`API HIT: PUT /api/session/init-session-profile-id for session ${sessionId}`);

		await sessionStore.initSessionProfileId(sessionId, profileId);

		res.status(204).send(); // 204 No Content is appropriate for successful updates with no body
	})
);

/**
 * PUT /api/session/update-session-title
 * Updates a session's metadata after a new message is added.
 * @body {string} sessionId - The ID of the session to update.
 * @body {string} title - The new last message from the character.
 * @returns {204} No content on success.
 * @throws {400} If required fields are missing.
 * @throws {500} Internal server error.
 */
router.put(
	genRoutePattern('updateSessionTitle'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.body, 'body', ['sessionId', 'title']);
		const { sessionId, title } = req.body;

		console.log(`API HIT: PUT /api/session/update-session-title for session ${sessionId}`);

		await sessionStore.updateSessionTitle(sessionId, title);

		res.status(204).send(); // 204 No Content is appropriate for successful updates with no body
	})
);

export default router;

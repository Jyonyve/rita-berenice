// server/route/session.routes.ts

import express, { type Request, type Response, type Router } from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import { asyncHandler, genRoutePattern, validateRequestData } from '../util/routeHelpers.js';
import { assertOwnedProfile, assertOwnedSession, assertSessionUser } from '../util/authUtils.js';
import { sessionStore } from '../store/sessionStore.js';
import { ApiError, SessionContentPolicy, SessionInfo } from '@rita-berenice/shared/domain';

const router: Router = express.Router();
router.use(verifySession());

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
    const { characterId, firstCharMessage = '', title = '' } = req.body;
    const userId = assertSessionUser(req, req.body.userId);
    const contentPolicy: SessionContentPolicy = req.body.contentPolicy ?? 'general';
    if (contentPolicy !== 'general' && contentPolicy !== 'adult') {
      throw new ApiError(400, 'Invalid session content policy.');
    }

    const response = await sessionStore.createSession(userId, characterId, firstCharMessage, title, contentPolicy);

    res.status(201).json(response); // 201 for resource creation
  }),
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
    const storedSession = await assertOwnedSession(req, sessionInfo.sessionId);
    sessionInfo.userId = assertSessionUser(req, sessionInfo.userId);
    sessionInfo.characterId = storedSession.characterId;
    sessionInfo.profileId = storedSession.profileId;
    sessionInfo.contentPolicy = sessionInfo.contentPolicy ?? storedSession.contentPolicy ?? 'general';
    if (sessionInfo.contentPolicy !== 'general' && sessionInfo.contentPolicy !== 'adult') {
      throw new ApiError(400, 'Invalid session content policy.');
    }

    await sessionStore.updateSession(sessionInfo);

    res.status(204).send();
  }),
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
  asyncHandler(async (req: Request, res: Response) => {
    validateRequestData(req.params, 'params', ['userId']);
    const userId = assertSessionUser(req, req.params.userId);

    const response = await sessionStore.getSessionsByUserId(userId);
    res.status(200).json(response);
  }),
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
  asyncHandler(async (req: Request, res: Response) => {
    validateRequestData(req.params, 'params', ['userId', 'characterId']);
    const { characterId } = req.params;
    const userId = assertSessionUser(req, req.params.userId);

    const response = await sessionStore.getSessionsByUserIdAndCharacterId(userId, characterId);
    res.status(200).json(response);
  }),
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
  asyncHandler(async (req: Request, res: Response) => {
    validateRequestData(req.params, 'params', ['sessionId']);
    const { sessionId } = req.params;
    await assertOwnedSession(req, sessionId);

    const response = await sessionStore.getSession(sessionId);
    res.status(200).json(response);
  }),
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
    await assertOwnedSession(req, sessionId);

    await sessionStore.updateSessionOnNewMessage(sessionId, latestCharMessage);

    res.status(204).send(); // 204 No Content is appropriate for successful updates with no body
  }),
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
    await assertOwnedSession(req, sessionId);
    const profile = await assertOwnedProfile(req, profileId);
    if (profile.sessionId !== sessionId) {
      throw new Error(`Profile '${profileId}' does not belong to session '${sessionId}'.`);
    }

    await sessionStore.initSessionProfileId(sessionId, profileId);

    res.status(204).send(); // 204 No Content is appropriate for successful updates with no body
  }),
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
    await assertOwnedSession(req, sessionId);

    await sessionStore.updateSessionTitle(sessionId, title);

    res.status(204).send(); // 204 No Content is appropriate for successful updates with no body
  }),
);

/** Updates a private user note for an owned session. */
router.put(
  genRoutePattern('updateSessionUserNote'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    validateRequestData(req.body, 'body', ['sessionId', 'userNote']);
    const { sessionId, userNote } = req.body;
    await assertOwnedSession(req, sessionId);

    await sessionStore.updateSessionUserNote(sessionId, userNote);
    res.status(204).send();
  }),
);

/** Updates the content policy used for future responses in an owned session. */
router.put(
  genRoutePattern('updateSessionContentPolicy'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    validateRequestData(req.body, 'body', ['sessionId', 'contentPolicy']);
    const { sessionId, contentPolicy } = req.body;
    await assertOwnedSession(req, sessionId);
    if (contentPolicy !== 'general' && contentPolicy !== 'adult') {
      throw new ApiError(400, 'Invalid session content policy.');
    }

    await sessionStore.updateSessionContentPolicy(sessionId, contentPolicy);
    res.status(204).send();
  }),
);

export default router;

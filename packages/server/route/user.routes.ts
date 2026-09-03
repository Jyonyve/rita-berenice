import express, { type Request, type Response, type Router } from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import { userStore } from '../store/userStore.js';
import { RESOURCES } from '../db/resource.type.js';
import { asyncHandler, genRoutePattern, validateRequestData, validateServiceId } from '../util/routeHelpers.js';

import { avatarUpload, deleteUserAvatar, processUserAvatar } from '../util/imageProcessingUtils.js';
import { UserResponse } from '@rita-berenice/shared/api';
import { RUNTIME_USER_IMAGE_DIR } from '@rita-berenice/shared/config';
import { ApiError, UserInfo } from '@rita-berenice/shared/domain';
import { flowLogger, serializeError } from '../util/jsonlLogger.js';
import { ensureImageStorageDirectory } from '../util/imageStorageUtils.js';
import { getSessionUserId } from '../util/authUtils.js';

const router: Router = express.Router();

const collectionType = RESOURCES.USER;
router.use(verifySession());

const assertSelf = (req: Request, requestedUserId: string) => {
  const authenticatedUserId = getSessionUserId(req);
  if (requestedUserId !== authenticatedUserId) {
    throw new ApiError(403, 'The requested user does not match the authenticated session.');
  }
  return authenticatedUserId;
};

router.get(
  genRoutePattern('getMe'),
  asyncHandler(async (req: Request, res: Response<UserResponse>): Promise<void> => {
    const response = await userStore.getUser(getSessionUserId(req));
    res.status(200).json(response);
  }),
);

/**
 * GET /api/user/get-user/:userId
 * Retrieves a specific user by their unique identifier.
 */
router.get(
  genRoutePattern('getUser', ['userId']),
  asyncHandler(async (req: Request, res: Response<UserResponse>): Promise<void> => {
    const { userId } = req.params;
    validateServiceId(userId, collectionType);
    assertSelf(req, userId);

    const response = await userStore.getUser(userId);
    res.status(200).json(response);
  }),
);

/**
 * GET /api/user/get-user-by-showname/:showName
 * Retrieves a user by their unique showName.
 */
router.get(
  genRoutePattern('getUserByShowName', ['showName']),
  asyncHandler(async (req: Request, res: Response<UserResponse>): Promise<void> => {
    const { showName } = req.params;
    validateRequestData(req.params, 'params', ['showName']);

    const response = await userStore.getUserByShowName(showName);
    res.status(200).json(response);
  }),
);

/**
 * GET /api/user/check-show-name-exists/:showName
 * Checks if a showName is already taken.
 */
router.get(
  genRoutePattern('checkShowNameExists', ['showName']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { showName } = req.params;
    validateRequestData(req.params, 'params', ['showName']);

    const exists = await userStore.checkShowNameExists(showName);
    res.status(200).json({ exists, available: !exists, showName });
  }),
);

/**
 * GET /api/user/get-user-by-email/:email
 * Retrieves a user by their email address.
 */
router.get(
  genRoutePattern('getUserByEmail', ['email']),
  asyncHandler(async (req: Request, res: Response<UserResponse>): Promise<void> => {
    const { email } = req.params;
    validateRequestData(req.params, 'params', ['email']);
    const currentUser = await userStore.getUser(getSessionUserId(req));
    if (currentUser.userInfo.email !== email) {
      throw new ApiError(403, 'The requested email does not match the authenticated session.');
    }

    const response = await userStore.getUserByEmail(email);
    res.status(200).json(response);
  }),
);

/**
 * POST /api/user/store-user
 * Creates or updates a user record in the database.
 */
router.post(
  genRoutePattern('storeUser'),
  asyncHandler(async (req: Request, res: Response<{ userId: string }>): Promise<void> => {
    const requiredFields: (keyof UserInfo)[] = ['userId', 'showName', 'email', 'gender'];
    validateRequestData(req.body, 'body', requiredFields);
    const userId = assertSelf(req, req.body.userId);
    const currentUser = await userStore.getUser(userId);

    const response = await userStore.storeUser({
      ...req.body,
      userId,
      email: currentUser.userInfo.email,
    });
    res.status(201).json(response);
  }),
);

/**
 * POST /api/user/upload-user-avatar
 * Uploads and processes a user avatar image, converting to WebP format and cropping to square
 */
router.post(
  genRoutePattern('uploadUserAvatar'),
  avatarUpload.single('avatarFile'), // Note: field name is 'avatarFile' for users
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    validateRequestData(req.body, 'body', ['userId']);

    const { userId, crop } = req.body; // crop comes from FormData body
    assertSelf(req, userId);
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No avatar file provided' });
      return;
    }

    try {
      // Parse crop data if provided (stringified JSON from FormData)
      const cropConfig = crop ? JSON.parse(crop) : undefined;

      const avatarUrl = await processUserAvatar(file.buffer, userId, { crop: cropConfig });

      res.status(200).json({ avatarUrl, success: true, message: 'Avatar uploaded successfully' });
    } catch (error) {
      flowLogger.error('user.routes', 'avatar.process.failed', { userId, ...serializeError(error) });
      res.status(500).json({ error: 'Failed to process avatar' });
    }
  }),
);

/**
 * DELETE /api/user/delete-user-avatar
 * Deletes a user's avatar image from the filesystem
 */
router.delete(
  genRoutePattern('deleteUserAvatar'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    validateRequestData(req.body, 'body', ['userId']);

    const { userId } = req.body;
    assertSelf(req, userId);

    try {
      await deleteUserAvatar(userId);

      res.status(200).json({ success: true, message: 'Avatar deleted successfully' });
    } catch (error) {
      flowLogger.error('user.routes', 'avatar.delete.failed', { userId, ...serializeError(error) });
      res.status(500).json({ error: 'Failed to delete avatar' });
    }
  }),
);

/**
 * POST /api/user/create-user-folder
 * Creates a folder for character assets
 */
router.post(
  genRoutePattern('createUserFolder'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    validateRequestData(req.body, 'body', ['userId']);

    const { userId } = req.body;
    assertSelf(req, userId);

    try {
      ensureImageStorageDirectory(`${RUNTIME_USER_IMAGE_DIR}/${userId}`);
      flowLogger.info('user.routes', 'userFolder.ready', { userId });

      // ✅ Use constant for URL path
      res.status(200).json({
        success: true,
        message: 'User folder created successfully',
        path: `${RUNTIME_USER_IMAGE_DIR}/${userId}`,
      });
    } catch (error) {
      flowLogger.error('user.routes', 'userFolder.create.failed', {
        userId,
        ...serializeError(error),
      });
      res.status(500).json({ error: 'Failed to create user folder' });
    }
  }),
);

export default router;

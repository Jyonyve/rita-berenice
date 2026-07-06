// src/server/routes/credentialRoutes.ts
import express, { type Request, type Response, type Router } from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import { asyncHandler, genRoutePattern, validateRequestData } from '../util/routeHelpers.js';
import { assertSessionUser } from '../util/authUtils.js';
import { credentialStore } from '../store/credentialStore.js';

const router: Router = express.Router();
router.use(verifySession());

/**
 * POST /api/credential/validate-api-keys
 * Validates API keys for a user
 */
router.post(
	genRoutePattern('validateApiKeys'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.body, 'body', ['apiKeys']);
		const { apiKeys } = req.body;

		console.log(`API HIT: POST /api/credential/validate-api-keys`);

		const validationResults = await credentialStore.validateApiKeys(apiKeys);
		res.status(200).json(validationResults);
	})
);

/**
 * GET /api/credential/get-user-api-keys/:userId
 * Retrieves encrypted API keys for a user
 */
router.get(
	genRoutePattern('getUserApiKeys', ['userId']),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.params, 'params', ['userId']);
		const userId = assertSessionUser(req, req.params.userId);

		console.log(`API HIT: GET /api/credential/get-user-api-keys/${userId}`);

		const response = await credentialStore.getUserApiKeys(userId);
		res.status(200).json(response);
	})
);

/**
 * POST /api/credential/store-user-api-keys
 * Stores/updates API keys for a user
 */
router.post(
	genRoutePattern('storeUserApiKeys'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.body, 'body', ['userId', 'apiKeys']);
		const { apiKeys } = req.body;
		const userId = assertSessionUser(req, req.body.userId);

		console.log(`API HIT: POST /api/credential/store-user-api-keys`);

		await credentialStore.storeUserApiKeys(userId, apiKeys);

		res.status(200).json({ message: 'API keys stored successfully' });
	})
);

/**
 * PUT /api/credential/update-user-api-key
 * Updates a single API key for a user
 */
router.put(
	genRoutePattern('updateUserApiKey'),
	asyncHandler(async (req: Request, res: Response): Promise<void> => {
		validateRequestData(req.body, 'body', ['userId', 'keyType', 'keyValue']);
		const { keyType, keyValue } = req.body;
		const userId = assertSessionUser(req, req.body.userId);

		console.log(`API HIT: PUT /api/credential/update-user-api-key`);

		await credentialStore.updateUserApiKey(userId, keyType, keyValue);

		res.status(200).json({ message: `${keyType} updated successfully` });
	})
);

export default router;

import express, { type Request, type Response } from 'express';
import { userStore } from '../store/userStore.js';
import { COLLECTIONS } from '../db/ChromaInterfaces.js';
import { UserResponse } from '#shared/api/ModuleResponse.js';
import {
	asyncHandler,
	genRoutePattern,
	validateRequestData,
	validateServiceId,
} from '../util/routeHelpers.js';
import { UserInfo } from '#shared/domain/user/UserInterfaces.js';

const router = express.Router();
const collectionType = COLLECTIONS.USER;

/**
 * GET /api/user/get-all-users
 * Retrieves all registered users from the database.
 */
router.get(
	genRoutePattern('getAllUsers'),
	asyncHandler(async (req: Request, res: Response<UserResponse>): Promise<void> => {
		const path = genRoutePattern('getAllUsers');
		console.log(`API HIT: GET ${path}`);

		const response = await userStore.getAllUsers();
		res.status(200).json(response);
	})
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

		const path = genRoutePattern('getUser', ['userId']);
		console.log(`API HIT: GET ${path.replace(':userId', userId)}`);

		const response = await userStore.getUser(userId);
		res.status(200).json(response);
	})
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

		const path = genRoutePattern('getUserByShowName', ['showName']);
		console.log(`API HIT: GET ${path.replace(':showName', showName)}`);

		const response = await userStore.getUserByShowName(showName);
		res.status(200).json(response);
	})
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

		const path = genRoutePattern('checkShowNameExists', ['showName']);
		console.log(`API HIT: GET ${path.replace(':showName', showName)}`);

		const exists = await userStore.checkShowNameExists(showName);
		res.status(200).json({ exists, available: !exists, showName });
	})
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

		const path = genRoutePattern('getUserByEmail', ['email']);
		console.log(`API HIT: GET ${path.replace(':email', email)}`);

		const response = await userStore.getUserByEmail(email);
		res.status(200).json(response);
	})
);

/**
 * POST /api/user/store-user
 * Creates or updates a user record in the database.
 */
router.post(
	genRoutePattern('storeUser'),
	asyncHandler(
		async (req: Request<object, string, UserInfo>, res: Response<string>): Promise<void> => {
			const requiredFields: (keyof UserInfo)[] = ['userId', 'showName', 'email', 'gender'];
			validateRequestData(req.body, 'body', requiredFields);

			const path = genRoutePattern('storeUser');
			console.log(`API HIT: POST ${path} for user: ${req.body?.userId}`);

			await userStore.storeUser(req.body);
			res
				.status(201)
				.json(JSON.stringify({ message: 'User stored successfully.', userId: req.body.userId }));
		}
	)
);

export default router;

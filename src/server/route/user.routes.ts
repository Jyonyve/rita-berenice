// src/server/routes/user.routes.ts

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
import { UserInfo, UserMetadata } from '#shared/domain/user/UserInterfaces.js';

const router = express.Router();
const collectionType = COLLECTIONS.USER;

/**
 * GET /api/user/get-all-users
 * Retrieves all registered users from the database.
 * @returns {UserResponse} An object containing an array of all user objects.
 * @throws {500} Internal server error if the database fetch fails.
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
 * @param {string} userId - The unique ID of the user to retrieve.
 * @returns {UserResponse} An object containing the requested user data.
 * @throws {404} User not found for the specified ID.
 * @throws {500} Internal server error.
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
 * GET /api/user/get-user-by-contact/:contact
 * Retrieves a user by their contact information.
 * @param {string} contact - The contact info of the user to retrieve.
 * @returns {UserResponse} An object containing the requested user data.
 * @throws {404} User not found for the specified contact.
 * @throws {500} Internal server error.
 */
router.get(
	genRoutePattern('getUserByContact', ['contact']),
	asyncHandler(async (req: Request, res: Response<UserResponse>): Promise<void> => {
		const { contact } = req.params;
		validateRequestData(req.params, 'params', ['contact']);

		const path = genRoutePattern('getUserByContact', ['contact']);
		console.log(`API HIT: GET ${path.replace(':contact', contact)}`);

		const response = await userStore.getUserByContact(contact);
		res.status(200).json(response);
	})
);

/**
 * GET /api/user/get-user-by-email/:email
 * Retrieves a user by their email address.
 * @param {string} email - The email of the user to retrieve.
 * @returns {UserResponse} An object containing the requested user data.
 * @throws {404} User not found for the specified email.
 * @throws {500} Internal server error.
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
 * @param {UserInfo} req.body - The complete user data payload.
 * @returns {string} A JSON string with a success message, userId, and timestamp.
 * @throws {400} Invalid request body structure.
 * @throws {500} Internal server error if the database operation fails.
 */
router.post(
	genRoutePattern('storeUser'),
	asyncHandler(
		async (req: Request<object, string, UserInfo>, res: Response<string>): Promise<void> => {
			const requiredFields: (keyof UserInfo)[] = ['userId', 'contact'];
			validateRequestData(req.body, 'body', requiredFields);

			const path = genRoutePattern('storeUser');
			console.log(`API HIT: POST ${path} for user: ${req.body?.userId}`);

			await userStore.storeUser(req.body);
			res
				.status(201)
				.json(JSON.stringify({ message: 'user stored successfully.', userId: req.body.userId }));
		}
	)
);

export default router;

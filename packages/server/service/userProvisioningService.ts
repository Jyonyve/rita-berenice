import supertokens from 'supertokens-node';
import UserRoles from 'supertokens-node/recipe/userroles';
import { DEFAULT_TENANT_ID } from '@rita-berenice/shared/config';
import { ApiError } from '@rita-berenice/shared/domain';
import { credentialStore } from '../store/credentialStore.js';
import { userStore } from '../store/userStore.js';

export const ensureLocalUser = async (userId: string) => {
	const existingUser = await userStore.findUser(userId);
	if (existingUser) {
		return userStore.getUser(userId);
	}

	const authUser = await supertokens.getUser(userId);
	const email = authUser?.emails[0];
	if (!authUser || !email) {
		throw new ApiError(422, `SuperTokens user '${userId}' has no email identity.`);
	}

	await userStore.storeUser({ userId, email });
	await credentialStore.initializeDefaultApiKeys(userId);
	await UserRoles.addRoleToUser(DEFAULT_TENANT_ID, userId, 'user');

	return userStore.getUser(userId);
};

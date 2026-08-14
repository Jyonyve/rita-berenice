import { createBasicUserInfo } from '@rita-berenice/shared/util';
import { getServerEnv } from '../config/env.js';
import { authIdentityStore } from '../store/authIdentityStore.js';
import { userStore } from '../store/userStore.js';

/**
 * Links a freshly signed-up SuperTokens user to a Rita user.
 *
 * Idempotent: no-op when the identity mapping already exists. The Rita user id is
 * set to the SuperTokens user id, matching the per-user document convention.
 */
export const provisionUserOnSignup = async (
	providerUserId: string,
	email: string
): Promise<void> => {
	const authNamespace = getServerEnv().AUTH_IDENTITY_NAMESPACE;
	const existing = await authIdentityStore.find(authNamespace, providerUserId);
	if (existing) {
		return;
	}

	const userId = providerUserId;
	const userInfo = createBasicUserInfo({ userId, email });
	await userStore.storeUser(userInfo);
	await authIdentityStore.create(authNamespace, providerUserId, userId);
};

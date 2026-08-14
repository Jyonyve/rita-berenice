import { ApiError } from '@rita-berenice/shared/domain';
import { getServerEnv } from '../config/env.js';
import { authIdentityStore } from '../store/authIdentityStore.js';

export const RITA_USER_ID_CLAIM = 'ritaUserId';

export const resolveRitaUserId = async (
	providerUserId: string,
	authNamespace = getServerEnv().AUTH_IDENTITY_NAMESPACE
): Promise<string> => {
	const identity = await authIdentityStore.find(authNamespace, providerUserId);
	if (!identity) {
		throw new ApiError(
			403,
			'This authenticated identity is not linked to a Rita user. Ask an administrator to create an explicit identity mapping.'
		);
	}

	return identity.userId;
};

export const buildRitaAccessTokenPayload = async (
	providerUserId: string,
	accessTokenPayload: Record<string, unknown> | undefined,
	authNamespace = getServerEnv().AUTH_IDENTITY_NAMESPACE
): Promise<Record<string, unknown>> => ({
	...accessTokenPayload,
	[RITA_USER_ID_CLAIM]: await resolveRitaUserId(providerUserId, authNamespace),
});

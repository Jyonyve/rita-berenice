import type { Request } from 'express';
import type { SessionRequest } from 'supertokens-node/framework/express';
import { ApiError } from '@rita-berenice/shared/domain';
import { characterStore } from '../store/characterStore.js';
import { profileStore } from '../store/profileStore.js';
import { sessionStore } from '../store/sessionStore.js';
import { RITA_USER_ID_CLAIM } from '../service/authIdentityService.js';

type AnyRequest = Request<any, any, any, any>;

export const getSessionUserId = (req: AnyRequest): string => {
	const session = (req as SessionRequest).session;
	if (!session) {
		throw new ApiError(401, 'An authenticated session is required.');
	}

	const userId = session.getAccessTokenPayload()[RITA_USER_ID_CLAIM];
	if (typeof userId !== 'string' || userId.length === 0) {
		throw new ApiError(403, 'The authenticated session is not linked to a Rita user. Sign in again.');
	}

	return userId;
};

export const assertSessionUser = (req: AnyRequest, claimedUserId?: string): string => {
	const userId = getSessionUserId(req);
	if (claimedUserId && claimedUserId !== userId) {
		throw new ApiError(403, 'The requested user does not match the authenticated session.');
	}
	return userId;
};

export const assertOwnedSession = async (req: AnyRequest, sessionId: string) => {
	const userId = getSessionUserId(req);
	const response = await sessionStore.getSession(sessionId);
	if (response.sessionInfo.userId !== userId) {
		throw new ApiError(403, `Session '${sessionId}' is not owned by the authenticated user.`);
	}
	return response.sessionInfo;
};

export const assertOwnedCharacter = async (req: AnyRequest, characterId: string) => {
	const userId = getSessionUserId(req);
	const response = await characterStore.getCharacter(characterId);
	if (response.characterInfo.userId !== userId) {
		throw new ApiError(403, `Character '${characterId}' is not owned by the authenticated user.`);
	}
	return response.characterInfo;
};

export const assertCharacterOwnerIfExists = async (req: AnyRequest, characterId: string) => {
	try {
		return await assertOwnedCharacter(req, characterId);
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) {
			return null;
		}
		throw error;
	}
};

export const assertOwnedProfile = async (req: AnyRequest, profileId: string) => {
	const userId = getSessionUserId(req);
	const response = await profileStore.getProfile(profileId);
	if (response.profileInfo.userId !== userId) {
		throw new ApiError(403, `Profile '${profileId}' is not owned by the authenticated user.`);
	}
	return response.profileInfo;
};

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request } from 'express';
import { ApiError } from '@rita-berenice/shared/domain';
import { assertSessionUser, getSessionUserId } from './authUtils.js';

const requestWithUser = (userId?: string) =>
	({ session: userId ? { getUserId: () => userId } : undefined }) as unknown as Request;

test('getSessionUserId returns the authenticated SuperTokens user', () => {
	assert.equal(getSessionUserId(requestWithUser('user-1')), 'user-1');
});

test('getSessionUserId rejects requests without a verified session', () => {
	assert.throws(
		() => getSessionUserId(requestWithUser()),
		(error) => error instanceof ApiError && error.status === 401
	);
});

test('assertSessionUser rejects a client-supplied different user ID', () => {
	assert.throws(
		() => assertSessionUser(requestWithUser('user-1'), 'user-2'),
		(error) => error instanceof ApiError && error.status === 403
	);
});

test('assertSessionUser accepts the matching user ID', () => {
	assert.equal(assertSessionUser(requestWithUser('user-1'), 'user-1'), 'user-1');
});

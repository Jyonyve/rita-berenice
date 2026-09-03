import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request } from 'express';
import { ApiError } from '@rita-berenice/shared/domain';
import { assertSessionUser, getSessionUserId } from './authUtils.js';

const requestWithUser = (providerUserId?: string, ritaUserId?: string) =>
  ({
    session: providerUserId
      ? {
          getUserId: () => providerUserId,
          getAccessTokenPayload: () => (ritaUserId ? { ritaUserId } : {}),
        }
      : undefined,
  }) as unknown as Request;

test('getSessionUserId returns the stable Rita user instead of the provider user', () => {
  assert.equal(getSessionUserId(requestWithUser('provider-user', 'rita-user')), 'rita-user');
});

test('getSessionUserId rejects requests without a verified session', () => {
  assert.throws(
    () => getSessionUserId(requestWithUser()),
    (error) => error instanceof ApiError && error.status === 401,
  );
});

test('getSessionUserId rejects an authenticated session without a Rita identity claim', () => {
  assert.throws(
    () => getSessionUserId(requestWithUser('provider-user')),
    (error) => error instanceof ApiError && error.status === 403,
  );
});

test('assertSessionUser rejects a client-supplied different user ID', () => {
  assert.throws(
    () => assertSessionUser(requestWithUser('provider-user', 'rita-user'), 'other-user'),
    (error) => error instanceof ApiError && error.status === 403,
  );
});

test('assertSessionUser accepts the matching user ID', () => {
  assert.equal(assertSessionUser(requestWithUser('provider-user', 'rita-user'), 'rita-user'), 'rita-user');
});

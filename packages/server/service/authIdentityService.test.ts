import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '@rita-berenice/shared/domain';
import { authIdentityStore } from '../store/authIdentityStore.js';
import { buildRitaAccessTokenPayload, resolveRitaUserId } from './authIdentityService.js';

test('resolves a provider identity to the stable Rita user ID', async () => {
  const originalFind = authIdentityStore.find;
  authIdentityStore.find = async (authNamespace, providerUserId) => ({
    authNamespace,
    providerUserId,
    userId: 'rita-user',
  });

  try {
    assert.equal(await resolveRitaUserId('provider-user', 'supertokens-test'), 'rita-user');
    assert.deepEqual(await buildRitaAccessTokenPayload('provider-user', { existingClaim: true }, 'supertokens-test'), {
      existingClaim: true,
      ritaUserId: 'rita-user',
    });
  } finally {
    authIdentityStore.find = originalFind;
  }
});

test('rejects an authenticated provider identity without an explicit mapping', async () => {
  const originalFind = authIdentityStore.find;
  authIdentityStore.find = async () => null;

  try {
    await assert.rejects(
      () => resolveRitaUserId('unknown-provider-user', 'supertokens-test'),
      (error) => error instanceof ApiError && error.status === 403,
    );
  } finally {
    authIdentityStore.find = originalFind;
  }
});

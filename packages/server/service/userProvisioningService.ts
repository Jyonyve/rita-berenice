import { createBasicUserInfo } from '@rita-berenice/shared/util';
import supertokens from 'supertokens-node';
import { getServerEnv } from '../config/env.js';
import { authIdentityStore } from '../store/authIdentityStore.js';
import { userStore } from '../store/userStore.js';
import { flowLogger, serializeError } from '../util/jsonlLogger.js';

/**
 * Links a freshly signed-up SuperTokens user to a Rita user.
 *
 * Idempotent: no-op when the identity mapping already exists. The Rita user id is
 * set to the SuperTokens user id, matching the per-user document convention.
 */
export const provisionUserOnSignup = async (providerUserId: string, email: string): Promise<void> => {
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

/**
 * Guarantees a Rita user exists for an authenticating SuperTokens identity.
 *
 * This runs on every session creation — sign-up and sign-in alike — because session
 * creation is the single choke point every auth path passes through. Running it here
 * (rather than after `signUpPOST` returns) is what keeps the `ritaUserId` access-token
 * claim resolvable: SuperTokens creates the session *inside* `signUpPOST`, so any
 * provisioning done after that call is already too late.
 *
 * Also self-heals SuperTokens accounts that were created while provisioning was off
 * and would otherwise stay permanently locked out.
 *
 * No-op when `AUTO_PROVISION_USERS` is disabled, which preserves the manual
 * identity-mapping administration model.
 */
export const ensureProvisionedUser = async (providerUserId: string): Promise<void> => {
  const { AUTH_IDENTITY_NAMESPACE, AUTO_PROVISION_USERS } = getServerEnv();
  if (!AUTO_PROVISION_USERS) {
    return;
  }

  const existing = await authIdentityStore.find(AUTH_IDENTITY_NAMESPACE, providerUserId);
  if (existing) {
    return;
  }

  const authUser = await supertokens.getUser(providerUserId);
  const email = authUser?.emails[0];
  if (!email) {
    flowLogger.warn('userProvisioningService', 'provision.skipped.noEmail', { providerUserId });
    return;
  }

  try {
    await provisionUserOnSignup(providerUserId, email);
    flowLogger.info('userProvisioningService', 'provision.complete', { providerUserId });
  } catch (error) {
    flowLogger.error('userProvisioningService', 'provision.failed', {
      providerUserId,
      ...serializeError(error),
    });
    throw error;
  }
};

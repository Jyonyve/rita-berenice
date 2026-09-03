import { and, eq } from 'drizzle-orm';
import { getDatabase } from '../db/postgresClient.js';
import { authIdentities } from '../db/schema.js';

export interface AuthIdentityInfo {
  authNamespace: string;
  providerUserId: string;
  userId: string;
}

export const authIdentityStore = {
  find: async (authNamespace: string, providerUserId: string): Promise<AuthIdentityInfo | null> => {
    const [identity] = await getDatabase()
      .select({
        authNamespace: authIdentities.authNamespace,
        providerUserId: authIdentities.providerUserId,
        userId: authIdentities.userId,
      })
      .from(authIdentities)
      .where(and(eq(authIdentities.authNamespace, authNamespace), eq(authIdentities.providerUserId, providerUserId)))
      .limit(1);

    return identity ?? null;
  },

  create: async (authNamespace: string, providerUserId: string, userId: string): Promise<void> => {
    const now = new Date().toISOString();
    await getDatabase()
      .insert(authIdentities)
      .values({ authNamespace, providerUserId, userId, createdAt: now, updatedAt: now })
      .onConflictDoNothing();
  },
};

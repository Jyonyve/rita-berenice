import { SessionResponse } from '@rita-berenice/shared/api';
import { ApiError, SessionContentPolicy, SessionInfo } from '@rita-berenice/shared/domain';
import { METADATA_TYPES } from '@rita-berenice/shared/config';
import { buildSessionId } from '@rita-berenice/shared/util';
import { and, desc, eq } from 'drizzle-orm';
import { getDatabase } from '../db/postgresClient.js';
import { sessions } from '../db/schema.js';
import { parseEntriesToConversation } from '../util/chatParseUtils.js';
import { handleServiceError } from '../util/serviceHelpers.js';

const toResponse = (sessionInfos: SessionInfo[]): SessionResponse => ({
  sessionInfos,
  sessionInfo: sessionInfos[0] || null,
});

const persistSession = async (sessionInfo: SessionInfo): Promise<void> => {
  await getDatabase()
    .insert(sessions)
    .values({
      sessionId: sessionInfo.sessionId,
      userId: sessionInfo.userId,
      characterId: sessionInfo.characterId,
      profileId: sessionInfo.profileId,
      status: sessionInfo.status,
      data: sessionInfo,
      createdAt: sessionInfo.createdAt,
      updatedAt: sessionInfo.updatedAt,
    })
    .onConflictDoUpdate({
      target: sessions.sessionId,
      set: {
        profileId: sessionInfo.profileId,
        status: sessionInfo.status,
        data: sessionInfo,
        updatedAt: sessionInfo.updatedAt,
      },
    });
};

const requireSession = async (sessionId: string): Promise<SessionInfo> => {
  const [row] = await getDatabase()
    .select({ data: sessions.data })
    .from(sessions)
    .where(eq(sessions.sessionId, sessionId))
    .limit(1);
  if (!row) throw new ApiError(404, `Session '${sessionId}' not found.`);
  return row.data;
};

export const sessionStore = {
  async storeSession(sessionInfo: SessionInfo): Promise<{ sessionId: string }> {
    try {
      await persistSession(sessionInfo);
      return { sessionId: sessionInfo.sessionId };
    } catch (error) {
      handleServiceError(error, `Failed to store session '${sessionInfo.sessionId}'`);
    }
  },

  async createSession(
    userId: string,
    characterId: string,
    firstCharMessage: string,
    title: string,
    contentPolicy: SessionContentPolicy,
  ): Promise<{ sessionId: string }> {
    const now = new Date().toISOString();
    const sessionInfo: SessionInfo = {
      sessionId: buildSessionId(characterId),
      userId,
      characterId,
      profileId: '',
      title: title || 'New Conversation',
      createdAt: now,
      updatedAt: now,
      messageCount: 1,
      status: 'active',
      type: METADATA_TYPES.SESSION,
      lastCharMessage: firstCharMessage,
      userNote: '',
      contentPolicy,
    };
    try {
      await persistSession(sessionInfo);
      return { sessionId: sessionInfo.sessionId };
    } catch (error) {
      handleServiceError(error, `Failed to create session for user ${userId}`);
    }
  },

  async updateSession(sessionInfo: SessionInfo): Promise<void> {
    try {
      await persistSession({ ...sessionInfo, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleServiceError(error, `Failed to update session '${sessionInfo.sessionId}'`);
    }
  },

  async getSessionsByUserId(userId: string): Promise<SessionResponse> {
    try {
      const rows = await getDatabase()
        .select({ data: sessions.data })
        .from(sessions)
        .where(eq(sessions.userId, userId))
        .orderBy(desc(sessions.updatedAt));
      return toResponse(rows.map((row) => row.data));
    } catch (error) {
      handleServiceError(error, `Failed to get sessions for user ${userId}`);
    }
  },

  async getSessionsByUserIdAndCharacterId(userId: string, characterId: string): Promise<SessionResponse> {
    try {
      const rows = await getDatabase()
        .select({ data: sessions.data })
        .from(sessions)
        .where(and(eq(sessions.userId, userId), eq(sessions.characterId, characterId)))
        .orderBy(desc(sessions.updatedAt));
      return toResponse(rows.map((row) => row.data));
    } catch (error) {
      handleServiceError(error, `Failed to get sessions for user ${userId}`);
    }
  },

  async getSession(sessionId: string): Promise<SessionResponse> {
    try {
      return toResponse([await requireSession(sessionId)]);
    } catch (error) {
      handleServiceError(error, `Failed to get session '${sessionId}'`);
    }
  },

  async updateSessionOnNewMessage(sessionId: string, latestCharMessage: string): Promise<void> {
    try {
      const current = await requireSession(sessionId);
      const parsed = JSON.parse(latestCharMessage) as { latestCharMessage: unknown };
      const entries = Array.isArray(parsed.latestCharMessage) ? parsed.latestCharMessage : [];
      await persistSession({
        ...current,
        lastCharMessage: parseEntriesToConversation(entries as never),
        messageCount: current.messageCount + 1,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleServiceError(error, `Failed to update session message '${sessionId}'`);
    }
  },

  async updateSessionTitle(sessionId: string, title: string): Promise<void> {
    try {
      const current = await requireSession(sessionId);
      await persistSession({ ...current, title, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleServiceError(error, `Failed to update session title '${sessionId}'`);
    }
  },

  async updateSessionUserNote(sessionId: string, userNote: string): Promise<void> {
    try {
      const current = await requireSession(sessionId);
      await persistSession({ ...current, userNote, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleServiceError(error, `Failed to update session note '${sessionId}'`);
    }
  },

  async updateSessionContentPolicy(sessionId: string, contentPolicy: SessionContentPolicy): Promise<void> {
    try {
      const current = await requireSession(sessionId);
      await persistSession({ ...current, contentPolicy, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleServiceError(error, `Failed to update session content policy '${sessionId}'`);
    }
  },

  async initSessionProfileId(sessionId: string, profileId: string): Promise<void> {
    try {
      const current = await requireSession(sessionId);
      await persistSession({ ...current, profileId, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleServiceError(error, `Failed to initialize session profile '${sessionId}'`);
    }
  },
};

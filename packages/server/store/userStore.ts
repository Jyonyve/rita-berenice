import { UserResponse } from '@rita-berenice/shared/api';
import { ApiError, UserCdo, UserInfo } from '@rita-berenice/shared/domain';
import { createBasicUserInfo, isUserInfo } from '@rita-berenice/shared/util';
import { eq } from 'drizzle-orm';
import { getDatabase } from '../db/postgresClient.js';
import { users } from '../db/schema.js';
import { handleServiceError } from '../util/serviceHelpers.js';

const toResponse = (userInfos: UserInfo[]): UserResponse => ({
  userInfos,
  userInfo: userInfos[0] || null,
});

export const userStore = {
  findUser: async (userId: string): Promise<UserInfo | null> => {
    try {
      const [row] = await getDatabase()
        .select({ data: users.data })
        .from(users)
        .where(eq(users.userId, userId))
        .limit(1);
      return row?.data ?? null;
    } catch (error) {
      handleServiceError(error, `Failed to find user with ID ${userId}`);
    }
  },

  getAllUsers: async (): Promise<UserResponse> => {
    try {
      const rows = await getDatabase().select({ data: users.data }).from(users);
      return toResponse(rows.map((row) => row.data));
    } catch (error) {
      handleServiceError(error, 'Failed to get all users');
    }
  },

  getUser: async (userId: string): Promise<UserResponse> => {
    try {
      const [row] = await getDatabase()
        .select({ data: users.data })
        .from(users)
        .where(eq(users.userId, userId))
        .limit(1);
      if (!row) throw new ApiError(404, `User '${userId}' not found.`);
      return toResponse([row.data]);
    } catch (error) {
      handleServiceError(error, `Failed to get user with ID ${userId}`);
    }
  },

  getUserByShowName: async (showName: string): Promise<UserResponse> => {
    try {
      const [row] = await getDatabase()
        .select({ data: users.data })
        .from(users)
        .where(eq(users.showName, showName))
        .limit(1);
      if (!row) throw new ApiError(404, `User with showName '${showName}' not found.`);
      return toResponse([row.data]);
    } catch (error) {
      handleServiceError(error, `Failed to get user with showName ${showName}`);
    }
  },

  getUserByEmail: async (email: string): Promise<UserResponse> => {
    try {
      const [row] = await getDatabase().select({ data: users.data }).from(users).where(eq(users.email, email)).limit(1);
      if (!row) throw new ApiError(404, `User with email '${email}' not found.`);
      return toResponse([row.data]);
    } catch (error) {
      handleServiceError(error, `Failed to get user with email ${email}`);
    }
  },

  checkShowNameExists: async (showName: string): Promise<boolean> => {
    try {
      const [row] = await getDatabase()
        .select({ userId: users.userId })
        .from(users)
        .where(eq(users.showName, showName))
        .limit(1);
      return !!row;
    } catch (error) {
      handleServiceError(error, `Failed to check showName '${showName}'`);
    }
  },

  storeUser: async (user: UserCdo | UserInfo): Promise<{ userId: string }> => {
    const now = new Date().toISOString();
    const baseUser = isUserInfo(user) ? user : createBasicUserInfo(user);
    const updatedUser: UserInfo = {
      ...baseUser,
      createdAt: baseUser.createdAt || now,
      updatedAt: now,
    };

    try {
      await getDatabase()
        .insert(users)
        .values({
          userId: updatedUser.userId,
          email: updatedUser.email,
          showName: updatedUser.showName,
          data: updatedUser,
          createdAt: updatedUser.createdAt,
          updatedAt: updatedUser.updatedAt,
        })
        .onConflictDoUpdate({
          target: users.userId,
          set: {
            email: updatedUser.email,
            showName: updatedUser.showName,
            data: updatedUser,
            updatedAt: updatedUser.updatedAt,
          },
        });
      return { userId: updatedUser.userId };
    } catch (error) {
      handleServiceError(error, `Failed to store user '${updatedUser.userId}'`);
    }
  },

  clearCollectionCache: (): void => {},
};

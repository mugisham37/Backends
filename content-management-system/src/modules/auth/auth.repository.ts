import { and, eq, ilike, or } from "drizzle-orm";
import { injectable } from "tsyringe";
import {
  userPermissions,
  userSessions,
  users,
} from "../database/schema/index.js";
import type {
  User,
  UserPermission,
  UserSession,
} from "../database/schema/index.js";
import { DatabaseError } from "../errors/database.error.js";
import { NotFoundError } from "../errors/not-found.error.js";
import type { Result } from "../types/result.types.js";
import { TenantBaseRepository } from "./tenant-base.repository.js";

/**
 * User repository with authentication-specific methods
 */
@injectable()
export class UserRepository extends TenantBaseRepository<User> {
  constructor() {
    super(users);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<Result<User | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      return {
        success: true,
        data: result.length > 0 ? result[0] ?? null : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find user by email",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Find user by email within tenant scope
   */
  async findByEmailInTenant(
    email: string,
    tenantId: string
  ): Promise<Result<User | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(users)
        .where(
          and(
            eq(users.email, email.toLowerCase()),
            eq(users.tenantId, tenantId)
          )
        )
        .limit(1);

      return {
        success: true,
        data: result.length > 0 ? result[0] ?? null : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find user by email in tenant",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Find active users by role
   */
  async findByRole(
    role: string,
    tenantId?: string
  ): Promise<Result<User[], Error>> {
    try {
      const conditions = tenantId
        ? and(
            eq(users.role, role),
            eq(users.isActive, true),
            eq(users.tenantId, tenantId)
          )
        : and(eq(users.role, role), eq(users.isActive, true));

      const result = await this.db.select().from(users).where(conditions);

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find users by role",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Search users by name or email
   */
  async searchUsers(
    query: string,
    tenantId?: string,
    limit = 20
  ): Promise<Result<User[], Error>> {
    try {
      const searchPattern = `%${query.toLowerCase()}%`;
      const searchConditions = or(
        ilike(users.email, searchPattern),
        ilike(users.firstName, searchPattern),
        ilike(users.lastName, searchPattern),
        ilike(users.displayName, searchPattern)
      );

      const conditions = tenantId
        ? and(
            eq(users.isActive, true),
            eq(users.tenantId, tenantId),
            searchConditions
          )
        : and(eq(users.isActive, true), searchConditions);

      const result = await this.db
        .select()
        .from(users)
        .where(conditions)
        .limit(limit);

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to search users",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string): Promise<Result<void, Error>> {
    try {
      await this.db
        .update(users)
        .set({
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to update last login",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Verify user's email
   */
  async verifyEmail(userId: string): Promise<Result<User, Error>> {
    try {
      const [result] = await this.db
        .update(users)
        .set({
          isEmailVerified: true,
          emailVerificationToken: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if (!result) {
        return {
          success: false,
          error: new NotFoundError("User not found"),
        };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to verify email",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Set password reset token
   */
  async setPasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date
  ): Promise<Result<void, Error>> {
    try {
      await this.db
        .update(users)
        .set({
          passwordResetToken: token,
          passwordResetExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to set password reset token",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Clear password reset token
   */
  async clearPasswordResetToken(userId: string): Promise<Result<void, Error>> {
    try {
      await this.db
        .update(users)
        .set({
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to clear password reset token",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Update user password
   */
  async updatePassword(
    userId: string,
    passwordHash: string
  ): Promise<Result<void, Error>> {
    try {
      await this.db
        .update(users)
        .set({
          passwordHash,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to update password",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string): Promise<Result<User, Error>> {
    try {
      const [result] = await this.db
        .update(users)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if (!result) {
        return {
          success: false,
          error: new NotFoundError("User not found"),
        };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to deactivate user",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Activate user account
   */
  async activateUser(userId: string): Promise<Result<User, Error>> {
    try {
      const [result] = await this.db
        .update(users)
        .set({
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if (!result) {
        return {
          success: false,
          error: new NotFoundError("User not found"),
        };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to activate user",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Get user with their active sessions
   */
  async findWithSessions(userId: string): Promise<
    Result<
      {
        user: User;
        sessions: UserSession[];
      } | null,
      Error
    >
  > {
    try {
      const userResult = await this.findById(userId);
      if (!userResult.success || !userResult.data) {
        return { success: true, data: null };
      }

      const sessions = await this.db
        .select()
        .from(userSessions)
        .where(
          and(eq(userSessions.userId, userId), eq(userSessions.isActive, true))
        );

      return {
        success: true,
        data: {
          user: userResult.data,
          sessions,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find user with sessions",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(
    userId: string
  ): Promise<Result<UserPermission[], Error>> {
    try {
      const permissions = await this.db
        .select()
        .from(userPermissions)
        .where(eq(userPermissions.userId, userId));

      return { success: true, data: permissions };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to get user permissions",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Create user session
   */
  async createSession(sessionData: {
    userId: string;
    tokenHash: string;
    refreshTokenHash?: string;
    deviceInfo?: any;
    expiresAt: Date;
  }): Promise<Result<UserSession, Error>> {
    try {
      const [result] = await this.db
        .insert(userSessions)
        .values({
          userId: sessionData.userId,
          tokenHash: sessionData.tokenHash,
          refreshTokenHash: sessionData.refreshTokenHash ?? null,
          deviceInfo: sessionData.deviceInfo ?? null,
          expiresAt: sessionData.expiresAt,
          isActive: true,
        })
        .returning();

      if (!result) {
        return {
          success: false,
          error: new DatabaseError(
            "Failed to create session - no result returned"
          ),
        };
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to create session",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Find session by token hash
   */
  async findSessionByToken(
    tokenHash: string
  ): Promise<Result<UserSession | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(userSessions)
        .where(eq(userSessions.tokenHash, tokenHash))
        .limit(1);

      return {
        success: true,
        data: result.length > 0 ? result[0] ?? null : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find session by token",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Find session by refresh token hash
   */
  async findSessionByRefreshToken(
    refreshTokenHash: string
  ): Promise<Result<UserSession | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(userSessions)
        .where(eq(userSessions.refreshTokenHash, refreshTokenHash))
        .limit(1);

      return {
        success: true,
        data: result.length > 0 ? result[0] ?? null : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find session by refresh token",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Invalidate session
   */
  async invalidateSession(sessionId: string): Promise<Result<void, Error>> {
    try {
      await this.db
        .update(userSessions)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(userSessions.id, sessionId));

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to invalidate session",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Invalidate all user sessions
   */
  async invalidateUserSessions(userId: string): Promise<Result<void, Error>> {
    try {
      await this.db
        .update(userSessions)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(userSessions.userId, userId));

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to invalidate user sessions",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Find user by password reset token
   */
  async findByPasswordResetToken(
    tokenHash: string
  ): Promise<Result<User | null, Error>> {
    try {
      const result = await this.db
        .select()
        .from(users)
        .where(eq(users.passwordResetToken, tokenHash))
        .limit(1);

      return {
        success: true,
        data: result.length > 0 ? result[0] ?? null : null,
      };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find user by reset token",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Reset password and clear reset token
   */
  async resetPassword(
    userId: string,
    passwordHash: string
  ): Promise<Result<void, Error>> {
    try {
      await this.db
        .update(users)
        .set({
          passwordHash,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return { success: true, data: undefined };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to reset password",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<Result<boolean, Error>> {
    try {
      const result = await this.db
        .select()
        .from(userPermissions)
        .where(
          and(
            eq(userPermissions.userId, userId),
            eq(userPermissions.resource, resource),
            eq(userPermissions.action, action)
          )
        )
        .limit(1);

      return { success: true, data: result.length > 0 };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to check user permission",
          error instanceof Error ? error.message : String(error)
        ),
      };
    }
  }
}

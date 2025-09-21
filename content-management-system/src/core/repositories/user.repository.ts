import { eq, and, or, ilike, sql } from "drizzle-orm";
import { injectable } from "tsyringe";
import {
  users,
  userSessions,
  type UserSession,
  type NewUserSession,
} from "../database/schema/auth.schema.ts";
import { DatabaseError } from "../errors/database.error.ts";
import type {
  FilterOptions,
  PaginatedResult,
} from "../types/database.types.ts";
import type { Result } from "../types/result.types.ts";
import { TenantBaseRepository } from "./tenant-base.repository.ts";

/**
 * User entity type
 */
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * User-specific filter options
 */
export interface UserFilterOptions extends FilterOptions<User> {
  role?: string;
  isActive?: boolean;
  isEmailVerified?: boolean;
  search?: string; // Search in email, firstName, lastName, displayName
}

/**
 * User repository implementation
 * Handles all database operations for users
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
      const [user] = await this.db
        .select()
        .from(this.table)
        .where(eq(users.email, email))
        .limit(1);

      return { success: true, data: (user as User) || null };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find user by email",
          "findByEmail",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Find user by email verification token
   */
  async findByEmailVerificationToken(
    token: string
  ): Promise<Result<User | null, Error>> {
    try {
      const [user] = await this.db
        .select()
        .from(this.table)
        .where(eq(users.emailVerificationToken, token))
        .limit(1);

      return { success: true, data: (user as User) || null };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find user by email verification token",
          "findByEmailVerificationToken",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Find user by password reset token
   */
  async findByPasswordResetToken(
    token: string
  ): Promise<Result<User | null, Error>> {
    try {
      const [user] = await this.db
        .select()
        .from(this.table)
        .where(eq(users.passwordResetToken, token))
        .limit(1);

      return { success: true, data: (user as User) || null };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find user by password reset token",
          "findByPasswordResetToken",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Update user password
   */
  async updatePassword(
    id: string,
    passwordHash: string
  ): Promise<Result<User, Error>> {
    try {
      const [updatedUser] = await this.db
        .update(this.table)
        .set({
          passwordHash,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (!updatedUser) {
        return {
          success: false,
          error: new DatabaseError(
            "User not found",
            "updatePassword",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedUser as User };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to update user password",
          "updatePassword",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Verify user email
   */
  async verifyEmail(id: string): Promise<Result<User, Error>> {
    try {
      const [updatedUser] = await this.db
        .update(this.table)
        .set({
          isEmailVerified: true,
          emailVerificationToken: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (!updatedUser) {
        return {
          success: false,
          error: new DatabaseError(
            "User not found",
            "verifyEmail",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedUser as User };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to verify user email",
          "verifyEmail",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(id: string): Promise<Result<User, Error>> {
    try {
      const [updatedUser] = await this.db
        .update(this.table)
        .set({
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (!updatedUser) {
        return {
          success: false,
          error: new DatabaseError(
            "User not found",
            "updateLastLogin",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedUser as User };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to update last login",
          "updateLastLogin",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Search users with advanced filtering
   */
  async searchUsers(
    options: UserFilterOptions = {}
  ): Promise<Result<PaginatedResult<User>, Error>> {
    try {
      const conditions = [];

      // Add role filter
      if (options.role) {
        conditions.push(eq(users.role, options.role));
      }

      // Add active status filter
      if (typeof options.isActive === "boolean") {
        conditions.push(eq(users.isActive, options.isActive));
      }

      // Add email verification filter
      if (typeof options.isEmailVerified === "boolean") {
        conditions.push(eq(users.isEmailVerified, options.isEmailVerified));
      }

      // Add search filter
      if (options.search) {
        const searchTerm = `%${options.search}%`;
        conditions.push(
          or(
            ilike(users.email, searchTerm),
            ilike(users.firstName, searchTerm),
            ilike(users.lastName, searchTerm),
            ilike(users.displayName, searchTerm)
          )
        );
      }

      // Build the complete filter options
      const filterOptions: FilterOptions<User> = {
        ...options,
      };

      if (conditions.length > 0) {
        (filterOptions as any).where = and(...conditions);
      }

      return await this.findManyPaginated(filterOptions);
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to search users",
          "searchUsers",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Find users by role
   */
  async findByRole(
    role: string,
    tenantId?: string
  ): Promise<Result<User[], Error>> {
    try {
      const conditions = [eq(users.role, role)];

      if (tenantId) {
        conditions.push(eq(users.tenantId, tenantId));
      }

      const usersList = await this.db
        .select()
        .from(this.table)
        .where(and(...conditions));

      return { success: true, data: usersList as User[] };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find users by role",
          "findByRole",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Count users by tenant
   */
  override async countByTenant(
    tenantId: string
  ): Promise<Result<number, Error>> {
    try {
      const [result] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(this.table)
        .where(eq(users.tenantId, tenantId));

      return { success: true, data: result?.count || 0 };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to count users by tenant",
          "countByTenant",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Deactivate user
   */
  async deactivate(id: string): Promise<Result<User, Error>> {
    try {
      const [updatedUser] = await this.db
        .update(this.table)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (!updatedUser) {
        return {
          success: false,
          error: new DatabaseError(
            "User not found",
            "deactivate",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedUser as User };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to deactivate user",
          "deactivate",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Activate user
   */
  async activate(id: string): Promise<Result<User, Error>> {
    try {
      const [updatedUser] = await this.db
        .update(this.table)
        .set({
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      if (!updatedUser) {
        return {
          success: false,
          error: new DatabaseError(
            "User not found",
            "activate",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedUser as User };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to activate user",
          "activate",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Create a new user session
   */
  async createSession(
    sessionData: Omit<NewUserSession, "id" | "createdAt" | "updatedAt">
  ): Promise<Result<UserSession, Error>> {
    try {
      const [session] = await this.db
        .insert(userSessions)
        .values({
          ...sessionData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      if (!session) {
        return {
          success: false,
          error: new DatabaseError(
            "Failed to create session",
            "createSession",
            "user_sessions"
          ),
        };
      }

      return { success: true, data: session as UserSession };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to create user session",
          "createSession",
          "user_sessions",
          error
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
      const [session] = await this.db
        .select()
        .from(userSessions)
        .where(
          and(
            eq(userSessions.refreshTokenHash, refreshTokenHash),
            eq(userSessions.isActive, true)
          )
        )
        .limit(1);

      return { success: true, data: (session as UserSession) || null };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find session by refresh token",
          "findSessionByRefreshToken",
          "user_sessions",
          error
        ),
      };
    }
  }

  /**
   * Find session by token hash (access token)
   */
  async findSessionByToken(
    tokenHash: string
  ): Promise<Result<UserSession | null, Error>> {
    try {
      const [session] = await this.db
        .select()
        .from(userSessions)
        .where(
          and(
            eq(userSessions.tokenHash, tokenHash),
            eq(userSessions.isActive, true)
          )
        )
        .limit(1);

      return { success: true, data: (session as UserSession) || null };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to find session by token",
          "findSessionByToken",
          "user_sessions",
          error
        ),
      };
    }
  }

  /**
   * Invalidate a user session
   */
  async invalidateSession(sessionId: string): Promise<Result<boolean, Error>> {
    try {
      const [updatedSession] = await this.db
        .update(userSessions)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(userSessions.id, sessionId))
        .returning();

      return { success: true, data: !!updatedSession };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to invalidate session",
          "invalidateSession",
          "user_sessions",
          error
        ),
      };
    }
  }

  /**
   * Invalidate all user sessions
   */
  async invalidateUserSessions(userId: string): Promise<Result<number, Error>> {
    try {
      const result = await this.db
        .update(userSessions)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(userSessions.userId, userId))
        .returning();

      return { success: true, data: result.length };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to invalidate user sessions",
          "invalidateUserSessions",
          "user_sessions",
          error
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
  ): Promise<Result<User, Error>> {
    try {
      const [updatedUser] = await this.db
        .update(this.table)
        .set({
          passwordResetToken: token,
          passwordResetExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      if (!updatedUser) {
        return {
          success: false,
          error: new DatabaseError(
            "User not found",
            "setPasswordResetToken",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedUser as User };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to set password reset token",
          "setPasswordResetToken",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(
    token: string,
    newPasswordHash: string
  ): Promise<Result<User, Error>> {
    try {
      const [updatedUser] = await this.db
        .update(this.table)
        .set({
          passwordHash: newPasswordHash,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          updatedAt: new Date(),
        })
        .where(eq(users.passwordResetToken, token))
        .returning();

      if (!updatedUser) {
        return {
          success: false,
          error: new DatabaseError(
            "Invalid or expired reset token",
            "resetPassword",
            this.table._.name
          ),
        };
      }

      return { success: true, data: updatedUser as User };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to reset password",
          "resetPassword",
          this.table._.name,
          error
        ),
      };
    }
  }

  /**
   * Check if user has permission
   */
  async hasPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<Result<boolean, Error>> {
    try {
      // For now, this is a simple implementation
      // You can extend this to check user permissions table
      const userResult = await this.findById(userId);
      if (!userResult.success || !userResult.data) {
        return { success: true, data: false };
      }

      const user = userResult.data;

      // Super admin has all permissions
      if (user.role === "super_admin") {
        return { success: true, data: true };
      }

      // Admin has most permissions
      if (user.role === "admin" && resource !== "system") {
        return { success: true, data: true };
      }

      // Simple role-based permissions (extend as needed)
      const rolePermissions = {
        editor: [
          "content:create",
          "content:read",
          "content:update",
          "media:create",
          "media:read",
        ],
        author: [
          "content:create",
          "content:read",
          "content:update:own",
          "media:create",
          "media:read",
        ],
        viewer: ["content:read", "media:read"],
      };

      const permission = `${resource}:${action}`;
      const userPermissions =
        rolePermissions[user.role as keyof typeof rolePermissions] || [];

      return { success: true, data: userPermissions.includes(permission) };
    } catch (error) {
      return {
        success: false,
        error: new DatabaseError(
          "Failed to check user permission",
          "hasPermission",
          this.table._.name,
          error
        ),
      };
    }
  }
}

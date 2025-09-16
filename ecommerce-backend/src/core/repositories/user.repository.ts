/**
 * User repository
 * Handles all database operations for users
 */

import { eq, and, ilike, or, sql } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { Database } from "../database/connection";
import {
  users,
  User,
  NewUser,
  userRoleEnum,
  userStatusEnum,
} from "../database/schema";

// User-specific types
export interface UserFilters {
  email?: string;
  role?: (typeof userRoleEnum.enumValues)[number];
  status?: (typeof userStatusEnum.enumValues)[number];
  emailVerified?: boolean;
  search?: string; // Search in name, email
}

export interface CreateUserData
  extends Omit<NewUser, "id" | "createdAt" | "updatedAt"> {}

export interface UpdateUserData
  extends Partial<Omit<User, "id" | "createdAt" | "updatedAt">> {}

export class UserRepository extends BaseRepository<
  User,
  NewUser,
  UpdateUserData
> {
  protected table = users;
  protected idColumn = users.id;

  constructor(db: Database) {
    super(db);
  }

  // Find user by email
  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result[0] || null;
  }

  // Find users by role
  async findByRole(
    role: (typeof userRoleEnum.enumValues)[number]
  ): Promise<User[]> {
    return this.db.select().from(users).where(eq(users.role, role));
  }

  // Find users by status
  async findByStatus(
    status: (typeof userStatusEnum.enumValues)[number]
  ): Promise<User[]> {
    return this.db.select().from(users).where(eq(users.status, status));
  }

  // Search users with filters
  async findWithFilters(filters: UserFilters): Promise<User[]> {
    let query = this.db.select().from(users);

    const conditions = [];

    if (filters.email) {
      conditions.push(eq(users.email, filters.email));
    }

    if (filters.role) {
      conditions.push(eq(users.role, filters.role));
    }

    if (filters.status) {
      conditions.push(eq(users.status, filters.status));
    }

    if (filters.emailVerified !== undefined) {
      conditions.push(eq(users.emailVerified, filters.emailVerified));
    }

    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(users.email, searchTerm),
          ilike(users.firstName, searchTerm),
          ilike(users.lastName, searchTerm)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query;
  }

  // Check if email exists
  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    let query = this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));

    if (excludeId) {
      query = query.where(
        and(eq(users.email, email), sql`${users.id} != ${excludeId}`)
      );
    }

    const result = await query.limit(1);
    return result.length > 0;
  }

  // Update last login
  async updateLastLogin(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  // Verify email
  async verifyEmail(id: string): Promise<User | null> {
    const result = await this.db
      .update(users)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return result[0] || null;
  }

  // Set password reset token
  async setPasswordResetToken(
    email: string,
    token: string,
    expires: Date
  ): Promise<boolean> {
    const result = await this.db
      .update(users)
      .set({
        passwordResetToken: token,
        passwordResetExpires: expires,
        updatedAt: new Date(),
      })
      .where(eq(users.email, email))
      .returning();

    return result.length > 0;
  }

  // Clear password reset token
  async clearPasswordResetToken(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  }

  // Find by password reset token
  async findByPasswordResetToken(token: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.passwordResetToken, token),
          sql`${users.passwordResetExpires} > NOW()`
        )
      )
      .limit(1);

    return result[0] || null;
  }

  // Get user statistics
  async getStatistics(): Promise<{
    total: number;
    byRole: Record<string, number>;
    byStatus: Record<string, number>;
    verified: number;
    unverified: number;
  }> {
    const [totalResult, roleStats, statusStats, verifiedStats] =
      await Promise.all([
        this.count(),
        this.db
          .select({
            role: users.role,
            count: sql<number>`count(*)::int`,
          })
          .from(users)
          .groupBy(users.role),
        this.db
          .select({
            status: users.status,
            count: sql<number>`count(*)::int`,
          })
          .from(users)
          .groupBy(users.status),
        this.db
          .select({
            verified: users.emailVerified,
            count: sql<number>`count(*)::int`,
          })
          .from(users)
          .groupBy(users.emailVerified),
      ]);

    const byRole: Record<string, number> = {};
    roleStats.forEach((stat) => {
      byRole[stat.role] = stat.count;
    });

    const byStatus: Record<string, number> = {};
    statusStats.forEach((stat) => {
      byStatus[stat.status] = stat.count;
    });

    let verified = 0;
    let unverified = 0;
    verifiedStats.forEach((stat) => {
      if (stat.verified) {
        verified = stat.count;
      } else {
        unverified = stat.count;
      }
    });

    return {
      total: totalResult,
      byRole,
      byStatus,
      verified,
      unverified,
    };
  }
}

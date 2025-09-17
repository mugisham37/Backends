/**
 * Authentication Service
 * Handles user authentication, registration, and session management
 */

import { eq } from "drizzle-orm";
import { AppError } from "../../core/errors/app-error.js";
import {
  users,
  type User,
  type NewUser,
} from "../../core/database/schema/users.js";
import { JWTService, type TokenPair } from "./jwt.service.js";
import type { DrizzleDB } from "../../core/database/connection.js";
import type {
  LoginInput,
  RegisterInput,
  ChangePasswordInput,
  RefreshTokenInput,
} from "../../shared/validators/auth.validators.js";
import {
  hashPassword,
  comparePassword,
  generateRandomToken,
} from "../../shared/utils/crypto.utils.js";

export interface AuthResult {
  user: Omit<User, "password">;
  tokens: TokenPair;
}

export class AuthService {
  constructor(
    private readonly db: DrizzleDB,
    private readonly jwtService: JWTService
  ) {}

  /**
   * Register a new user
   */
  async register(input: RegisterInput): Promise<AuthResult> {
    // Check if user already exists
    const existingUser = await this.findUserByEmail(input.email);
    if (existingUser) {
      throw new AppError("User already exists", 409, "USER_EXISTS");
    }

    // Hash password
    const hashedPassword = await hashPassword(input.password);

    // Create user
    const userData: NewUser = {
      email: input.email,
      password: hashedPassword,
      firstName: input.firstName,
      lastName: input.lastName,
      phoneNumber: input.phone,
      role: input.role || "customer",
      status: "active",
      emailVerified: false,
    };

    const [newUser] = await this.db.insert(users).values(userData).returning();

    // Generate tokens
    const tokens = this.jwtService.generateTokens(newUser);

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  /**
   * Login user with email and password
   */
  async login(input: LoginInput): Promise<AuthResult> {
    // Find user by email
    const user = await this.findUserByEmail(input.email);
    if (!user) {
      throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    // Check if user is active
    if (user.status !== "active") {
      throw new AppError("Account is not active", 401, "ACCOUNT_INACTIVE");
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(
      input.password,
      user.password
    );
    if (!isPasswordValid) {
      throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
    }

    // Update last login
    await this.updateLastLogin(user.id);

    // Generate tokens
    const tokens = this.jwtService.generateTokens(user);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(
    input: RefreshTokenInput
  ): Promise<{ accessToken: string }> {
    try {
      // Verify refresh token
      const refreshPayload = this.jwtService.verifyRefreshToken(
        input.refreshToken
      );

      // Get user from database
      const user = await this.findUserById(refreshPayload.userId);
      if (!user) {
        throw new AppError("User not found", 404, "USER_NOT_FOUND");
      }

      // Check if user is still active
      if (user.status !== "active") {
        throw new AppError("Account is not active", 401, "ACCOUNT_INACTIVE");
      }

      // Generate new access token
      const accessToken = this.jwtService.refreshAccessToken(
        input.refreshToken,
        user
      );

      return { accessToken };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError("Failed to refresh token", 401, "REFRESH_FAILED");
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput
  ): Promise<void> {
    // Get user
    const user = await this.findUserById(userId);
    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    // Verify current password
    const isCurrentPasswordValid = await this.verifyPassword(
      input.currentPassword,
      user.password
    );
    if (!isCurrentPasswordValid) {
      throw new AppError(
        "Current password is incorrect",
        400,
        "INVALID_CURRENT_PASSWORD"
      );
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(input.newPassword);

    // Update password
    await this.db
      .update(users)
      .set({
        password: hashedNewPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<Omit<User, "password"> | null> {
    const user = await this.findUserById(userId);
    if (!user) {
      return null;
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Verify user email
   */
  async verifyEmail(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        status: "inactive",
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // Private helper methods

  private async findUserByEmail(email: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user || null;
  }

  private async findUserById(id: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  }

  private async verifyPassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    return comparePassword(password, hashedPassword);
  }

  private async updateLastLogin(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }
}

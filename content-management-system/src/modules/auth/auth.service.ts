import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { inject, injectable } from "tsyringe";
import { config } from "../../shared/config";
import type {
  User,
  UserRole,
  UserSession,
} from "../../core/database/schema/auth.schema";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "../../core/errors";
import { UserRepository } from "./auth.repository";
import type { Result } from "../../core/types/result.types";
import { logger } from "../../shared/utils/logger";
import { AuditService } from "../audit/audit.service";
import { CacheService } from "../cache/cache.service";

/**
 * Authentication and authorization service
 * Handles JWT token management, password operations, and role-based access control
 */
@injectable()
export class AuthService {
  constructor(
    @inject("UserRepository") private _userRepository: UserRepository,
    @inject("CacheService") private _cacheService: CacheService,
    @inject("AuditService") private _auditService: AuditService
  ) {}

  /**
   * Authenticate user with email and password
   */
  async authenticate(credentials: {
    email: string;
    password: string;
    deviceInfo?: {
      userAgent?: string;
      ip?: string;
      platform?: string;
      browser?: string;
    };
  }): Promise<Result<AuthResult, AuthenticationError>> {
    try {
      // Find user by email
      const userResult = await this.userRepository.findByEmail(
        credentials.email
      );
      if (!userResult.success || !userResult.data) {
        await this.auditService.logAuthAttempt({
          email: credentials.email,
          success: false,
          reason: "user_not_found",
          ip: credentials.deviceInfo?.ip,
        });
        return {
          success: false,
          error: new AuthenticationError("Invalid email or password"),
        };
      }

      const user = userResult.data;

      // Check if user is active
      if (!user.isActive) {
        await this.auditService.logAuthAttempt({
          userId: user.id,
          email: credentials.email,
          success: false,
          reason: "account_deactivated",
          ip: credentials.deviceInfo?.ip,
        });
        return {
          success: false,
          error: new AuthenticationError("Account has been deactivated"),
        };
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(
        credentials.password,
        user.passwordHash
      );
      if (!isPasswordValid) {
        await this.auditService.logAuthAttempt({
          userId: user.id,
          email: credentials.email,
          success: false,
          reason: "invalid_password",
          ip: credentials.deviceInfo?.ip,
        });
        return {
          success: false,
          error: new AuthenticationError("Invalid email or password"),
        };
      }

      // Generate tokens
      const tokensResult = await this.generateTokens(
        user.id,
        credentials.deviceInfo
      );
      if (!tokensResult.success) {
        return {
          success: false,
          error: new AuthenticationError("Failed to generate tokens"),
        };
      }

      // Update last login
      await this.userRepository.updateLastLogin(user.id);

      // Log successful authentication
      await this.auditService.logAuthAttempt({
        userId: user.id,
        email: credentials.email,
        success: true,
        ip: credentials.deviceInfo?.ip,
      });

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            displayName: user.displayName,
            role: user.role as UserRole,
            avatar: user.avatar,
            preferences: user.preferences,
            tenantId: user.tenantId,
          },
          tokens: tokensResult.data,
        },
      };
    } catch (error) {
      logger.error("Authentication error:", error);
      return {
        success: false,
        error: new AuthenticationError("Authentication failed"),
      };
    }
  }

  /**
   * Generate JWT tokens for user
   */
  async generateTokens(
    userId: string,
    deviceInfo?: {
      userAgent?: string;
      ip?: string;
      platform?: string;
      browser?: string;
    }
  ): Promise<Result<TokenPair, Error>> {
    try {
      // Generate access token
      const accessToken = jwt.sign(
        {
          sub: userId,
          type: "access",
          iat: Math.floor(Date.now() / 1000),
        },
        config.jwt.secret,
        {
          expiresIn: config.jwt.accessTokenExpiry || "15m",
          issuer: config.jwt.issuer || "cms-api",
          audience: config.jwt.audience || "cms-client",
        }
      );

      // Generate refresh token
      const refreshToken = jwt.sign(
        {
          sub: userId,
          type: "refresh",
          iat: Math.floor(Date.now() / 1000),
        },
        config.jwt.refreshSecret || config.jwt.secret,
        {
          expiresIn: config.jwt.refreshTokenExpiry || "7d",
          issuer: config.jwt.issuer || "cms-api",
          audience: config.jwt.audience || "cms-client",
        }
      );

      // Store session in database
      const sessionResult = await this.userRepository.createSession({
        userId,
        tokenHash: this.hashToken(accessToken),
        refreshTokenHash: this.hashToken(refreshToken),
        deviceInfo,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      if (!sessionResult.success) {
        return {
          success: false,
          error: new Error("Failed to create session"),
        };
      }

      // Cache user session for quick access
      await this.cacheService.set(
        `session:${this.hashToken(accessToken)}`,
        { userId, sessionId: sessionResult.data.id },
        15 * 60 // 15 minutes
      );

      return {
        success: true,
        data: {
          accessToken,
          refreshToken,
          expiresIn: 15 * 60, // 15 minutes in seconds
          tokenType: "Bearer",
        },
      };
    } catch (error) {
      logger.error("Token generation error:", error);
      return {
        success: false,
        error: new Error("Failed to generate tokens"),
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(
    refreshToken: string
  ): Promise<Result<TokenPair, AuthenticationError>> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken,
        config.jwt.refreshSecret || config.jwt.secret
      ) as jwt.JwtPayload;

      if (decoded.type !== "refresh") {
        return {
          success: false,
          error: new AuthenticationError("Invalid token type"),
        };
      }

      // Find session by refresh token hash
      const sessionResult = await this.userRepository.findSessionByRefreshToken(
        this.hashToken(refreshToken)
      );
      if (!sessionResult.success || !sessionResult.data) {
        return {
          success: false,
          error: new AuthenticationError("Invalid refresh token"),
        };
      }

      const session = sessionResult.data;

      // Check if session is active and not expired
      if (!session.isActive || session.expiresAt < new Date()) {
        return {
          success: false,
          error: new AuthenticationError("Session expired"),
        };
      }

      // Find user
      const userResult = await this.userRepository.findById(session.userId);
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: new AuthenticationError("User not found"),
        };
      }

      const user = userResult.data;

      // Check if user is still active
      if (!user.isActive) {
        return {
          success: false,
          error: new AuthenticationError("Account deactivated"),
        };
      }

      // Generate new tokens
      const tokensResult = await this.generateTokens(
        user.id,
        session.deviceInfo
      );
      if (!tokensResult.success) {
        return {
          success: false,
          error: new AuthenticationError("Failed to generate new tokens"),
        };
      }

      // Invalidate old session
      await this.userRepository.invalidateSession(session.id);

      return tokensResult;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          success: false,
          error: new AuthenticationError("Invalid refresh token"),
        };
      }
      logger.error("Token refresh error:", error);
      return {
        success: false,
        error: new AuthenticationError("Token refresh failed"),
      };
    }
  }

  /**
   * Validate JWT token and return user payload
   */
  async validateToken(
    token: string
  ): Promise<Result<UserPayload, AuthenticationError>> {
    try {
      // Check cache first
      const tokenHash = this.hashToken(token);
      const cachedSession = await this.cacheService.get(`session:${tokenHash}`);

      if (cachedSession) {
        const userResult = await this.userRepository.findById(
          cachedSession.userId
        );
        if (userResult.success && userResult.data && userResult.data.isActive) {
          return {
            success: true,
            data: {
              userId: userResult.data.id,
              email: userResult.data.email,
              role: userResult.data.role as UserRole,
              tenantId: userResult.data.tenantId,
            },
          };
        }
      }

      // Verify JWT token
      const decoded = jwt.verify(token, config.jwt.secret) as jwt.JwtPayload;

      if (decoded.type !== "access") {
        return {
          success: false,
          error: new AuthenticationError("Invalid token type"),
        };
      }

      // Find session
      const sessionResult = await this.userRepository.findSessionByToken(
        tokenHash
      );
      if (!sessionResult.success || !sessionResult.data) {
        return {
          success: false,
          error: new AuthenticationError("Session not found"),
        };
      }

      const session = sessionResult.data;

      // Check if session is active
      if (!session.isActive || session.expiresAt < new Date()) {
        return {
          success: false,
          error: new AuthenticationError("Session expired"),
        };
      }

      // Find user
      const userResult = await this.userRepository.findById(session.userId);
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: new AuthenticationError("User not found"),
        };
      }

      const user = userResult.data;

      if (!user.isActive) {
        return {
          success: false,
          error: new AuthenticationError("Account deactivated"),
        };
      }

      // Cache the session for future requests
      await this.cacheService.set(
        `session:${tokenHash}`,
        { userId: user.id, sessionId: session.id },
        15 * 60 // 15 minutes
      );

      return {
        success: true,
        data: {
          userId: user.id,
          email: user.email,
          role: user.role as UserRole,
          tenantId: user.tenantId,
        },
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return {
          success: false,
          error: new AuthenticationError("Invalid token"),
        };
      }
      logger.error("Token validation error:", error);
      return {
        success: false,
        error: new AuthenticationError("Token validation failed"),
      };
    }
  }

  /**
   * Revoke token (logout)
   */
  async revokeToken(token: string): Promise<Result<void, Error>> {
    try {
      const tokenHash = this.hashToken(token);

      // Remove from cache
      await this.cacheService.delete(`session:${tokenHash}`);

      // Find and invalidate session
      const sessionResult = await this.userRepository.findSessionByToken(
        tokenHash
      );
      if (sessionResult.success && sessionResult.data) {
        await this.userRepository.invalidateSession(sessionResult.data.id);
      }

      return { success: true, data: undefined };
    } catch (error) {
      logger.error("Token revocation error:", error);
      return {
        success: false,
        error: new Error("Failed to revoke token"),
      };
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<Result<void, AuthenticationError | ValidationError>> {
    try {
      // Find user
      const userResult = await this.userRepository.findById(userId);
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: new AuthenticationError("User not found"),
        };
      }

      const user = userResult.data;

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.passwordHash
      );
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          error: new AuthenticationError("Current password is incorrect"),
        };
      }

      // Validate new password
      const passwordValidation = this.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: new ValidationError("Password validation failed", {
            password: passwordValidation.errors,
          }),
        };
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // Update password
      const updateResult = await this.userRepository.updatePassword(
        userId,
        newPasswordHash
      );
      if (!updateResult.success) {
        return {
          success: false,
          error: new Error("Failed to update password"),
        };
      }

      // Invalidate all user sessions except current one
      await this.userRepository.invalidateUserSessions(userId);

      // Log password change
      await this.auditService.logSecurityEvent({
        userId,
        event: "password_changed",
        details: { timestamp: new Date() },
      });

      return { success: true, data: undefined };
    } catch (error) {
      logger.error("Password change error:", error);
      return {
        success: false,
        error: new Error("Failed to change password"),
      };
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<Result<string, Error>> {
    try {
      // Find user by email
      const userResult = await this.userRepository.findByEmail(email);
      if (!userResult.success || !userResult.data) {
        // Don't reveal if user exists or not
        return { success: true, data: "reset_requested" };
      }

      const user = userResult.data;

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenHash = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token
      const updateResult = await this.userRepository.setPasswordResetToken(
        user.id,
        resetTokenHash,
        expiresAt
      );
      if (!updateResult.success) {
        return {
          success: false,
          error: new Error("Failed to generate reset token"),
        };
      }

      // Log password reset request
      await this.auditService.logSecurityEvent({
        userId: user.id,
        event: "password_reset_requested",
        details: { email, timestamp: new Date() },
      });

      // In production, send email with reset link
      logger.info(`Password reset token for ${email}: ${resetToken}`);

      return { success: true, data: resetToken };
    } catch (error) {
      logger.error("Password reset request error:", error);
      return {
        success: false,
        error: new Error("Failed to request password reset"),
      };
    }
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<Result<void, AuthenticationError | ValidationError>> {
    try {
      // Hash the token to match stored hash
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      // Find user by reset token
      const userResult = await this.userRepository.findByPasswordResetToken(
        tokenHash
      );
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: new AuthenticationError("Invalid or expired reset token"),
        };
      }

      const user = userResult.data;

      // Check if token is expired
      if (
        !user.passwordResetExpiresAt ||
        user.passwordResetExpiresAt < new Date()
      ) {
        return {
          success: false,
          error: new AuthenticationError("Reset token has expired"),
        };
      }

      // Validate new password
      const passwordValidation = this.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          error: new ValidationError("Password validation failed", {
            password: passwordValidation.errors,
          }),
        };
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // Update password and clear reset token
      const updateResult = await this.userRepository.resetPassword(
        user.id,
        newPasswordHash
      );
      if (!updateResult.success) {
        return {
          success: false,
          error: new Error("Failed to reset password"),
        };
      }

      // Invalidate all user sessions
      await this.userRepository.invalidateUserSessions(user.id);

      // Log password reset
      await this.auditService.logSecurityEvent({
        userId: user.id,
        event: "password_reset_completed",
        details: { timestamp: new Date() },
      });

      return { success: true, data: undefined };
    } catch (error) {
      logger.error("Password reset error:", error);
      return {
        success: false,
        error: new Error("Failed to reset password"),
      };
    }
  }

  /**
   * Check if user has permission for resource and action
   */
  async hasPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<Result<boolean, Error>> {
    try {
      // Check cache first
      const cacheKey = `permission:${userId}:${resource}:${action}`;
      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult !== null) {
        return { success: true, data: cachedResult };
      }

      // Get user with role
      const userResult = await this.userRepository.findById(userId);
      if (!userResult.success || !userResult.data) {
        return { success: true, data: false };
      }

      const user = userResult.data;

      // Check role-based permissions
      const hasRolePermission = this.checkRolePermission(
        user.role as UserRole,
        resource,
        action
      );

      // Check explicit permissions
      const permissionResult = await this.userRepository.hasPermission(
        userId,
        resource,
        action
      );
      const hasExplicitPermission =
        permissionResult.success && permissionResult.data;

      const hasAccess = hasRolePermission || hasExplicitPermission;

      // Cache result for 5 minutes
      await this.cacheService.set(cacheKey, hasAccess, 5 * 60);

      return { success: true, data: hasAccess };
    } catch (error) {
      logger.error("Permission check error:", error);
      return {
        success: false,
        error: new Error("Failed to check permission"),
      };
    }
  }

  /**
   * Hash token for storage
   */
  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters long");
    }

    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter");
    }

    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter");
    }

    if (!/\d/.test(password)) {
      errors.push("Password must contain at least one number");
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push("Password must contain at least one special character");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check role-based permissions
   */
  private checkRolePermission(
    role: UserRole,
    resource: string,
    action: string
  ): boolean {
    const rolePermissions: Record<UserRole, Record<string, string[]>> = {
      super_admin: {
        "*": ["*"], // Super admin has all permissions
      },
      admin: {
        users: ["create", "read", "update", "delete"],
        content: ["create", "read", "update", "delete", "publish"],
        media: ["create", "read", "update", "delete"],
        settings: ["read", "update"],
      },
      editor: {
        content: ["create", "read", "update", "delete", "publish"],
        media: ["create", "read", "update", "delete"],
        users: ["read"],
      },
      author: {
        content: ["create", "read", "update"],
        media: ["create", "read", "update"],
        users: ["read"],
      },
      viewer: {
        content: ["read"],
        media: ["read"],
        users: ["read"],
      },
    };

    const permissions = rolePermissions[role];
    if (!permissions) return false;

    // Check wildcard permissions
    if (permissions["*"]?.includes("*")) return true;
    if (permissions["*"]?.includes(action)) return true;

    // Check resource-specific permissions
    const resourcePermissions = permissions[resource];
    if (!resourcePermissions) return false;

    return (
      resourcePermissions.includes("*") || resourcePermissions.includes(action)
    );
  }
}

/**
 * Type definitions for AuthService
 */
export interface AuthResult {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
    role: UserRole;
    avatar: string | null;
    preferences: any;
    tenantId: string;
  };
  tokens: TokenPair;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface UserPayload {
  userId: string;
  email: string;
  role: UserRole;
  tenantId: string;
}

import type { FastifyReply, FastifyRequest } from "fastify";
import { inject, injectable } from "tsyringe";
import { logger } from "../../shared/utils/logger.ts";
import { AuthService } from "./auth.service.ts";
import type { LoginCredentials } from "./auth.types.ts";
import type { CreateUserRequest } from "./user.schemas.ts";

/**
 * Authentication controller for Fastify
 * Handles user registration, login, and token management
 */
@injectable()
export class AuthController {
  constructor(@inject("AuthService") private _authService: AuthService) {}

  /**
   * Register a new user
   */
  public register = async (
    request: FastifyRequest<{ Body: CreateUserRequest }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const userData = request.body;

      logger.info("User registration attempt", { email: userData.email });

      const registrationData: {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        role?: string;
        preferences?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
        tenantId?: string;
      } = {
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
      };

      if (userData.preferences) {
        registrationData.preferences = userData.preferences as Record<
          string,
          unknown
        >;
      }

      if (userData.metadata) {
        registrationData.metadata = userData.metadata as Record<
          string,
          unknown
        >;
      }

      const result = await this._authService.registerUser(registrationData);

      if (!result.success) {
        logger.warn("Registration failed", {
          email: userData.email,
          error: result.error?.message,
        });

        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Registration failed",
          code: "REGISTRATION_FAILED",
        });
      }

      logger.info("User registered successfully", {
        email: userData.email,
        userId: result.data?.user.id,
      });

      return reply.status(201).send({
        status: "success",
        data: {
          user: {
            id: result.data?.user.id,
            email: result.data?.user.email,
            firstName: result.data?.user.firstName,
            lastName: result.data?.user.lastName,
            role: result.data?.user.role,
          },
          tokens: result.data?.tokens,
        },
      });
    } catch (error) {
      logger.error("Registration error:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Authenticate user login
   */
  public login = async (
    request: FastifyRequest<{ Body: LoginCredentials }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const credentials = request.body;
      const deviceInfo: {
        userAgent?: string;
        ip?: string;
        platform?: string;
        browser?: string;
      } = {};

      if (request.headers["user-agent"]) {
        deviceInfo.userAgent = request.headers["user-agent"];
      }
      if (request.ip) {
        deviceInfo.ip = request.ip;
      }
      if (typeof request.headers["sec-ch-ua-platform"] === "string") {
        deviceInfo.platform = request.headers["sec-ch-ua-platform"];
      }

      logger.info("Login attempt", { email: credentials.email });

      const result = await this._authService.authenticate({
        ...credentials,
        deviceInfo,
      });

      if (!result.success) {
        logger.warn("Login failed", {
          email: credentials.email,
          error: result.error?.message,
        });

        return reply.status(401).send({
          status: "error",
          message: result.error?.message || "Authentication failed",
          code: "AUTHENTICATION_FAILED",
        });
      }

      logger.info("Login successful", {
        email: credentials.email,
        userId: result.data?.user.id,
      });

      return reply.status(200).send({
        status: "success",
        data: {
          user: {
            id: result.data?.user.id,
            email: result.data?.user.email,
            firstName: result.data?.user.firstName,
            lastName: result.data?.user.lastName,
            role: result.data?.user.role,
          },
          tokens: result.data?.tokens,
        },
      });
    } catch (error) {
      logger.error("Login error:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Refresh access token
   */
  public refreshToken = async (
    request: FastifyRequest<{ Body: { refreshToken: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { refreshToken } = request.body;

      if (!refreshToken) {
        return reply.status(400).send({
          status: "error",
          message: "Refresh token is required",
          code: "MISSING_REFRESH_TOKEN",
        });
      }

      const result = await this._authService.refreshToken(refreshToken);

      if (!result.success) {
        return reply.status(401).send({
          status: "error",
          message: result.error?.message || "Invalid refresh token",
          code: "INVALID_REFRESH_TOKEN",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          tokens: result.data,
        },
      });
    } catch (error) {
      logger.error("Token refresh error:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Logout user (invalidate tokens)
   */
  public logout = async (
    request: FastifyRequest<{ Body: { refreshToken?: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { refreshToken } = request.body;
      const authHeader = request.headers.authorization;
      const accessToken = authHeader?.replace("Bearer ", "");

      if (!accessToken && !refreshToken) {
        return reply.status(400).send({
          status: "error",
          message: "Access token or refresh token required",
          code: "MISSING_TOKEN",
        });
      }

      const logoutData: { accessToken?: string; refreshToken?: string } = {};

      if (accessToken) {
        logoutData.accessToken = accessToken;
      }
      if (refreshToken) {
        logoutData.refreshToken = refreshToken;
      }

      const result = await this._authService.logout(logoutData);

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Logout failed",
          code: "LOGOUT_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        message: "Logged out successfully",
      });
    } catch (error) {
      logger.error("Logout error:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Get current user profile
   */
  public getProfile = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      // User should be available from auth middleware
      const user = (request as any).user;

      if (!user) {
        return reply.status(401).send({
          status: "error",
          message: "User not authenticated",
          code: "NOT_AUTHENTICATED",
        });
      }

      const result = await this._authService.getUserProfile(user.id);

      if (!result.success) {
        return reply.status(404).send({
          status: "error",
          message: result.error?.message || "User not found",
          code: "USER_NOT_FOUND",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          user: result.data,
        },
      });
    } catch (error) {
      logger.error("Get profile error:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Change password
   */
  public changePassword = async (
    request: FastifyRequest<{
      Body: { currentPassword: string; newPassword: string };
    }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { currentPassword, newPassword } = request.body;
      const user = (request as any).user;

      if (!user) {
        return reply.status(401).send({
          status: "error",
          message: "User not authenticated",
          code: "NOT_AUTHENTICATED",
        });
      }

      const result = await this._authService.changePassword({
        userId: user.id,
        currentPassword,
        newPassword,
      });

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Password change failed",
          code: "PASSWORD_CHANGE_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        message: "Password changed successfully",
      });
    } catch (error) {
      logger.error("Change password error:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Request password reset
   */
  public forgotPassword = async (
    request: FastifyRequest<{ Body: { email: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { email } = request.body;

      await this._authService.initiateForgotPassword(email);

      // Always return success to prevent email enumeration
      return reply.status(200).send({
        status: "success",
        message:
          "If your email is registered, you will receive a password reset link",
      });
    } catch (error) {
      logger.error("Forgot password error:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };

  /**
   * Reset password with token
   */
  public resetPassword = async (
    request: FastifyRequest<{ Body: { token: string; newPassword: string } }>,
    reply: FastifyReply
  ): Promise<void> => {
    try {
      const { token, newPassword } = request.body;

      const result = await this._authService.resetPassword(token, newPassword);

      if (!result.success) {
        return reply.status(400).send({
          status: "error",
          message: result.error?.message || "Password reset failed",
          code: "PASSWORD_RESET_FAILED",
        });
      }

      return reply.status(200).send({
        status: "success",
        message: "Password reset successfully",
      });
    } catch (error) {
      logger.error("Reset password error:", error);
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      });
    }
  };
}

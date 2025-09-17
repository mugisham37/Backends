/**
 * Authentication Controller
 * Handles authentication endpoints: login, register, refresh, logout
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "./auth.service.js";
import { JWTService } from "./jwt.service.js";
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  changePasswordSchema,
  type LoginInput,
  type RegisterInput,
  type RefreshTokenInput,
  type ChangePasswordInput,
} from "../../shared/validators/auth.validators.js";
import { AppError } from "../../core/errors/app-error.js";
import type { AuthenticatedRequest } from "../../shared/middleware/auth.middleware.js";
import { Validate } from "../../core/decorators/validate.decorator.js";
import { MonitorQuery } from "../../core/decorators/query-monitor.decorator.js";

export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JWTService
  ) {}

  /**
   * Register a new user
   */
  @Validate({ target: "body", schema: registerSchema })
  @MonitorQuery({ description: "User registration" })
  async register(
    request: FastifyRequest<{ Body: RegisterInput }>,
    reply: FastifyReply
  ): Promise<void> {
    // Validation is handled by decorator
    const result = await this.authService.register(request.body);

    reply.status(201).send({
      success: true,
      message: "User registered successfully",
      data: {
        user: result.user,
        tokens: result.tokens,
      },
    });
  }

  /**
   * Login user
   */
  async login(
    request: FastifyRequest<{ Body: LoginInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const validatedInput = loginSchema.parse(request.body);

    const result = await this.authService.login(validatedInput);

    reply.send({
      success: true,
      message: "Login successful",
      data: {
        user: result.user,
        tokens: result.tokens,
      },
    });
  }

  /**
   * Refresh access token
   */
  async refreshToken(
    request: FastifyRequest<{ Body: RefreshTokenInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const validatedInput = refreshTokenSchema.parse(request.body);

    const result = await this.authService.refreshToken(validatedInput);

    reply.send({
      success: true,
      message: "Token refreshed successfully",
      data: result,
    });
  }

  /**
   * Get current user profile
   */
  async getProfile(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    const user = await this.authService.getUserProfile(request.userId);

    if (!user) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }

    reply.send({
      success: true,
      message: "Profile retrieved successfully",
      data: user,
    });
  }

  /**
   * Change password
   */
  async changePassword(
    request: FastifyRequest<{ Body: ChangePasswordInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const authRequest = request as AuthenticatedRequest;
    const validatedInput = changePasswordSchema.parse(request.body);

    await this.authService.changePassword(authRequest.userId, validatedInput);

    reply.send({
      success: true,
      message: "Password changed successfully",
    });
  }

  /**
   * Logout user (invalidate refresh token)
   */
  async logout(
    request: FastifyRequest<{ Body: { refreshToken: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    // In a real implementation, you would invalidate the refresh token
    // For now, we'll just return success
    reply.send({
      success: true,
      message: "Logged out successfully",
    });
  }
}

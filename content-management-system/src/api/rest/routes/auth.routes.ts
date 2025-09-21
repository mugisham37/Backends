import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { container } from "tsyringe";
import {
  type LoginRequest,
  type RefreshTokenRequest,
  loginSchema,
  refreshTokenSchema,
} from "../../../modules/auth/auth.schemas";
import type { IAuthService } from "../../../modules/auth/auth.types";
import { validate } from "../../../shared/middleware/zod-validation";

/**
 * Authentication REST Routes
 *
 * Handles user authentication, token management, and authorization.
 */
export const authRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  const authService = container.resolve<IAuthService>("AuthService");

  // Login endpoint
  fastify.post(
    "/login",
    {
      preHandler: [validate({ body: loginSchema })],
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  user: { type: "object" },
                  accessToken: { type: "string" },
                  refreshToken: { type: "string" },
                  expiresIn: { type: "number" },
                },
              },
              timestamp: { type: "string" },
            },
          },
          400: { $ref: "error" },
          401: { $ref: "error" },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as LoginRequest;

      const result = await authService.authenticate({ email, password });

      if (!result.success) {
        return reply.status(401).send({
          error: "Authentication Failed",
          message: result.error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Logout endpoint
  fastify.post(
    "/logout",
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      // Implement logout logic (token blacklisting, etc.)
      return reply.status(200).send({
        success: true,
        message: "Logged out successfully",
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Refresh token endpoint
  fastify.post(
    "/refresh",
    {
      preHandler: [validate({ body: refreshTokenSchema })],
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  accessToken: { type: "string" },
                  refreshToken: { type: "string" },
                  expiresIn: { type: "number" },
                },
              },
              timestamp: { type: "string" },
            },
          },
          400: { $ref: "error" },
          401: { $ref: "error" },
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body as RefreshTokenRequest;

      const result = await authService.refreshToken(refreshToken);

      if (!result.success) {
        return reply.status(401).send({
          error: "Token Refresh Failed",
          message: result.error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Get current user endpoint
  fastify.get(
    "/me",
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
              timestamp: { type: "string" },
            },
          },
          401: { $ref: "error" },
        },
      },
    },
    async (request, reply) => {
      return reply.status(200).send({
        success: true,
        data: request.user,
        timestamp: new Date().toISOString(),
      });
    }
  );
};

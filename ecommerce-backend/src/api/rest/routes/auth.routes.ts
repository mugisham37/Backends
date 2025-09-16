/**
 * Authentication REST API routes
 * Fastify-based routes with proper authentication and security
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { AuthController } from "../../../modules/auth/auth.controller.js";
import { AuthService } from "../../../modules/auth/auth.service.js";
import { JWTService } from "../../../modules/auth/jwt.service.js";
import { AuthMiddleware } from "../../../shared/middleware/auth.middleware.js";
import {
  RateLimitMiddleware,
  rateLimitConfigs,
  bruteForceConfigs,
} from "../../../shared/middleware/rate-limit.middleware.js";
import { securityMiddleware } from "../../../shared/middleware/security.middleware.js";
import { getDatabase } from "../../../core/database/connection.js";
import {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from "../../../shared/validators/auth.validators.js";

export async function authRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Initialize services
  const db = getDatabase();
  const jwtService = new JWTService();
  const authService = new AuthService(db, jwtService);
  const authController = new AuthController(authService, jwtService);
  const authMiddleware = new AuthMiddleware(jwtService);
  const rateLimitMiddleware = new RateLimitMiddleware();

  // Apply security middleware to all auth routes
  fastify.addHook("preHandler", securityMiddleware.securityHeaders());
  fastify.addHook("preHandler", securityMiddleware.sanitizeInput());

  // Apply rate limiting to auth endpoints
  const authRateLimit = rateLimitMiddleware.createRateLimit(
    rateLimitConfigs.auth
  );
  const bruteForceProtection = rateLimitMiddleware.createBruteForceProtection(
    bruteForceConfigs.login
  );

  // Public routes (no authentication required)
  fastify.post("/register", {
    schema: {
      body: registerSchema,
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                user: { type: "object" },
                tokens: { type: "object" },
              },
            },
          },
        },
      },
    },
    preHandler: [authRateLimit],
    handler: authController.register.bind(authController),
  });

  fastify.post("/login", {
    schema: {
      body: loginSchema,
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                user: { type: "object" },
                tokens: { type: "object" },
              },
            },
          },
        },
      },
    },
    preHandler: [authRateLimit, bruteForceProtection],
    handler: authController.login.bind(authController),
  });

  fastify.post("/refresh", {
    schema: {
      body: refreshTokenSchema,
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                accessToken: { type: "string" },
              },
            },
          },
        },
      },
    },
    preHandler: [authRateLimit],
    handler: authController.refreshToken.bind(authController),
  });

  // Protected routes (authentication required)
  fastify.get("/me", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate],
    handler: authController.getProfile.bind(authController),
  });

  fastify.post("/change-password", {
    schema: {
      body: changePasswordSchema,
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, authRateLimit],
    handler: authController.changePassword.bind(authController),
  });

  fastify.post("/logout", {
    schema: {
      body: {
        type: "object",
        properties: {
          refreshToken: { type: "string" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
          },
        },
      },
    },
    preHandler: [authMiddleware.optionalAuth],
    handler: authController.logout.bind(authController),
  });
}

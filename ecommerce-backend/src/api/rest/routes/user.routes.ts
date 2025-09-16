/**
 * User REST API routes
 * Fastify-based routes with proper validation and security
 */

import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { JWTService } from "../../../modules/auth/jwt.service.js";
import { AuthMiddleware } from "../../../shared/middleware/auth.middleware.js";
import {
  RateLimitMiddleware,
  rateLimitConfigs,
} from "../../../shared/middleware/rate-limit.middleware.js";
import { securityMiddleware } from "../../../shared/middleware/security.middleware.js";
import {
  ResponseBuilder,
  HTTP_STATUS,
} from "../../../shared/utils/response.utils.js";

// Interfaces for request/response types
interface UserParams {
  id: string;
}

interface AddressParams {
  id: string;
}

interface ProductParams {
  productId: string;
}

interface UserQuery {
  limit?: string;
  offset?: string;
  role?: string;
  status?: string;
}

interface UpdateUserBody {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  preferences?: Record<string, any>;
}

interface UpdatePasswordBody {
  currentPassword: string;
  newPassword: string;
}

interface AddAddressBody {
  type: "shipping" | "billing";
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

interface UpdateUserStatusBody {
  status: "active" | "inactive" | "suspended";
  reason?: string;
}

export async function userRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Initialize services
  const jwtService = new JWTService();
  const authMiddleware = new AuthMiddleware(jwtService);
  const rateLimitMiddleware = new RateLimitMiddleware();

  // Apply security middleware to all user routes
  fastify.addHook("preHandler", securityMiddleware.securityHeaders());
  fastify.addHook("preHandler", securityMiddleware.sanitizeInput());

  // Apply rate limiting to user endpoints
  const userRateLimit = rateLimitMiddleware.createRateLimit(
    rateLimitConfigs.api
  );

  // Get current user profile
  fastify.get("/profile", {
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
    preHandler: [authMiddleware.authenticate, userRateLimit],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request.user as any)?.id;

        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        // TODO: Implement with UserService
        // const user = await userService.getUserProfile(userId);

        // Placeholder response
        const user = {
          id: userId,
          email: "user@example.com",
          firstName: "John",
          lastName: "Doe",
          phoneNumber: "+1234567890",
          dateOfBirth: "1990-01-01",
          preferences: {},
          createdAt: new Date().toISOString(),
        };

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(user, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch profile";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(message, "FETCH_PROFILE_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Update user profile
  fastify.put<{
    Body: UpdateUserBody;
  }>("/profile", {
    schema: {
      body: {
        type: "object",
        properties: {
          firstName: { type: "string", minLength: 1, maxLength: 50 },
          lastName: { type: "string", minLength: 1, maxLength: 50 },
          phoneNumber: { type: "string", pattern: "^\\+?[1-9]\\d{1,14}$" },
          dateOfBirth: { type: "string", format: "date" },
          preferences: { type: "object" },
        },
      },
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
    preHandler: [authMiddleware.authenticate, userRateLimit],
    handler: async (
      request: FastifyRequest<{ Body: UpdateUserBody }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = (request.user as any)?.id;
        const updates = request.body;

        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        // TODO: Implement with UserService
        // const user = await userService.updateUserProfile(userId, updates);

        // Placeholder response
        const user = {
          id: userId,
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(user, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update profile";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(message, "UPDATE_PROFILE_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Update password
  fastify.patch<{
    Body: UpdatePasswordBody;
  }>("/password", {
    schema: {
      body: {
        type: "object",
        properties: {
          currentPassword: { type: "string", minLength: 1 },
          newPassword: { type: "string", minLength: 8, maxLength: 128 },
        },
        required: ["currentPassword", "newPassword"],
      },
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
    preHandler: [authMiddleware.authenticate, userRateLimit],
    handler: async (
      request: FastifyRequest<{ Body: UpdatePasswordBody }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = (request.user as any)?.id;
        const { currentPassword, newPassword } = request.body;

        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        // TODO: Implement with UserService
        // await userService.updatePassword(userId, currentPassword, newPassword);

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(
              { message: "Password updated successfully" },
              { requestId: (request as any).id }
            )
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update password";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(message, "UPDATE_PASSWORD_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Get user addresses
  fastify.get("/addresses", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "array" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, userRateLimit],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request.user as any)?.id;

        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        // TODO: Implement with UserService
        // const addresses = await userService.getUserAddresses(userId);

        // Placeholder response
        const addresses = [
          {
            id: "addr-1",
            type: "shipping",
            street: "123 Main St",
            city: "Anytown",
            state: "CA",
            postalCode: "12345",
            country: "US",
            isDefault: true,
          },
        ];

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(addresses, {
              requestId: (request as any).id,
            })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch addresses";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(message, "FETCH_ADDRESSES_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Add new address
  fastify.post<{
    Body: AddAddressBody;
  }>("/addresses", {
    schema: {
      body: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["shipping", "billing"] },
          street: { type: "string", minLength: 1 },
          city: { type: "string", minLength: 1 },
          state: { type: "string", minLength: 1 },
          postalCode: { type: "string", minLength: 1 },
          country: { type: "string", minLength: 2, maxLength: 2 },
          isDefault: { type: "boolean", default: false },
        },
        required: ["type", "street", "city", "state", "postalCode", "country"],
      },
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, userRateLimit],
    handler: async (
      request: FastifyRequest<{ Body: AddAddressBody }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = (request.user as any)?.id;
        const addressData = request.body;

        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        // TODO: Implement with UserService
        // const address = await userService.addUserAddress(userId, addressData);

        // Placeholder response
        const address = {
          id: "addr-new",
          userId,
          ...addressData,
          createdAt: new Date().toISOString(),
        };

        return reply
          .status(HTTP_STATUS.CREATED)
          .send(
            ResponseBuilder.success(address, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to add address";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(message, "ADD_ADDRESS_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Delete address
  fastify.delete<{
    Params: AddressParams;
  }>("/addresses/:id", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
      response: {
        204: {
          type: "null",
        },
      },
    },
    preHandler: [authMiddleware.authenticate, userRateLimit],
    handler: async (
      request: FastifyRequest<{ Params: AddressParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const userId = (request.user as any)?.id;

        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        // TODO: Implement with UserService
        // await userService.deleteUserAddress(userId, id);

        return reply.status(HTTP_STATUS.NO_CONTENT).send();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to delete address";
        const status = message.includes("not found")
          ? HTTP_STATUS.NOT_FOUND
          : HTTP_STATUS.BAD_REQUEST;

        return reply.status(status).send(
          ResponseBuilder.error(message, "DELETE_ADDRESS_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Admin only routes

  // Get all users (admin only)
  fastify.get<{
    Querystring: UserQuery;
  }>("/", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          limit: { type: "string", default: "20" },
          offset: { type: "string", default: "0" },
          role: { type: "string", enum: ["user", "vendor", "admin"] },
          status: { type: "string", enum: ["active", "inactive", "suspended"] },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "array" },
          },
        },
      },
    },
    preHandler: [
      authMiddleware.authenticate,
      authMiddleware.requireAdmin,
      userRateLimit,
    ],
    handler: async (
      request: FastifyRequest<{ Querystring: UserQuery }>,
      reply: FastifyReply
    ) => {
      try {
        const { limit = "20", offset = "0", role, status } = request.query;

        const filters = {
          ...(role && { role }),
          ...(status && { status }),
          limit: parseInt(limit),
          offset: parseInt(offset),
        };

        // TODO: Implement with UserService
        // const users = await userService.getUsers(filters);

        // Placeholder response
        const users = [
          {
            id: "user-1",
            email: "user@example.com",
            firstName: "John",
            lastName: "Doe",
            role: "user",
            status: "active",
            createdAt: new Date().toISOString(),
          },
        ];

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(users, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch users";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(message, "FETCH_USERS_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Update user status (admin only)
  fastify.patch<{
    Params: UserParams;
    Body: UpdateUserStatusBody;
  }>("/:id/status", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
      body: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["active", "inactive", "suspended"] },
          reason: { type: "string" },
        },
        required: ["status"],
      },
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
    preHandler: [
      authMiddleware.authenticate,
      authMiddleware.requireAdmin,
      userRateLimit,
    ],
    handler: async (
      request: FastifyRequest<{
        Params: UserParams;
        Body: UpdateUserStatusBody;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { status, reason } = request.body;

        // TODO: Implement with UserService
        // const user = await userService.updateUserStatus(id, status, reason);

        // Placeholder response
        const user = {
          id,
          status,
          reason,
          updatedAt: new Date().toISOString(),
        };

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(user, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to update user status";
        const status = message.includes("not found")
          ? HTTP_STATUS.NOT_FOUND
          : HTTP_STATUS.BAD_REQUEST;

        return reply.status(status).send(
          ResponseBuilder.error(
            message,
            "UPDATE_USER_STATUS_FAILED",
            undefined,
            {
              requestId: (request as any).id,
            }
          )
        );
      }
    },
  });
}

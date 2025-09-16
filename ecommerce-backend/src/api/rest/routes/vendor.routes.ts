/**
 * Vendor REST API routes
 * Fastify-based routes with proper validation and security
 */

import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { VendorService } from "../../../modules/ecommerce/vendors/vendor.service.js";
import { VendorRepository } from "../../../core/repositories/vendor.repository.js";
import { UserRepository } from "../../../core/repositories/user.repository.js";
import { JWTService } from "../../../modules/auth/jwt.service.js";
import { AuthMiddleware } from "../../../shared/middleware/auth.middleware.js";
import {
  RateLimitMiddleware,
  rateLimitConfigs,
} from "../../../shared/middleware/rate-limit.middleware.js";
import { securityMiddleware } from "../../../shared/middleware/security.middleware.js";
import { db } from "../../../core/database/connection.js";
import {
  createVendorSchema,
  updateVendorSchema,
  vendorFiltersSchema,
} from "../../../shared/validators/vendor.validators.js";
import {
  CreateVendorInput,
  UpdateVendorInput,
} from "../../../modules/ecommerce/vendors/vendor.types.js";
import {
  ResponseBuilder,
  HTTP_STATUS,
} from "../../../shared/utils/response.utils.js";

// Interfaces for request/response types
interface VendorParams {
  id: string;
}

interface VendorQuery {
  status?: "pending" | "approved" | "rejected" | "suspended" | "inactive";
  search?: string;
  limit?: string;
  page?: string;
}

interface VendorStatusBody {
  status: "pending" | "approved" | "rejected" | "suspended" | "inactive";
}

interface VendorVerificationBody {
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
}

export async function vendorRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Initialize services
  const jwtService = new JWTService();
  const vendorRepository = new VendorRepository(db);
  const userRepository = new UserRepository(db);
  const vendorService = new VendorService(vendorRepository, userRepository);
  const authMiddleware = new AuthMiddleware(jwtService);
  const rateLimitMiddleware = new RateLimitMiddleware();

  // Apply security middleware to all vendor routes
  fastify.addHook("preHandler", securityMiddleware.securityHeaders());
  fastify.addHook("preHandler", securityMiddleware.sanitizeInput());

  // Apply rate limiting to vendor endpoints
  const vendorRateLimit = rateLimitMiddleware.createRateLimit(
    rateLimitConfigs.api
  );

  // Create vendor
  fastify.post<{
    Body: CreateVendorInput;
  }>("/", {
    schema: {
      body: createVendorSchema,
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
    preHandler: [authMiddleware.authenticate, vendorRateLimit],
    handler: async (
      request: FastifyRequest<{ Body: CreateVendorInput }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = (request.user as any)?.id;
        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        const vendor = await vendorService.createVendor(userId, request.body);

        return reply
          .status(HTTP_STATUS.CREATED)
          .send(
            ResponseBuilder.success(vendor, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create vendor";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(message, "CREATE_VENDOR_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Get vendors with filtering
  fastify.get<{
    Querystring: VendorQuery;
  }>("/", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["pending", "approved", "rejected", "suspended", "inactive"],
          },
          search: { type: "string" },
          limit: { type: "string", default: "20" },
          page: { type: "string", default: "1" },
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
    preHandler: [vendorRateLimit],
    handler: async (
      request: FastifyRequest<{ Querystring: VendorQuery }>,
      reply: FastifyReply
    ) => {
      try {
        const { status, search, limit = "20", page = "1" } = request.query;

        const filters = {
          ...(status && {
            status: status as
              | "pending"
              | "approved"
              | "rejected"
              | "suspended"
              | "inactive",
          }),
          ...(search && { search: search as string }),
          limit: parseInt(limit as string),
          offset: (parseInt(page as string) - 1) * parseInt(limit as string),
        };

        const vendors = await vendorService.searchVendors(filters);

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(vendors, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch vendors";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(message, "FETCH_VENDORS_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Get vendor statistics
  fastify.get("/stats", {
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
    preHandler: [authMiddleware.authenticate, vendorRateLimit],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const statistics = await vendorService.getVendorStatistics();

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(statistics, {
              requestId: (request as any).id,
            })
          );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to fetch vendor statistics";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(message, "FETCH_STATISTICS_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Get single vendor
  fastify.get<{
    Params: VendorParams;
  }>("/:id", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
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
    preHandler: [vendorRateLimit],
    handler: async (
      request: FastifyRequest<{ Params: VendorParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const vendor = await vendorService.getVendor(id);

        if (!vendor) {
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send(
              ResponseBuilder.error(
                "Vendor not found",
                "VENDOR_NOT_FOUND",
                undefined,
                { requestId: (request as any).id }
              )
            );
        }

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(vendor, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch vendor";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(message, "FETCH_VENDOR_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Update vendor
  fastify.put<{
    Params: VendorParams;
    Body: UpdateVendorInput;
  }>("/:id", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
      body: updateVendorSchema,
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
    preHandler: [authMiddleware.authenticate, vendorRateLimit],
    handler: async (
      request: FastifyRequest<{
        Params: VendorParams;
        Body: UpdateVendorInput;
      }>,
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

        const vendor = await vendorService.updateVendor(
          id,
          userId,
          request.body
        );

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(vendor, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update vendor";
        const status = message.includes("not found")
          ? HTTP_STATUS.NOT_FOUND
          : message.includes("Not authorized")
          ? HTTP_STATUS.FORBIDDEN
          : HTTP_STATUS.BAD_REQUEST;

        return reply.status(status).send(
          ResponseBuilder.error(message, "UPDATE_VENDOR_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Update vendor status
  fastify.patch<{
    Params: VendorParams;
    Body: VendorStatusBody;
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
          status: {
            type: "string",
            enum: ["pending", "approved", "rejected", "suspended", "inactive"],
          },
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
      authMiddleware.requireRole(["admin"]),
      vendorRateLimit,
    ],
    handler: async (
      request: FastifyRequest<{ Params: VendorParams; Body: VendorStatusBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { status } = request.body;

        let vendor;
        switch (status) {
          case "approved":
            vendor = await vendorService.approveVendor(id);
            break;
          case "rejected":
            vendor = await vendorService.rejectVendor(id);
            break;
          case "suspended":
            vendor = await vendorService.suspendVendor(id);
            break;
          default:
            throw new Error("Status update not implemented");
        }

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(vendor, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to update vendor status";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(message, "UPDATE_STATUS_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Update verification status
  fastify.patch<{
    Params: VendorParams;
    Body: VendorVerificationBody;
  }>("/:id/verification", {
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
          verificationStatus: {
            type: "string",
            enum: ["unverified", "pending", "verified", "rejected"],
          },
        },
        required: ["verificationStatus"],
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
      authMiddleware.requireRole(["admin"]),
      vendorRateLimit,
    ],
    handler: async (
      request: FastifyRequest<{
        Params: VendorParams;
        Body: VendorVerificationBody;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { verificationStatus } = request.body;

        const vendor = await vendorService.updateVerificationStatus(
          id,
          verificationStatus
        );

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(vendor, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to update verification status";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(
            message,
            "UPDATE_VERIFICATION_FAILED",
            undefined,
            {
              requestId: (request as any).id,
            }
          )
        );
      }
    },
  });

  // Get vendor stats (specific vendor)
  fastify.get<{
    Params: VendorParams;
  }>("/:id/stats", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
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
    preHandler: [authMiddleware.authenticate, vendorRateLimit],
    handler: async (
      request: FastifyRequest<{ Params: VendorParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const stats = await vendorService.getVendorStats(id);

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(stats, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to fetch vendor stats";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(
            message,
            "FETCH_VENDOR_STATS_FAILED",
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

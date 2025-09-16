/**
 * REST API main plugin
 * Combines all route plugins with versioning for Fastify
 */

import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { authRoutes } from "./routes/auth.routes.js";
import { userRoutes } from "./routes/user.routes.js";
import { vendorRoutes } from "./routes/vendor.routes.js";
import { productRoutes } from "./routes/product.routes.js";
import { orderRoutes } from "./routes/order.routes.js";
import { healthRoutes } from "./routes/health.routes.js";
import { notificationRoutes } from "./routes/notification.routes.js";
import {
  ResponseBuilder,
  HTTP_STATUS,
} from "../../shared/utils/response.utils.js";

export async function restApiPlugin(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Add common security headers to all routes
  fastify.addHook("onSend", async (request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("X-XSS-Protection", "1; mode=block");
    reply.header("X-API-Version", "v1");
    return payload;
  });

  // API info endpoint
  fastify.get("/", {
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
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const baseUrl = `${request.protocol}://${request.hostname}/api/v1`;

      return reply.status(HTTP_STATUS.OK).send(
        ResponseBuilder.success(
          {
            name: "E-commerce REST API",
            version: "v1",
            description:
              "Modern e-commerce backend API with clean architecture",
            documentation: `${baseUrl}/docs`,
            endpoints: {
              health: `${baseUrl}/health`,
              auth: `${baseUrl}/auth`,
              users: `${baseUrl}/users`,
              vendors: `${baseUrl}/vendors`,
              products: `${baseUrl}/products`,
              orders: `${baseUrl}/orders`,
              notifications: `${baseUrl}/notifications`,
            },
            features: [
              "JWT Authentication",
              "Role-based Access Control",
              "Request/Response Logging",
              "API Versioning",
              "Standardized Error Handling",
              "Performance Monitoring",
              "Real-time Notifications",
              "Rate Limiting",
              "Input Validation",
            ],
          },
          {
            requestId: (request as any).id,
          }
        )
      );
    },
  });

  // Register route plugins with prefixes
  await fastify.register(authRoutes, { prefix: "/auth" });
  await fastify.register(userRoutes, { prefix: "/users" });
  await fastify.register(vendorRoutes, { prefix: "/vendors" });
  await fastify.register(productRoutes, { prefix: "/products" });
  await fastify.register(orderRoutes, { prefix: "/orders" });
  await fastify.register(healthRoutes, { prefix: "/health" });
  await fastify.register(notificationRoutes, { prefix: "/notifications" });

  // 404 handler for unmatched routes
  fastify.setNotFoundHandler(
    {
      preHandler: fastify.rateLimit({
        max: 10,
        timeWindow: "1 minute",
      }),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return reply
        .status(HTTP_STATUS.NOT_FOUND)
        .send(
          ResponseBuilder.error(
            `Route ${request.method} ${request.url} not found`,
            "ROUTE_NOT_FOUND",
            undefined,
            { requestId: (request as any).id }
          )
        );
    }
  );

  // Global error handler
  fastify.setErrorHandler(async (error, request, reply) => {
    // Log the error
    fastify.log.error(
      {
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
        requestId: (request as any).id,
      },
      "REST API Error"
    );

    // Determine status code based on error type
    let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    let errorCode = "INTERNAL_ERROR";

    if (error.name === "ValidationError" || error.statusCode === 400) {
      statusCode = HTTP_STATUS.BAD_REQUEST;
      errorCode = "VALIDATION_ERROR";
    } else if (error.statusCode === 401) {
      statusCode = HTTP_STATUS.UNAUTHORIZED;
      errorCode = "UNAUTHORIZED";
    } else if (error.statusCode === 403) {
      statusCode = HTTP_STATUS.FORBIDDEN;
      errorCode = "FORBIDDEN";
    } else if (error.statusCode === 404) {
      statusCode = HTTP_STATUS.NOT_FOUND;
      errorCode = "NOT_FOUND";
    } else if (error.statusCode === 429) {
      statusCode = HTTP_STATUS.TOO_MANY_REQUESTS;
      errorCode = "RATE_LIMIT_EXCEEDED";
    }

    return reply
      .status(statusCode)
      .send(
        ResponseBuilder.error(
          error.message || "Internal server error",
          errorCode,
          process.env.NODE_ENV === "development" ? error.stack : undefined,
          { requestId: (request as any).id }
        )
      );
  });
}

// Factory function for creating REST API plugin
export const createRestApiPlugin = () => {
  return restApiPlugin;
};

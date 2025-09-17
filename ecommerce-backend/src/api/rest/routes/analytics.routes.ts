/**
 * Analytics REST API routes
 * Fastify-based routes for analytics functionality
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { AnalyticsController } from "../../../modules/analytics/analytics.controller.js";
import { AnalyticsService } from "../../../modules/analytics/analytics.service.js";
import { AnalyticsRepository } from "../../../core/repositories/analytics.repository.js";
import { AuthMiddleware } from "../../../shared/middleware/auth.middleware.js";
import {
  RateLimitMiddleware,
  rateLimitConfigs,
} from "../../../shared/middleware/rate-limit.middleware.js";
import { securityMiddleware } from "../../../shared/middleware/security.middleware.js";
import { db } from "../../../core/database/connection.js";
import { JWTService } from "../../../modules/auth/jwt.service.js";

export async function analyticsRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Initialize services
  const jwtService = new JWTService();
  const analyticsRepository = new AnalyticsRepository(db);
  const analyticsService = new AnalyticsService(analyticsRepository);
  const analyticsController = new AnalyticsController(analyticsService);
  const authMiddleware = new AuthMiddleware(jwtService);
  const rateLimitMiddleware = new RateLimitMiddleware();

  // Apply security middleware to all analytics routes
  fastify.addHook("preHandler", securityMiddleware.securityHeaders());
  fastify.addHook("preHandler", securityMiddleware.sanitizeInput());

  // Apply rate limiting to analytics endpoints
  const analyticsRateLimit = rateLimitMiddleware.createRateLimit(
    rateLimitConfigs.api
  );

  // Authentication required for all analytics routes
  fastify.addHook("preHandler", authMiddleware.authenticate);

  // Analytics Events
  fastify.post("/events", {
    preHandler: [analyticsRateLimit],
    schema: {
      body: {
        type: "object",
        properties: {
          eventType: { type: "string" },
          userId: { type: "string" },
          sessionId: { type: "string" },
          eventData: { type: "object" },
          metadata: { type: "object" },
        },
        required: ["eventType"],
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
    handler: analyticsController.trackEvent.bind(analyticsController),
  });

  fastify.get("/events", {
    preHandler: [analyticsRateLimit],
    schema: {
      querystring: {
        type: "object",
        properties: {
          eventType: { type: "string" },
          userId: { type: "string" },
          sessionId: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          limit: { type: "number", default: 100 },
          offset: { type: "number", default: 0 },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                events: { type: "array" },
                count: { type: "number" },
              },
            },
          },
        },
      },
    },
    handler: analyticsController.getEvents.bind(analyticsController),
  });

  // Business Metrics
  fastify.post("/metrics", {
    preHandler: [analyticsRateLimit],
    schema: {
      body: {
        type: "object",
        properties: {
          metricType: { type: "string" },
          metricValue: { type: "number" },
          dimensions: { type: "object" },
          metadata: { type: "object" },
        },
        required: ["metricType", "metricValue"],
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
    handler: analyticsController.recordBusinessMetric.bind(analyticsController),
  });

  fastify.get("/metrics", {
    preHandler: [analyticsRateLimit],
    schema: {
      querystring: {
        type: "object",
        properties: {
          metricType: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          aggregation: {
            type: "string",
            enum: ["sum", "avg", "count", "min", "max"],
          },
          groupBy: { type: "string" },
          limit: { type: "number", default: 100 },
          offset: { type: "number", default: 0 },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                metrics: { type: "array" },
                count: { type: "number" },
              },
            },
          },
        },
      },
    },
    handler: analyticsController.getBusinessMetrics.bind(analyticsController),
  });

  // User Behavior Analytics
  fastify.post("/user-behavior", {
    preHandler: [analyticsRateLimit],
    schema: {
      body: {
        type: "object",
        properties: {
          userId: { type: "string" },
          sessionId: { type: "string" },
          page: { type: "string" },
          action: { type: "string" },
          elementId: { type: "string" },
          behaviorData: { type: "object" },
          metadata: { type: "object" },
        },
        required: ["userId", "action"],
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
    handler: analyticsController.getUserBehaviorStats.bind(analyticsController),
  });

  fastify.get("/user-behavior", {
    preHandler: [analyticsRateLimit],
    schema: {
      querystring: {
        type: "object",
        properties: {
          userId: { type: "string" },
          sessionId: { type: "string" },
          page: { type: "string" },
          action: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          limit: { type: "number", default: 100 },
          offset: { type: "number", default: 0 },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                behaviors: { type: "array" },
                count: { type: "number" },
              },
            },
          },
        },
      },
    },
    handler: analyticsController.getUserEvents.bind(analyticsController),
  });

  // Product Analytics
  fastify.post("/product-analytics", {
    preHandler: [analyticsRateLimit],
    schema: {
      body: {
        type: "object",
        properties: {
          productId: { type: "string" },
          action: { type: "string" },
          userId: { type: "string" },
          quantity: { type: "number" },
          revenue: { type: "number" },
          categoryId: { type: "string" },
          vendorId: { type: "string" },
          analyticsData: { type: "object" },
          metadata: { type: "object" },
        },
        required: ["productId", "action"],
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
    handler: analyticsController.getProductAnalytics.bind(analyticsController),
  });

  fastify.get("/product-analytics", {
    preHandler: [analyticsRateLimit],
    schema: {
      querystring: {
        type: "object",
        properties: {
          productId: { type: "string" },
          action: { type: "string" },
          userId: { type: "string" },
          categoryId: { type: "string" },
          vendorId: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          limit: { type: "number", default: 100 },
          offset: { type: "number", default: 0 },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                analytics: { type: "array" },
                count: { type: "number" },
              },
            },
          },
        },
      },
    },
    handler: analyticsController.getProductAnalytics.bind(analyticsController),
  });

  // Dashboard and Reports
  fastify.get("/dashboard", {
    preHandler: [analyticsRateLimit],
    schema: {
      querystring: {
        type: "object",
        properties: {
          dateRange: {
            type: "string",
            enum: ["today", "week", "month", "quarter", "year"],
          },
          vendorId: { type: "string" },
          categoryId: { type: "string" },
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
    handler: analyticsController.getDashboardData.bind(analyticsController),
  });

  fastify.get("/reports/user-engagement", {
    preHandler: [analyticsRateLimit],
    schema: {
      querystring: {
        type: "object",
        properties: {
          dateRange: { type: "string" },
          groupBy: { type: "string", enum: ["day", "week", "month"] },
          limit: { type: "number", default: 100 },
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
    handler: analyticsController.getUserBehaviorStats.bind(analyticsController),
  });

  fastify.get("/reports/product-performance", {
    preHandler: [analyticsRateLimit],
    schema: {
      querystring: {
        type: "object",
        properties: {
          dateRange: { type: "string" },
          groupBy: { type: "string", enum: ["day", "week", "month"] },
          vendorId: { type: "string" },
          categoryId: { type: "string" },
          limit: { type: "number", default: 100 },
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
    handler:
      analyticsController.getTopPerformingProducts.bind(analyticsController),
  });

  fastify.get("/reports/business-metrics", {
    preHandler: [analyticsRateLimit],
    schema: {
      querystring: {
        type: "object",
        properties: {
          dateRange: { type: "string" },
          groupBy: { type: "string", enum: ["day", "week", "month"] },
          metricTypes: { type: "string" },
          limit: { type: "number", default: 100 },
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
    handler: analyticsController.getBusinessMetrics.bind(analyticsController),
  });
}

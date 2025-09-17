/**
 * Webhook REST API routes
 * Fastify-based routes for webhook management and event delivery
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { WebhookController } from "../../../modules/webhook/webhook.controller.js";
import { WebhookService } from "../../../modules/webhook/webhook.service.js";
import { WebhookRepository } from "../../../core/repositories/webhook.repository.js";
import { AuthMiddleware } from "../../../shared/middleware/auth.middleware.js";
import {
  RateLimitMiddleware,
  rateLimitConfigs,
} from "../../../shared/middleware/rate-limit.middleware.js";
import { securityMiddleware } from "../../../shared/middleware/security.middleware.js";
import { db } from "../../../core/database/connection.js";
import { JWTService } from "../../../modules/auth/jwt.service.js";

export async function webhookRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Initialize services
  const jwtService = new JWTService();
  const webhookRepository = new WebhookRepository(db);
  const webhookService = new WebhookService(webhookRepository);
  const webhookController = new WebhookController(webhookService);
  const authMiddleware = new AuthMiddleware(jwtService);
  const rateLimitMiddleware = new RateLimitMiddleware();

  // Apply security middleware to all webhook routes
  fastify.addHook("preHandler", securityMiddleware.securityHeaders());
  fastify.addHook("preHandler", securityMiddleware.sanitizeInput());

  // Apply rate limiting to webhook endpoints
  const webhookRateLimit = rateLimitMiddleware.createRateLimit(
    rateLimitConfigs.api
  );

  // Authentication required for most webhook routes
  fastify.addHook("preHandler", authMiddleware.authenticate);

  // Webhook Endpoints Management
  fastify.post("/endpoints", {
    preHandler: [webhookRateLimit],
    schema: {
      body: {
        type: "object",
        properties: {
          url: { type: "string", format: "uri" },
          eventTypes: {
            type: "array",
            items: { type: "string" },
          },
          isActive: { type: "boolean", default: true },
          secret: { type: "string" },
          headers: { type: "object" },
          timeoutMs: { type: "number", default: 30000 },
          retryCount: { type: "number", default: 3 },
          vendorId: { type: "string" },
        },
        required: ["url", "eventTypes"],
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
    handler: webhookController.createEndpoint.bind(webhookController),
  });

  fastify.get("/endpoints", {
    preHandler: [webhookRateLimit],
    schema: {
      querystring: {
        type: "object",
        properties: {
          status: { type: "string" },
          eventTypes: { type: "string" },
          isActive: { type: "boolean" },
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
                endpoints: { type: "array" },
                count: { type: "number" },
              },
            },
          },
        },
      },
    },
    handler: webhookController.getEndpoints.bind(webhookController),
  });

  fastify.get("/endpoints/:id", {
    preHandler: [webhookRateLimit],
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
    handler: webhookController.getEndpointById.bind(webhookController),
  });

  fastify.put("/endpoints/:id", {
    preHandler: [webhookRateLimit],
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
          url: { type: "string", format: "uri" },
          eventTypes: {
            type: "array",
            items: { type: "string" },
          },
          isActive: { type: "boolean" },
          secret: { type: "string" },
          headers: { type: "object" },
          timeoutMs: { type: "number" },
          retryCount: { type: "number" },
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
    handler: webhookController.updateEndpoint.bind(webhookController),
  });

  fastify.delete("/endpoints/:id", {
    preHandler: [webhookRateLimit],
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
    handler: webhookController.deleteEndpoint.bind(webhookController),
  });

  fastify.post("/endpoints/:id/test", {
    preHandler: [webhookRateLimit],
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
    handler: webhookController.testEndpoint.bind(webhookController),
  });

  // Webhook Events
  fastify.post("/events", {
    preHandler: [webhookRateLimit],
    schema: {
      body: {
        type: "object",
        properties: {
          eventType: { type: "string" },
          sourceType: { type: "string" },
          sourceId: { type: "string" },
          eventData: { type: "object" },
          userId: { type: "string" },
          vendorId: { type: "string" },
          metadata: { type: "object" },
        },
        required: ["eventType", "sourceType", "sourceId", "eventData"],
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
    handler: webhookController.dispatchEvent.bind(webhookController),
  });

  fastify.get("/events", {
    preHandler: [webhookRateLimit],
    schema: {
      querystring: {
        type: "object",
        properties: {
          eventType: { type: "string" },
          sourceType: { type: "string" },
          isProcessed: { type: "boolean" },
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
    handler: webhookController.getEvents.bind(webhookController),
  });

  // Webhook Deliveries
  fastify.get("/deliveries", {
    preHandler: [webhookRateLimit],
    schema: {
      querystring: {
        type: "object",
        properties: {
          webhookEndpointId: { type: "string" },
          deliveryStatus: { type: "string" },
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
                deliveries: { type: "array" },
                count: { type: "number" },
              },
            },
          },
        },
      },
    },
    handler: webhookController.getDeliveries.bind(webhookController),
  });

  fastify.post("/deliveries/:deliveryId/retry", {
    preHandler: [webhookRateLimit],
    schema: {
      params: {
        type: "object",
        properties: {
          deliveryId: { type: "string" },
        },
        required: ["deliveryId"],
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
    handler: webhookController.retryDelivery.bind(webhookController),
  });

  // Webhook Logs
  fastify.get("/endpoints/:id/logs", {
    preHandler: [webhookRateLimit],
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
      querystring: {
        type: "object",
        properties: {
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
                logs: { type: "array" },
                count: { type: "number" },
              },
            },
          },
        },
      },
    },
    handler: webhookController.getEndpointLogs.bind(webhookController),
  });

  // Admin-only endpoints
  fastify.get("/stats", {
    preHandler: [webhookRateLimit],
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
    handler: webhookController.getWebhookStats.bind(webhookController),
  });

  fastify.post("/cleanup", {
    preHandler: [webhookRateLimit],
    schema: {
      body: {
        type: "object",
        properties: {
          retentionDays: { type: "number", default: 90 },
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
    handler: webhookController.cleanupOldData.bind(webhookController),
  });
}

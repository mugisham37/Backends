/**
 * Payment REST API routes
 * Comprehensive payment management endpoints with proper authentication and security
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { createPaymentController } from "../../../modules/ecommerce/payments/payment.controller.js";
import { AuthMiddleware } from "../../../shared/middleware/auth.middleware.js";
import {
  RateLimitMiddleware,
  rateLimitConfigs,
} from "../../../shared/middleware/rate-limit.middleware.js";
import { securityMiddleware } from "../../../shared/middleware/security.middleware.js";
import { JWTService } from "../../../modules/auth/jwt.service.js";
import {
  createPaymentSchema,
  processPaymentSchema,
  refundPaymentSchema,
  paymentFiltersSchema,
} from "../../../modules/ecommerce/payments/payment.validators.js";

export async function paymentRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Initialize services and controllers
  const paymentController = createPaymentController();
  const jwtService = new JWTService();
  const authMiddleware = new AuthMiddleware(jwtService);
  const rateLimitMiddleware = new RateLimitMiddleware();

  // Apply security middleware to all payment routes
  fastify.addHook("preHandler", securityMiddleware.securityHeaders());
  fastify.addHook("preHandler", securityMiddleware.sanitizeInput());

  // Rate limiting for payment operations
  const paymentRateLimit = rateLimitMiddleware.createRateLimit({
    max: 50,
    window: 15 * 60 * 1000, // 15 minutes in milliseconds
    message: "Too many payment requests, please try again later.",
  });

  const webhookRateLimit = rateLimitMiddleware.createRateLimit({
    max: 1000,
    window: 5 * 60 * 1000, // 5 minutes in milliseconds
    keyGenerator: (request) =>
      (request.headers["x-forwarded-for"] as string) || request.ip || "unknown",
  });

  // ========== PUBLIC ROUTES ==========

  // Get available payment methods (no auth required)
  fastify.get("/methods", {
    schema: {
      tags: ["Payments"],
      summary: "Get available payment methods",
      description:
        "Retrieve list of available payment methods and their configurations",
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  method: { type: "string" },
                  provider: { type: "string" },
                  name: { type: "string" },
                  description: { type: "string" },
                  isEnabled: { type: "boolean" },
                  supportedCurrencies: {
                    type: "array",
                    items: { type: "string" },
                  },
                  fees: {
                    type: "object",
                    properties: {
                      fixedFee: { type: "number" },
                      percentageFee: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    preHandler: [paymentRateLimit],
    handler: paymentController.getPaymentMethods.bind(paymentController),
  });

  // Webhook endpoint for payment providers (no auth, but signature verification)
  fastify.post("/webhooks/:provider", {
    schema: {
      tags: ["Payments"],
      summary: "Handle payment provider webhooks",
      description: "Process webhook events from payment providers",
      params: {
        type: "object",
        properties: {
          provider: {
            type: "string",
            enum: ["stripe", "paypal", "square"],
          },
        },
        required: ["provider"],
      },
      headers: {
        type: "object",
        properties: {
          "x-webhook-signature": { type: "string" },
        },
        required: ["x-webhook-signature"],
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
    preHandler: [webhookRateLimit],
    handler: paymentController.handleWebhook.bind(paymentController),
  });

  // ========== AUTHENTICATED ROUTES ==========

  // Create payment intent (authenticated)
  fastify.post("/intents", {
    schema: {
      tags: ["Payments"],
      summary: "Create payment intent",
      description: "Create a payment intent with the payment provider",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        properties: {
          amount: { type: "number", minimum: 0.5 },
          currency: { type: "string", minLength: 3, maxLength: 3 },
          orderId: { type: "string", format: "uuid" },
          paymentMethod: {
            type: "string",
            enum: ["stripe", "paypal", "square"],
          },
          returnUrl: { type: "string", format: "uri" },
          metadata: { type: "object" },
        },
        required: ["amount", "currency", "orderId", "paymentMethod"],
        additionalProperties: false,
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
                paymentIntentId: { type: "string" },
                clientSecret: { type: "string" },
                status: { type: "string" },
              },
            },
          },
        },
      },
    },
    preHandler: [paymentRateLimit, authMiddleware.authenticate],
    handler: paymentController.createPaymentIntent.bind(paymentController),
  });

  // Create payment (authenticated)
  fastify.post("/", {
    schema: {
      tags: ["Payments"],
      summary: "Create payment",
      description: "Create a new payment record for an order",
      security: [{ bearerAuth: [] }],
      body: createPaymentSchema,
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                orderId: { type: "string" },
                paymentNumber: { type: "string" },
                method: { type: "string" },
                provider: { type: "string" },
                status: { type: "string" },
                amount: { type: "string" },
                currency: { type: "string" },
                createdAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
    },
    preHandler: [paymentRateLimit, authMiddleware.authenticate],
    handler: paymentController.createPayment.bind(paymentController),
  });

  // Process payment (authenticated)
  fastify.post("/process", {
    schema: {
      tags: ["Payments"],
      summary: "Process payment",
      description: "Process a payment using the configured payment provider",
      security: [{ bearerAuth: [] }],
      body: processPaymentSchema,
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                status: { type: "string" },
                processedAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
    },
    preHandler: [paymentRateLimit, authMiddleware.authenticate],
    handler: paymentController.processPayment.bind(paymentController),
  });

  // Refund payment (authenticated, admin only)
  fastify.post("/refunds", {
    schema: {
      tags: ["Payments"],
      summary: "Refund payment",
      description: "Process a refund for a payment",
      security: [{ bearerAuth: [] }],
      body: refundPaymentSchema,
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                paymentId: { type: "string" },
                amount: { type: "string" },
                status: { type: "string" },
                processedAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
      },
    },
    preHandler: [
      paymentRateLimit,
      authMiddleware.authenticate,
      authMiddleware.requireRole(["admin", "moderator"]),
    ],
    handler: paymentController.refundPayment.bind(paymentController),
  });

  // Get payment by ID (authenticated)
  fastify.get("/:id", {
    schema: {
      tags: ["Payments"],
      summary: "Get payment by ID",
      description: "Retrieve a specific payment by its ID",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
        },
        required: ["id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                orderId: { type: "string" },
                paymentNumber: { type: "string" },
                method: { type: "string" },
                provider: { type: "string" },
                status: { type: "string" },
                amount: { type: "string" },
                currency: { type: "string" },
                createdAt: { type: "string", format: "date-time" },
                updatedAt: { type: "string", format: "date-time" },
              },
            },
          },
        },
        404: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
    preHandler: [paymentRateLimit, authMiddleware.authenticate],
    handler: paymentController.getPayment.bind(paymentController),
  });

  // Get payments by order ID (authenticated)
  fastify.get("/order/:orderId", {
    schema: {
      tags: ["Payments"],
      summary: "Get payments by order",
      description: "Retrieve all payments for a specific order",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        properties: {
          orderId: { type: "string", format: "uuid" },
        },
        required: ["orderId"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  orderId: { type: "string" },
                  paymentNumber: { type: "string" },
                  method: { type: "string" },
                  provider: { type: "string" },
                  status: { type: "string" },
                  amount: { type: "string" },
                  currency: { type: "string" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
      },
    },
    preHandler: [paymentRateLimit, authMiddleware.authenticate],
    handler: paymentController.getPaymentsByOrder.bind(paymentController),
  });

  // List payments with filters (authenticated)
  fastify.get("/", {
    schema: {
      tags: ["Payments"],
      summary: "List payments",
      description: "Retrieve payments with optional filters and pagination",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1, default: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          sortBy: {
            type: "string",
            enum: ["createdAt", "updatedAt", "amount", "status"],
            default: "createdAt",
          },
          sortOrder: { type: "string", enum: ["asc", "desc"], default: "desc" },
          orderId: { type: "string", format: "uuid" },
          status: {
            type: "string",
            enum: [
              "pending",
              "processing",
              "succeeded",
              "failed",
              "cancelled",
              "refunded",
              "partially_refunded",
              "disputed",
              "requires_action",
              "requires_confirmation",
            ],
          },
          method: {
            type: "string",
            enum: [
              "stripe",
              "paypal",
              "square",
              "bank_transfer",
              "cash_on_delivery",
              "store_credit",
              "gift_card",
              "cryptocurrency",
              "apple_pay",
              "google_pay",
              "klarna",
              "afterpay",
            ],
          },
          provider: {
            type: "string",
            enum: [
              "stripe",
              "paypal",
              "square",
              "braintree",
              "adyen",
              "authorize_net",
              "coinbase",
              "internal",
            ],
          },
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
          amountMin: { type: "number", minimum: 0 },
          amountMax: { type: "number", minimum: 0 },
          searchTerm: { type: "string", minLength: 1, maxLength: 100 },
        },
        additionalProperties: false,
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  orderId: { type: "string" },
                  paymentNumber: { type: "string" },
                  method: { type: "string" },
                  provider: { type: "string" },
                  status: { type: "string" },
                  amount: { type: "string" },
                  currency: { type: "string" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
            pagination: {
              type: "object",
              properties: {
                total: { type: "integer" },
                page: { type: "integer" },
                limit: { type: "integer" },
                totalPages: { type: "integer" },
              },
            },
          },
        },
      },
    },
    preHandler: [paymentRateLimit, authMiddleware.authenticate],
    handler: paymentController.listPayments.bind(paymentController),
  });

  // Get payment analytics (authenticated, admin only)
  fastify.get("/analytics", {
    schema: {
      tags: ["Payments"],
      summary: "Get payment analytics",
      description: "Retrieve comprehensive payment analytics and statistics",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          dateFrom: { type: "string", format: "date" },
          dateTo: { type: "string", format: "date" },
          status: { type: "string" },
          method: { type: "string" },
          provider: { type: "string" },
        },
        additionalProperties: false,
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                stats: {
                  type: "object",
                  properties: {
                    totalPayments: { type: "integer" },
                    totalAmount: { type: "string" },
                    successfulPayments: { type: "integer" },
                    failedPayments: { type: "integer" },
                    pendingPayments: { type: "integer" },
                    averageAmount: { type: "string" },
                  },
                },
                methodBreakdown: { type: "array" },
                providerBreakdown: { type: "array" },
                dailyTrends: { type: "array" },
              },
            },
          },
        },
      },
    },
    preHandler: [
      paymentRateLimit,
      authMiddleware.authenticate,
      authMiddleware.requireRole(["admin", "moderator"]),
    ],
    handler: paymentController.getPaymentAnalytics.bind(paymentController),
  });
}

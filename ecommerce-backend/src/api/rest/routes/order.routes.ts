/**
 * Order REST API routes
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
interface OrderParams {
  id: string;
}

interface OrderQuery {
  status?: string;
  vendorId?: string;
  startDate?: string;
  endDate?: string;
  limit?: string;
  page?: string;
}

interface CreateOrderBody {
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  paymentMethod: string;
}

interface UpdateOrderStatusBody {
  status:
    | "pending"
    | "confirmed"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled";
  notes?: string;
}

interface CancelOrderBody {
  reason?: string;
}

interface RefundOrderBody {
  amount: number;
  reason?: string;
}

export async function orderRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Initialize services
  const jwtService = new JWTService();
  const authMiddleware = new AuthMiddleware(jwtService);
  const rateLimitMiddleware = new RateLimitMiddleware();

  // Apply security middleware to all order routes
  fastify.addHook("preHandler", securityMiddleware.securityHeaders());
  fastify.addHook("preHandler", securityMiddleware.sanitizeInput());

  // Apply rate limiting to order endpoints
  const orderRateLimit = rateLimitMiddleware.createRateLimit(
    rateLimitConfigs.api
  );

  // Create order
  fastify.post<{
    Body: CreateOrderBody;
  }>("/", {
    schema: {
      body: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                productId: { type: "string" },
                quantity: { type: "number", minimum: 1 },
                price: { type: "number", minimum: 0 },
              },
              required: ["productId", "quantity", "price"],
            },
            minItems: 1,
          },
          shippingAddress: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
              state: { type: "string" },
              postalCode: { type: "string" },
              country: { type: "string" },
            },
            required: ["street", "city", "state", "postalCode", "country"],
          },
          paymentMethod: { type: "string" },
        },
        required: ["items", "shippingAddress", "paymentMethod"],
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
    preHandler: [authMiddleware.authenticate, orderRateLimit],
    handler: async (
      request: FastifyRequest<{ Body: CreateOrderBody }>,
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

        const { items, shippingAddress, paymentMethod } = request.body;

        // TODO: Implement with OrderService
        // const order = await orderService.createOrder(userId, request.body);

        // Placeholder response
        const order = {
          id: "order-123",
          userId,
          items,
          shippingAddress,
          paymentMethod,
          total: items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          ),
          status: "pending",
          createdAt: new Date().toISOString(),
        };

        return reply
          .status(HTTP_STATUS.CREATED)
          .send(
            ResponseBuilder.success(order, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create order";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(message, "CREATE_ORDER_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Get orders with filtering and pagination
  fastify.get<{
    Querystring: OrderQuery;
  }>("/", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: [
              "pending",
              "confirmed",
              "processing",
              "shipped",
              "delivered",
              "cancelled",
            ],
          },
          vendorId: { type: "string" },
          startDate: { type: "string", format: "date-time" },
          endDate: { type: "string", format: "date-time" },
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
    preHandler: [authMiddleware.authenticate, orderRateLimit],
    handler: async (
      request: FastifyRequest<{ Querystring: OrderQuery }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = (request.user as any)?.id;
        const userRole = (request.user as any)?.role;
        const isAdmin = userRole === "admin";

        const {
          status,
          vendorId,
          startDate,
          endDate,
          limit = "20",
          page = "1",
        } = request.query;

        // Non-admin users can only see their own orders
        const filters = {
          ...(userId && !isAdmin && { userId }),
          ...(status && { status }),
          ...(vendorId && { vendorId }),
          ...(startDate && { startDate: new Date(startDate) }),
          ...(endDate && { endDate: new Date(endDate) }),
          limit: parseInt(limit),
          offset: (parseInt(page) - 1) * parseInt(limit),
        };

        // TODO: Implement with OrderService
        // const orders = await orderService.searchOrders(filters);

        // Placeholder response
        const orders = [
          {
            id: "order-123",
            userId: userId || "user-123",
            total: 99.99,
            status: "pending",
            createdAt: new Date().toISOString(),
          },
        ];

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(orders, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch orders";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(message, "FETCH_ORDERS_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Get order statistics
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
    preHandler: [authMiddleware.authenticate, orderRateLimit],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userRole = (request.user as any)?.role;
        const vendorId = (request.user as any)?.vendorId;
        const isAdmin = userRole === "admin";

        if (!isAdmin && !vendorId) {
          return reply
            .status(HTTP_STATUS.FORBIDDEN)
            .send(
              ResponseBuilder.error(
                "Admin or vendor access required",
                "ACCESS_DENIED"
              )
            );
        }

        // TODO: Implement with OrderService
        // const statistics = await orderService.getOrderStatistics(vendorId);

        // Placeholder response
        const statistics = {
          totalOrders: 150,
          pendingOrders: 12,
          completedOrders: 120,
          cancelledOrders: 18,
          totalRevenue: 15000.5,
          averageOrderValue: 100.0,
        };

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
            : "Failed to fetch order statistics";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(message, "FETCH_STATISTICS_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Get single order
  fastify.get<{
    Params: OrderParams;
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
    preHandler: [authMiddleware.authenticate, orderRateLimit],
    handler: async (
      request: FastifyRequest<{ Params: OrderParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const userId = (request.user as any)?.id;
        const userRole = (request.user as any)?.role;
        const isAdmin = userRole === "admin";

        // TODO: Implement with OrderService
        // const order = await orderService.getOrder(id);

        // Placeholder response
        const order = {
          id,
          userId: "user-123",
          total: 99.99,
          status: "pending",
          createdAt: new Date().toISOString(),
        };

        if (!order) {
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send(
              ResponseBuilder.error(
                "Order not found",
                "ORDER_NOT_FOUND",
                undefined,
                { requestId: (request as any).id }
              )
            );
        }

        if (!isAdmin && order.userId !== userId) {
          return reply
            .status(HTTP_STATUS.FORBIDDEN)
            .send(
              ResponseBuilder.error(
                "Not authorized to view this order",
                "FORBIDDEN"
              )
            );
        }

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(order, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch order";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(message, "FETCH_ORDER_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Update order status
  fastify.patch<{
    Params: OrderParams;
    Body: UpdateOrderStatusBody;
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
            enum: [
              "pending",
              "confirmed",
              "processing",
              "shipped",
              "delivered",
              "cancelled",
            ],
          },
          notes: { type: "string" },
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
    preHandler: [authMiddleware.authenticate, orderRateLimit],
    handler: async (
      request: FastifyRequest<{
        Params: OrderParams;
        Body: UpdateOrderStatusBody;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { status, notes } = request.body;
        const userRole = (request.user as any)?.role;
        const isAdmin = userRole === "admin";
        const isVendor = userRole === "vendor";

        if (!isAdmin && !isVendor) {
          return reply
            .status(HTTP_STATUS.FORBIDDEN)
            .send(
              ResponseBuilder.error(
                "Not authorized to update order status",
                "FORBIDDEN"
              )
            );
        }

        // TODO: Implement with OrderService
        // const order = await orderService.updateOrderStatus(id, status, notes);

        // Placeholder response
        const order = {
          id,
          status,
          notes,
          updatedAt: new Date().toISOString(),
        };

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(order, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to update order status";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(message, "UPDATE_STATUS_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Cancel order
  fastify.post<{
    Params: OrderParams;
    Body: CancelOrderBody;
  }>("/:id/cancel", {
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
          reason: { type: "string" },
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
    preHandler: [authMiddleware.authenticate, orderRateLimit],
    handler: async (
      request: FastifyRequest<{ Params: OrderParams; Body: CancelOrderBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { reason } = request.body;
        const userId = (request.user as any)?.id;

        if (!userId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
            );
        }

        // TODO: Implement with OrderService
        // const order = await orderService.cancelOrder(id, userId, reason);

        // Placeholder response
        const order = {
          id,
          status: "cancelled",
          cancelReason: reason,
          cancelledAt: new Date().toISOString(),
        };

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(order, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to cancel order";
        const status = message.includes("not found")
          ? HTTP_STATUS.NOT_FOUND
          : message.includes("Not authorized")
          ? HTTP_STATUS.FORBIDDEN
          : HTTP_STATUS.BAD_REQUEST;

        return reply.status(status).send(
          ResponseBuilder.error(message, "CANCEL_ORDER_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Refund order
  fastify.post<{
    Params: OrderParams;
    Body: RefundOrderBody;
  }>("/:id/refund", {
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
          amount: { type: "number", minimum: 0.01 },
          reason: { type: "string" },
        },
        required: ["amount"],
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
      orderRateLimit,
    ],
    handler: async (
      request: FastifyRequest<{ Params: OrderParams; Body: RefundOrderBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { amount, reason } = request.body;

        // TODO: Implement with OrderService
        // const refund = await orderService.refundOrder(id, amount, reason);

        // Placeholder response
        const refund = {
          id: "refund-123",
          orderId: id,
          amount,
          reason,
          status: "processed",
          processedAt: new Date().toISOString(),
        };

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(refund, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to process refund";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(message, "REFUND_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });
}

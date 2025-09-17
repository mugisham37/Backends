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
import { getService } from "../../../core/container/index.js";
import { OrderService } from "../../../modules/ecommerce/orders/order.service.js";
import {
  CreateOrderUseCase,
  UpdateOrderStatusUseCase,
} from "../../../modules/ecommerce/orders/use-cases/index.js";

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
  userId?: string;
  customerEmail: string;
  customerPhone?: string;
  items: Array<{
    productId: string;
    variantId?: string;
    variantTitle?: string;
    quantity: number;
  }>;
  taxAmount?: number;
  shippingAmount?: number;
  discountAmount?: number;
  currency?: string;
  billingAddress: {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  shippingAddress: {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  shippingMethod?: string;
  customerNotes?: string;
  metadata?: {
    source?: string;
    utm?: {
      source?: string;
      medium?: string;
      campaign?: string;
    };
    [key: string]: any;
  };
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

  // Get services from container
  const orderService = getService<OrderService>("orderService");
  const createOrderUseCase =
    getService<CreateOrderUseCase>("createOrderUseCase");
  const updateOrderStatusUseCase = getService<UpdateOrderStatusUseCase>(
    "updateOrderStatusUseCase"
  );

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
          customerEmail: { type: "string", format: "email" },
          customerPhone: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                productId: { type: "string" },
                variantId: { type: "string" },
                variantTitle: { type: "string" },
                quantity: { type: "number", minimum: 1 },
              },
              required: ["productId", "quantity"],
            },
            minItems: 1,
          },
          taxAmount: { type: "number", minimum: 0 },
          shippingAmount: { type: "number", minimum: 0 },
          discountAmount: { type: "number", minimum: 0 },
          currency: { type: "string", pattern: "^[A-Z]{3}$" },
          billingAddress: {
            type: "object",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              company: { type: "string" },
              address1: { type: "string" },
              address2: { type: "string" },
              city: { type: "string" },
              state: { type: "string" },
              postalCode: { type: "string" },
              country: { type: "string" },
              phone: { type: "string" },
            },
            required: [
              "firstName",
              "lastName",
              "address1",
              "city",
              "state",
              "postalCode",
              "country",
            ],
          },
          shippingAddress: {
            type: "object",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              company: { type: "string" },
              address1: { type: "string" },
              address2: { type: "string" },
              city: { type: "string" },
              state: { type: "string" },
              postalCode: { type: "string" },
              country: { type: "string" },
              phone: { type: "string" },
            },
            required: [
              "firstName",
              "lastName",
              "address1",
              "city",
              "state",
              "postalCode",
              "country",
            ],
          },
          shippingMethod: { type: "string" },
          customerNotes: { type: "string" },
          metadata: { type: "object" },
        },
        required: [
          "customerEmail",
          "items",
          "billingAddress",
          "shippingAddress",
        ],
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

        // Prepare order data for the use case
        const orderData = {
          ...request.body,
          userId,
        };

        // Use the OrderService through use case
        const order = await createOrderUseCase.execute({ orderData });

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

        // Use OrderService to search orders
        const orders = await orderService.searchOrders(filters);

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

        // Use OrderService to get order statistics
        const statistics = await orderService.getOrderStatistics();

        return reply.status(HTTP_STATUS.OK).send(
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

        // Use OrderService to get order
        const order = await orderService.getOrder(id);

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

        // Use OrderService through use case to update order status
        const userId = (request.user as any)?.id;
        const order = await updateOrderStatusUseCase.execute({
          orderId: id,
          newStatus: status,
          updatedBy: userId,
          reason: notes,
        });

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

        // Use OrderService through use case to cancel order
        const order = await updateOrderStatusUseCase.execute({
          orderId: id,
          newStatus: "cancelled",
          updatedBy: userId,
          reason: reason,
        });

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

        // First update order status to refunded
        const order = await updateOrderStatusUseCase.execute({
          orderId: id,
          newStatus: "refunded",
          updatedBy: (request.user as any)?.id,
          reason: reason,
        });

        // Create refund record (placeholder for now until payment service is implemented)
        const refund = {
          id: `refund-${Date.now()}`,
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

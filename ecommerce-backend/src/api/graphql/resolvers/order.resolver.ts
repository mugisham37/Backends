/**
 * Order GraphQL Resolvers
 * Handles order-related queries, mutations, and subscriptions
 */

import { GraphQLError } from "graphql";
import { GraphQLContext, requireAuth, requireRole } from "../context.js";
import { PubSub } from "graphql-subscriptions";
import { getService } from "../../../core/container/index.js";
import { OrderService } from "../../../modules/ecommerce/orders/order.service.js";
import {
  CreateOrderUseCase,
  UpdateOrderStatusUseCase,
} from "../../../modules/ecommerce/orders/use-cases/index.js";

const pubsub = new PubSub() as any; // Temporary fix for TypeScript issues

export const orderResolvers = {
  Query: {
    order: async (
      _: any,
      { id, orderNumber }: { id?: string; orderNumber?: string },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);
      const orderService = getService<OrderService>("orderService");

      try {
        let order;
        if (id) {
          order = await orderService.getOrder(id);
        } else if (orderNumber) {
          order = await orderService.getOrderByNumber(orderNumber);
        } else {
          throw new GraphQLError("Either id or orderNumber must be provided");
        }

        if (!order) {
          throw new GraphQLError("Order not found", {
            extensions: { code: "ORDER_NOT_FOUND" },
          });
        }

        // Check permissions
        const canView =
          order.userId === user.id ||
          ["admin", "moderator"].includes(user.role) ||
          (user.role === "vendor" &&
            (await isVendorOrder(order.id, user.id, context)));

        if (!canView) {
          throw new GraphQLError("Insufficient permissions");
        }

        return order;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(`Failed to fetch order: ${error.message}`);
      }
    },

    orders: async (_: any, args: any, context: GraphQLContext) => {
      requireRole(context, ["admin", "moderator"]);
      const orderService = getService<OrderService>("orderService");

      try {
        const { filters, pagination } = args;

        // Use OrderService to search orders
        const orders = await orderService.searchOrders(filters || {});

        // Apply pagination (simplified)
        const limit = pagination?.first || 20;
        const paginatedOrders = orders.slice(0, limit);

        return {
          edges: paginatedOrders.map((order, index) => ({
            node: order,
            cursor: Buffer.from(`${index}`).toString("base64"),
          })),
          nodes: paginatedOrders,
          pageInfo: {
            hasNextPage: orders.length > limit,
            hasPreviousPage: false,
            startCursor:
              paginatedOrders.length > 0
                ? Buffer.from("0").toString("base64")
                : null,
            endCursor:
              paginatedOrders.length > 0
                ? Buffer.from(`${paginatedOrders.length - 1}`).toString(
                    "base64"
                  )
                : null,
          },
          totalCount: orders.length,
        };
      } catch (error) {
        throw new GraphQLError(`Failed to fetch orders: ${error.message}`);
      }
    },

    myOrders: async (_: any, args: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      const orderService = getService<OrderService>("orderService");

      try {
        // Use OrderService to get user orders
        const orders = await orderService.getUserOrders(user.id);

        // Apply pagination (simplified)
        const limit = args.pagination?.first || 20;
        const paginatedOrders = orders.slice(0, limit);

        return {
          edges: paginatedOrders.map((order, index) => ({
            node: order,
            cursor: Buffer.from(`${index}`).toString("base64"),
          })),
          nodes: paginatedOrders,
          pageInfo: {
            hasNextPage: orders.length > limit,
            hasPreviousPage: false,
            startCursor:
              paginatedOrders.length > 0
                ? Buffer.from("0").toString("base64")
                : null,
            endCursor:
              paginatedOrders.length > 0
                ? Buffer.from(`${paginatedOrders.length - 1}`).toString(
                    "base64"
                  )
                : null,
          },
          totalCount: orders.length,
        };
      } catch (error) {
        throw new GraphQLError(`Failed to fetch user orders: ${error.message}`);
      }
    },

    vendorOrders: async (
      _: any,
      { vendorId, ...args }: any,
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      try {
        // Check permissions
        if (user.role === "vendor") {
          const vendor = await context.repositories.vendor.findByUserId(
            user.id
          );
          if (!vendor || vendor.id !== vendorId) {
            throw new GraphQLError("Insufficient permissions");
          }
        } else if (!["admin", "moderator"].includes(user.role)) {
          throw new GraphQLError("Insufficient permissions");
        }

        // This would use a proper order repository method to find by vendor ID
        const orders = await context.repositories.order.findByVendorId(
          vendorId,
          args.filters || {}
        );

        // Apply pagination (simplified)
        const limit = args.pagination?.first || 20;
        const paginatedOrders = orders.slice(0, limit);

        return {
          edges: paginatedOrders.map((order, index) => ({
            node: order,
            cursor: Buffer.from(`${index}`).toString("base64"),
          })),
          nodes: paginatedOrders,
          pageInfo: {
            hasNextPage: orders.length > limit,
            hasPreviousPage: false,
            startCursor:
              paginatedOrders.length > 0
                ? Buffer.from("0").toString("base64")
                : null,
            endCursor:
              paginatedOrders.length > 0
                ? Buffer.from(`${paginatedOrders.length - 1}`).toString(
                    "base64"
                  )
                : null,
          },
          totalCount: orders.length,
        };
      } catch (error) {
        throw new GraphQLError(
          `Failed to fetch vendor orders: ${error.message}`
        );
      }
    },

    orderStats: async (
      _: any,
      { vendorId, dateFrom, dateTo }: any,
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      // Check permissions
      if (vendorId) {
        if (user.role === "vendor") {
          const vendor = await context.repositories.vendor.findByUserId(
            user.id
          );
          if (!vendor || vendor.id !== vendorId) {
            throw new GraphQLError("Insufficient permissions");
          }
        } else if (!["admin", "moderator"].includes(user.role)) {
          throw new GraphQLError("Insufficient permissions");
        }
      } else {
        requireRole(context, ["admin"]);
      }

      try {
        // This would be implemented in the order repository
        return {
          totalOrders: 0,
          totalRevenue: "0.00",
          averageOrderValue: "0.00",
          byStatus: {},
          byPaymentStatus: {},
          recentOrders: [],
          topCustomers: [],
        };
      } catch (error) {
        throw new GraphQLError(
          `Failed to fetch order statistics: ${error.message}`
        );
      }
    },
  },

  Mutation: {
    createOrder: async (_: any, { input }: any, context: GraphQLContext) => {
      // Orders can be created by authenticated users or as guest orders
      const user = context.user;
      const createOrderUseCase =
        getService<CreateOrderUseCase>("createOrderUseCase");

      try {
        // Prepare order data for the use case
        const orderData = {
          ...input,
          userId: user?.id,
        };

        // Use the OrderService through use case
        const order = await createOrderUseCase.execute({ orderData });

        // Publish subscription for vendor notifications
        pubsub.publish("VENDOR_ORDER_RECEIVED", {
          vendorOrderReceived: order,
        });

        return order;
      } catch (error) {
        throw new GraphQLError(`Order creation failed: ${error.message}`);
      }
    },

    updateOrderStatus: async (
      _: any,
      { id, input }: any,
      context: GraphQLContext
    ) => {
      requireRole(context, ["admin", "moderator", "vendor"]);
      const updateOrderStatusUseCase = getService<UpdateOrderStatusUseCase>(
        "updateOrderStatusUseCase"
      );
      const orderService = getService<OrderService>("orderService");

      try {
        const order = await orderService.getOrder(id);
        if (!order) {
          throw new GraphQLError("Order not found");
        }

        // Check vendor permissions
        if (context.user!.role === "vendor") {
          const hasPermission = await isVendorOrder(
            id,
            context.user!.id,
            context
          );
          if (!hasPermission) {
            throw new GraphQLError("Insufficient permissions");
          }
        }

        // Use OrderService through use case
        const updatedOrder = await updateOrderStatusUseCase.execute({
          orderId: id,
          newStatus: input.status,
          updatedBy: context.user!.id,
          reason: input.adminNotes,
        });

        // Publish subscription
        pubsub.publish("ORDER_UPDATED", {
          orderUpdated: updatedOrder,
          orderId: id,
        });

        if (order.userId) {
          pubsub.publish("ORDER_STATUS_CHANGED", {
            orderStatusChanged: updatedOrder,
            userId: order.userId,
          });
        }

        return updatedOrder;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(`Status update failed: ${error.message}`);
      }
    },

    processPayment: async (
      _: any,
      { orderId, input }: any,
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      try {
        const order = await context.repositories.order.findById(orderId);
        if (!order) {
          throw new GraphQLError("Order not found");
        }

        // Check permissions (order owner or admin)
        const canProcess =
          order.userId === user.id ||
          ["admin", "moderator"].includes(user.role);

        if (!canProcess) {
          throw new GraphQLError("Insufficient permissions");
        }

        // This would integrate with payment gateway
        const payment = await context.repositories.payment.create({
          orderId,
          paymentMethod: input.paymentMethod,
          paymentIntentId: input.paymentIntentId,
          amount: input.amount,
          currency: order.currency,
          status: "paid", // Would be set based on gateway response
          processedAt: new Date(),
        });

        // Update order payment status
        await context.repositories.order.update(orderId, {
          paymentStatus: "paid",
        });

        // Publish subscription
        pubsub.publish("PAYMENT_PROCESSED", {
          paymentProcessed: payment,
          orderId,
        });

        return payment;
      } catch (error) {
        throw new GraphQLError(`Payment processing failed: ${error.message}`);
      }
    },
  },

  Subscription: {
    orderUpdated: {
      subscribe: (_: any, { orderId }: any) =>
        pubsub.asyncIterator([`ORDER_UPDATED_${orderId}`]),
    },
    orderStatusChanged: {
      subscribe: (_: any, { userId }: any) =>
        userId
          ? pubsub.asyncIterator([`ORDER_STATUS_CHANGED_${userId}`])
          : pubsub.asyncIterator(["ORDER_STATUS_CHANGED"]),
    },
    vendorOrderReceived: {
      subscribe: (_: any, { vendorId }: any) =>
        pubsub.asyncIterator([`VENDOR_ORDER_RECEIVED_${vendorId}`]),
    },
    paymentProcessed: {
      subscribe: (_: any, { orderId }: any) =>
        pubsub.asyncIterator([`PAYMENT_PROCESSED_${orderId}`]),
    },
  },

  Order: {
    user: async (order: any, _: any, context: GraphQLContext) => {
      if (!order.userId) return null;
      return await context.repositories.user.findById(order.userId);
    },

    items: async (order: any, _: any, context: GraphQLContext) => {
      // This would be implemented when we have order items repository
      return [];
    },

    payments: async (order: any, _: any, context: GraphQLContext) => {
      // This would be implemented when we have payments repository
      return [];
    },

    itemCount: async (order: any, _: any, context: GraphQLContext) => {
      // This would sum up quantities from order items
      return 0;
    },

    canCancel: (order: any) => {
      return ["pending", "confirmed"].includes(order.status);
    },

    canRefund: (order: any) => {
      return (
        order.paymentStatus === "paid" &&
        ["delivered", "cancelled"].includes(order.status)
      );
    },

    canReturn: (order: any) => {
      return order.status === "delivered" && order.paymentStatus === "paid";
    },
  },

  OrderItem: {
    product: async (orderItem: any, _: any, context: GraphQLContext) => {
      return await context.repositories.product.findById(orderItem.productId);
    },

    variant: async (orderItem: any, _: any, context: GraphQLContext) => {
      if (!orderItem.variantId) return null;
      // This would be implemented when we have product variants repository
      return null;
    },

    vendor: async (orderItem: any, _: any, context: GraphQLContext) => {
      return await context.repositories.vendor.findById(orderItem.vendorId);
    },
  },

  Payment: {
    // Payment type resolvers would go here
  },
};

// Helper function to check if a vendor has access to an order
async function isVendorOrder(
  orderId: string,
  userId: string,
  context: GraphQLContext
): Promise<boolean> {
  try {
    const vendor = await context.repositories.vendor.findByUserId(userId);
    if (!vendor) return false;

    // This would check if any order items belong to this vendor
    // For now, return false as we don't have order items implemented
    return false;
  } catch {
    return false;
  }
}

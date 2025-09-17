/**
 * Order GraphQL Resolvers
 * Handles order-related queries, mutations, and subscriptions
 */

import { GraphQLError } from "graphql";
import { GraphQLContext, requireAuth, requireRole } from "../context.js";
import { PubSub } from "graphql-subscriptions";

const pubsub = new PubSub() as any; // Temporary fix for TypeScript issues

// Helper function to generate order number
const generateOrderNumber = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${timestamp.slice(-6)}-${random}`;
};

export const orderResolvers = {
  Query: {
    order: async (
      _: any,
      { id, orderNumber }: { id?: string; orderNumber?: string },
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      try {
        let order;
        if (id) {
          order = await context.repositories.order.findById(id);
        } else if (orderNumber) {
          order = await context.repositories.order.findByOrderNumber(
            orderNumber
          );
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

      try {
        const { filters, pagination } = args;

        // This would use a proper order repository method
        const orders = await context.repositories.order.findWithFilters(
          filters || {}
        );
        const totalCount = await context.repositories.order.count();

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
          totalCount,
        };
      } catch (error) {
        throw new GraphQLError(`Failed to fetch orders: ${error.message}`);
      }
    },

    myOrders: async (_: any, args: any, context: GraphQLContext) => {
      const user = requireAuth(context);

      try {
        // This would use a proper order repository method to find by user ID
        const orders = await context.repositories.order.findByUser(user.id);

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

      try {
        const orderNumber = generateOrderNumber();

        // Calculate totals from items
        let subtotal = 0;
        for (const item of input.items) {
          subtotal += parseFloat(item.price) * item.quantity;
        }

        const order = await context.repositories.order.create({
          orderNumber,
          userId: user?.id || null,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          status: "pending",
          paymentStatus: "pending",
          shippingStatus: "pending",
          subtotal: subtotal.toString(),
          taxAmount: "0.00", // Would be calculated based on tax rules
          shippingAmount: "0.00", // Would be calculated based on shipping method
          discountAmount: "0.00",
          total: subtotal.toString(), // Would include tax and shipping
          currency: "USD",
          billingAddress: input.billingAddress,
          shippingAddress: input.shippingAddress,
          shippingMethod: input.shippingMethod,
          customerNotes: input.customerNotes,
          metadata: input.metadata,
        });

        // Create order items (this would be done in a transaction)
        // for (const item of input.items) {
        //   await context.repositories.orderItem.create({
        //     orderId: order.id,
        //     productId: item.productId,
        //     variantId: item.variantId,
        //     quantity: item.quantity,
        //     price: item.price,
        //     total: (parseFloat(item.price) * item.quantity).toString(),
        //   });
        // }

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

      try {
        const order = await context.repositories.order.findById(id);
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

        const updatedOrder = await context.repositories.order.update(id, {
          status: input.status,
          adminNotes: input.adminNotes,
        });

        if (!updatedOrder) {
          throw new GraphQLError("Failed to update order status");
        }

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

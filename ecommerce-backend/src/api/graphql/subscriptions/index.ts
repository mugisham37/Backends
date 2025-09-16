/**
 * GraphQL Subscriptions Manager
 * Manages real-time subscriptions with authentication and authorization
 */

import { PubSub } from "graphql-subscriptions";
import { GraphQLContext } from "../context.js";
import { User } from "../../../core/database/schema/index.js";

// Create PubSub instance for managing subscriptions
export const pubsub = new PubSub();

// Subscription event names
export const SUBSCRIPTION_EVENTS = {
  // User events
  USER_UPDATED: "USER_UPDATED",
  USER_STATUS_CHANGED: "USER_STATUS_CHANGED",

  // Vendor events
  VENDOR_UPDATED: "VENDOR_UPDATED",
  VENDOR_STATUS_CHANGED: "VENDOR_STATUS_CHANGED",
  VENDOR_APPLICATION_RECEIVED: "VENDOR_APPLICATION_RECEIVED",

  // Product events
  PRODUCT_UPDATED: "PRODUCT_UPDATED",
  PRODUCT_STATUS_CHANGED: "PRODUCT_STATUS_CHANGED",
  LOW_STOCK_ALERT: "LOW_STOCK_ALERT",
  OUT_OF_STOCK_ALERT: "OUT_OF_STOCK_ALERT",

  // Order events
  ORDER_UPDATED: "ORDER_UPDATED",
  ORDER_STATUS_CHANGED: "ORDER_STATUS_CHANGED",
  VENDOR_ORDER_RECEIVED: "VENDOR_ORDER_RECEIVED",
  PAYMENT_PROCESSED: "PAYMENT_PROCESSED",

  // System events
  SYSTEM_NOTIFICATION: "SYSTEM_NOTIFICATION",
  MAINTENANCE_MODE: "MAINTENANCE_MODE",
} as const;

// Subscription filters and authorization
export class SubscriptionManager {
  private pubsub: PubSub;

  constructor(pubsubInstance: PubSub = pubsub) {
    this.pubsub = pubsubInstance;
  }

  // Publish event with payload
  async publish(event: string, payload: any): Promise<void> {
    try {
      await this.pubsub.publish(event, payload);
    } catch (error) {
      console.error(`Failed to publish event ${event}:`, error);
    }
  }

  // Create authenticated subscription iterator
  createAuthenticatedIterator(
    event: string,
    context: GraphQLContext,
    filter?: (payload: any, variables: any, context: GraphQLContext) => boolean
  ) {
    // Require authentication for all subscriptions
    if (!context.isAuthenticated || !context.user) {
      throw new Error("Authentication required for subscriptions");
    }

    const iterator = this.pubsub.asyncIterator(event);

    // Apply filter if provided
    if (filter) {
      return {
        [Symbol.asyncIterator]: async function* () {
          for await (const payload of iterator) {
            if (filter(payload, {}, context)) {
              yield payload;
            }
          }
        },
      };
    }

    return iterator;
  }

  // User-specific subscription filter
  createUserFilter(userId: string) {
    return (payload: any, variables: any, context: GraphQLContext) => {
      return context.user?.id === userId || context.user?.role === "admin";
    };
  }

  // Vendor-specific subscription filter
  createVendorFilter(vendorId: string) {
    return async (payload: any, variables: any, context: GraphQLContext) => {
      if (context.user?.role === "admin") return true;

      if (context.user?.role === "vendor") {
        const vendor = await context.repositories.vendor.findByUserId(
          context.user.id
        );
        return vendor?.id === vendorId;
      }

      return false;
    };
  }

  // Role-based subscription filter
  createRoleFilter(allowedRoles: string[]) {
    return (payload: any, variables: any, context: GraphQLContext) => {
      return allowedRoles.includes(context.user?.role || "");
    };
  }

  // Order-specific subscription filter
  createOrderFilter(orderId?: string) {
    return async (payload: any, variables: any, context: GraphQLContext) => {
      if (context.user?.role === "admin") return true;

      // If specific order ID, check ownership
      if (orderId) {
        const order = await context.repositories.order.findById(orderId);
        if (!order) return false;

        // Order owner can subscribe
        if (order.userId === context.user?.id) return true;

        // Vendor can subscribe to their orders
        if (context.user?.role === "vendor") {
          const vendor = await context.repositories.vendor.findByUserId(
            context.user.id
          );
          // Would need to check if order contains vendor's products
          return false; // Simplified for now
        }
      }

      return false;
    };
  }
}

// Global subscription manager instance
export const subscriptionManager = new SubscriptionManager(pubsub);

// Helper functions for common subscription patterns
export const publishUserUpdate = (user: User) => {
  subscriptionManager.publish(SUBSCRIPTION_EVENTS.USER_UPDATED, {
    userUpdated: user,
    userId: user.id,
  });
};

export const publishVendorUpdate = (vendor: any) => {
  subscriptionManager.publish(SUBSCRIPTION_EVENTS.VENDOR_UPDATED, {
    vendorUpdated: vendor,
    vendorId: vendor.id,
  });
};

export const publishProductUpdate = (product: any) => {
  subscriptionManager.publish(SUBSCRIPTION_EVENTS.PRODUCT_UPDATED, {
    productUpdated: product,
    productId: product.id,
  });
};

export const publishOrderUpdate = (order: any) => {
  subscriptionManager.publish(SUBSCRIPTION_EVENTS.ORDER_UPDATED, {
    orderUpdated: order,
    orderId: order.id,
  });
};

export const publishLowStockAlert = (product: any, vendorId: string) => {
  subscriptionManager.publish(SUBSCRIPTION_EVENTS.LOW_STOCK_ALERT, {
    lowStockAlert: product,
    vendorId,
  });
};

export const publishOutOfStockAlert = (product: any, vendorId: string) => {
  subscriptionManager.publish(SUBSCRIPTION_EVENTS.OUT_OF_STOCK_ALERT, {
    outOfStockAlert: product,
    vendorId,
  });
};

export const publishSystemNotification = (
  message: string,
  type: string = "info"
) => {
  subscriptionManager.publish(SUBSCRIPTION_EVENTS.SYSTEM_NOTIFICATION, {
    systemNotification: {
      message,
      type,
      timestamp: new Date().toISOString(),
    },
  });
};

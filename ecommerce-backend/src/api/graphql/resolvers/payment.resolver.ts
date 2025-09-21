/**
 * Payment GraphQL Resolvers
 * Implements payment-related GraphQL operations
 */

import { GraphQLError } from "graphql";
import type { GraphQLContext } from "../context.js";
import type {
  Payment,
  PaymentTransaction,
  PaymentRefund,
  PaymentDispute,
} from "../../../core/database/schema/payments.js";
import type {
  PaymentWebhook,
  CreatePaymentInput,
  UpdatePaymentInput,
  ProcessPaymentInput,
  RefundPaymentInput,
  PaymentFiltersInput,
  PaymentSortInput,
  PaymentAnalytics,
  PaymentIntentResponse,
} from "../../../modules/ecommerce/payments/payment.types.js";
import { AppError } from "../../../core/errors/app-error.js";
import { ErrorTypes } from "../../../core/errors/error-types.js";

// Type guards and validation helpers
const validatePaymentAccess = async (
  paymentId: string,
  userId: string,
  userRole: string,
  context: GraphQLContext
): Promise<Payment> => {
  const payment = await context.container
    .get("paymentRepository")
    .findById(paymentId);

  if (!payment) {
    throw new GraphQLError("Payment not found", {
      extensions: { code: "PAYMENT_NOT_FOUND" },
    });
  }

  // Admin can access all payments
  if (userRole === "admin") {
    return payment;
  }

  // Vendors can only access their own payments
  if (userRole === "vendor" && payment.vendorId === userId) {
    return payment;
  }

  // Customers can access payments for their orders
  if (userRole === "customer") {
    const order = await context.container
      .get("orderRepository")
      .findById(payment.orderId);
    if (order?.customerId === userId) {
      return payment;
    }
  }

  throw new GraphQLError("Unauthorized access to payment", {
    extensions: { code: "FORBIDDEN" },
  });
};

export const paymentResolvers = {
  Query: {
    async payment(
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ): Promise<any> {
      try {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        return await validatePaymentAccess(
          id,
          context.user.id,
          context.user.role,
          context
        );
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch payment", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    async paymentByExternalId(
      _: any,
      { externalId, provider }: { externalId: string; provider: string },
      context: GraphQLContext
    ): Promise<any> {
      try {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        const paymentService = context.container.get("paymentService");
        const payment = await paymentService.findByExternalId(
          externalId,
          provider
        );

        if (!payment) return null;

        return await validatePaymentAccess(
          payment.id,
          context.user.id,
          context.user.role,
          context
        );
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch payment", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    async payments(
      _: any,
      {
        filters,
        sort,
        first = 20,
        after,
        last,
        before,
      }: {
        filters?: PaymentFiltersInput;
        sort?: PaymentSortInput;
        first?: number;
        after?: string;
        last?: number;
        before?: string;
      },
      context: GraphQLContext
    ) {
      try {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        // Non-admin users can only see their own payments
        let enhancedFilters = filters || {};
        if (context.user.role === "vendor") {
          enhancedFilters = { ...enhancedFilters, vendorId: context.user.id };
        } else if (context.user.role === "customer") {
          // For customers, we need to filter by their orders
          const orderRepository = context.container.get("orderRepository");
          const customerOrders = await orderRepository.findByCustomerId(
            context.user.id
          );
          const orderIds = customerOrders.map((order: any) => order.id);
          enhancedFilters = { ...enhancedFilters, orderId: orderIds };
        } else if (context.user.role !== "admin") {
          throw new GraphQLError("Insufficient permissions", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        const paymentService = context.container.get("paymentService");
        const { payments, totalCount, hasNextPage, hasPreviousPage } =
          await paymentService.findMany({
            filters: enhancedFilters,
            sort,
            pagination: { first, after, last, before },
          });

        return {
          edges: payments.map((payment: any, index: number) => ({
            node: payment,
            cursor: Buffer.from(`${payment.id}:${index}`).toString("base64"),
          })),
          pageInfo: {
            hasNextPage,
            hasPreviousPage,
            startCursor:
              payments.length > 0
                ? Buffer.from(`${payments[0].id}:0`).toString("base64")
                : null,
            endCursor:
              payments.length > 0
                ? Buffer.from(
                    `${payments[payments.length - 1].id}:${payments.length - 1}`
                  ).toString("base64")
                : null,
          },
          totalCount,
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch payments", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    async vendorPayments(
      _: any,
      {
        vendorId,
        filters,
        sort,
        first = 20,
        after,
      }: {
        vendorId: string;
        filters?: PaymentFiltersInput;
        sort?: PaymentSortInput;
        first?: number;
        after?: string;
      },
      context: GraphQLContext
    ) {
      try {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        // Only admin or the vendor themselves can access vendor payments
        if (context.user.role !== "admin" && context.user.id !== vendorId) {
          throw new GraphQLError("Insufficient permissions", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        const paymentService = context.container.get("paymentService");
        const enhancedFilters = { ...filters, vendorId };

        const { payments, totalCount, hasNextPage, hasPreviousPage } =
          await paymentService.findMany({
            filters: enhancedFilters,
            sort,
            pagination: { first, after },
          });

        return {
          edges: payments.map((payment: any, index: number) => ({
            node: payment,
            cursor: Buffer.from(`${payment.id}:${index}`).toString("base64"),
          })),
          pageInfo: {
            hasNextPage,
            hasPreviousPage,
            startCursor:
              payments.length > 0
                ? Buffer.from(`${payments[0].id}:0`).toString("base64")
                : null,
            endCursor:
              payments.length > 0
                ? Buffer.from(
                    `${payments[payments.length - 1].id}:${payments.length - 1}`
                  ).toString("base64")
                : null,
          },
          totalCount,
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch vendor payments", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    async orderPayments(
      _: any,
      { orderId }: { orderId: string },
      context: GraphQLContext
    ): Promise<any[]> {
      try {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        // Check if user can access this order
        const orderRepository = context.container.get("orderRepository");
        const order = await orderRepository.findById(orderId);

        if (!order) {
          throw new GraphQLError("Order not found", {
            extensions: { code: "ORDER_NOT_FOUND" },
          });
        }

        // Access control
        if (
          context.user.role !== "admin" &&
          order.customerId !== context.user.id &&
          order.vendorId !== context.user.id
        ) {
          throw new GraphQLError("Insufficient permissions", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        const paymentService = context.container.get("paymentService");
        return await paymentService.findByOrderId(orderId);
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch order payments", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    async paymentAnalytics(
      _: any,
      {
        filters,
        dateFrom,
        dateTo,
      }: {
        filters?: PaymentFiltersInput;
        dateFrom?: Date;
        dateTo?: Date;
      },
      context: GraphQLContext
    ): Promise<PaymentAnalytics> {
      try {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        // Only admin and vendors can access analytics
        if (context.user.role !== "admin" && context.user.role !== "vendor") {
          throw new GraphQLError("Insufficient permissions", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        // Vendors can only see their own analytics
        let enhancedFilters = filters || {};
        if (context.user.role === "vendor") {
          enhancedFilters = { ...enhancedFilters, vendorId: context.user.id };
        }

        const paymentService = context.container.get("paymentService");
        return await paymentService.getAnalytics({
          filters: enhancedFilters,
          dateFrom,
          dateTo,
        });
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch payment analytics", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    async paymentWebhooks(
      _: any,
      {
        provider,
        processed,
        first = 50,
        after,
      }: {
        provider?: string;
        processed?: boolean;
        first?: number;
        after?: string;
      },
      context: GraphQLContext
    ): Promise<any[]> {
      try {
        if (!context.user || context.user.role !== "admin") {
          throw new GraphQLError("Admin access required", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        const paymentService = context.container.get("paymentService");
        return await paymentService.getWebhooks({
          provider,
          processed,
          limit: first,
          offset: after ? parseInt(Buffer.from(after, "base64").toString()) : 0,
        });
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch payment webhooks", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },

  Mutation: {
    async createPayment(
      _: any,
      { input }: { input: CreatePaymentInput },
      context: GraphQLContext
    ): Promise<any> {
      try {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        // Verify order access
        const orderRepository = context.container.get("orderRepository");
        const order = await orderRepository.findById(input.orderId);

        if (!order) {
          throw new GraphQLError("Order not found", {
            extensions: { code: "ORDER_NOT_FOUND" },
          });
        }

        // Only order owner or admin can create payments
        if (
          context.user.role !== "admin" &&
          order.customerId !== context.user.id
        ) {
          throw new GraphQLError("Insufficient permissions", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        const paymentService = context.container.get("paymentService");
        return await paymentService.createPayment(input);
      } catch (error) {
        if (error instanceof AppError) {
          throw new GraphQLError(error.message, {
            extensions: { code: error.type },
          });
        }
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to create payment", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    async updatePayment(
      _: any,
      { id, input }: { id: string; input: UpdatePaymentInput },
      context: GraphQLContext
    ): Promise<any> {
      try {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        await validatePaymentAccess(
          id,
          context.user.id,
          context.user.role,
          context
        );

        const paymentService = context.container.get("paymentService");
        return await paymentService.updatePayment(id, input);
      } catch (error) {
        if (error instanceof AppError) {
          throw new GraphQLError(error.message, {
            extensions: { code: error.type },
          });
        }
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to update payment", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    async processPayment(
      _: any,
      { id, input }: { id: string; input: ProcessPaymentInput },
      context: GraphQLContext
    ): Promise<any> {
      try {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        await validatePaymentAccess(
          id,
          context.user.id,
          context.user.role,
          context
        );

        const paymentService = context.container.get("paymentService");
        return await paymentService.processPayment({ ...input, paymentId: id });
      } catch (error) {
        if (error instanceof AppError) {
          throw new GraphQLError(error.message, {
            extensions: { code: error.type },
          });
        }
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to process payment", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    async confirmPayment(
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ): Promise<any> {
      try {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        await validatePaymentAccess(
          id,
          context.user.id,
          context.user.role,
          context
        );

        const paymentService = context.container.get("paymentService");
        return await paymentService.confirmPayment(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw new GraphQLError(error.message, {
            extensions: { code: error.type },
          });
        }
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to confirm payment", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    async cancelPayment(
      _: any,
      { id, reason }: { id: string; reason?: string },
      context: GraphQLContext
    ): Promise<any> {
      try {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        await validatePaymentAccess(
          id,
          context.user.id,
          context.user.role,
          context
        );

        const paymentService = context.container.get("paymentService");
        return await paymentService.cancelPayment(id, reason);
      } catch (error) {
        if (error instanceof AppError) {
          throw new GraphQLError(error.message, {
            extensions: { code: error.type },
          });
        }
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to cancel payment", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    async refundPayment(
      _: any,
      { id, input }: { id: string; input: RefundPaymentInput },
      context: GraphQLContext
    ): Promise<any> {
      try {
        if (!context.user) {
          throw new GraphQLError("Authentication required", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        // Only admin and vendors can process refunds
        if (context.user.role !== "admin" && context.user.role !== "vendor") {
          throw new GraphQLError("Insufficient permissions", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        await validatePaymentAccess(
          id,
          context.user.id,
          context.user.role,
          context
        );

        const paymentService = context.container.get("paymentService");
        return await paymentService.refundPayment({ ...input, paymentId: id });
      } catch (error) {
        if (error instanceof AppError) {
          throw new GraphQLError(error.message, {
            extensions: { code: error.type },
          });
        }
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to refund payment", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    async processPaymentWebhook(
      _: any,
      {
        provider,
        signature,
        payload,
      }: {
        provider: string;
        signature: string;
        payload: string;
      },
      context: GraphQLContext
    ): Promise<boolean> {
      try {
        const paymentService = context.container.get("paymentService");
        await paymentService.processWebhook(provider, signature, payload);
        return true;
      } catch (error) {
        if (error instanceof AppError) {
          throw new GraphQLError(error.message, {
            extensions: { code: error.type },
          });
        }
        throw new GraphQLError("Failed to process webhook", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    async retryFailedPayment(
      _: any,
      { id }: { id: string },
      context: GraphQLContext
    ): Promise<any> {
      try {
        if (!context.user || context.user.role !== "admin") {
          throw new GraphQLError("Admin access required", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        const paymentService = context.container.get("paymentService");
        return await paymentService.retryPayment(id);
      } catch (error) {
        if (error instanceof AppError) {
          throw new GraphQLError(error.message, {
            extensions: { code: error.type },
          });
        }
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to retry payment", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    async markPaymentAsDisputed(
      _: any,
      {
        id,
        disputeId,
        reason,
      }: {
        id: string;
        disputeId: string;
        reason: string;
      },
      context: GraphQLContext
    ): Promise<any> {
      try {
        if (!context.user || context.user.role !== "admin") {
          throw new GraphQLError("Admin access required", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        const paymentService = context.container.get("paymentService");
        return await paymentService.markAsDisputed(id, disputeId, reason);
      } catch (error) {
        if (error instanceof AppError) {
          throw new GraphQLError(error.message, {
            extensions: { code: error.type },
          });
        }
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to mark payment as disputed", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },

  // Field resolvers
  Payment: {
    async order(payment: Payment, _: any, context: GraphQLContext) {
      const orderRepository = context.container.get("orderRepository");
      return await orderRepository.findById(payment.orderId);
    },

    async vendor(payment: Payment, _: any, context: GraphQLContext) {
      const vendorRepository = context.container.get("vendorRepository");
      return await vendorRepository.findById(payment.vendorId);
    },

    async transactions(payment: Payment, _: any, context: GraphQLContext) {
      const paymentRepository = context.container.get("paymentRepository");
      return await paymentRepository.findTransactionsByPaymentId(payment.id);
    },

    async refunds(payment: Payment, _: any, context: GraphQLContext) {
      const paymentRepository = context.container.get("paymentRepository");
      return await paymentRepository.findRefundsByPaymentId(payment.id);
    },

    async disputes(payment: Payment, _: any, context: GraphQLContext) {
      const paymentRepository = context.container.get("paymentRepository");
      return await paymentRepository.findDisputesByPaymentId(payment.id);
    },
  },

  PaymentTransaction: {
    async payment(
      transaction: PaymentTransaction,
      _: any,
      context: GraphQLContext
    ) {
      const paymentRepository = context.container.get("paymentRepository");
      return await paymentRepository.findById(transaction.paymentId);
    },
  },

  PaymentRefund: {
    async payment(refund: PaymentRefund, _: any, context: GraphQLContext) {
      const paymentRepository = context.container.get("paymentRepository");
      return await paymentRepository.findById(refund.paymentId);
    },
  },

  PaymentDispute: {
    async payment(dispute: PaymentDispute, _: any, context: GraphQLContext) {
      const paymentRepository = context.container.get("paymentRepository");
      return await paymentRepository.findById(dispute.paymentId);
    },
  },

  PaymentWebhook: {
    async payment(webhook: PaymentWebhook, _: any, context: GraphQLContext) {
      if (!webhook.paymentId) return null;
      const paymentRepository = context.container.get("paymentRepository");
      return await paymentRepository.findById(webhook.paymentId);
    },
  },

  // Subscription resolvers (if using subscriptions)
  Subscription: {
    paymentStatusChanged: {
      // Implementation depends on your subscription setup (e.g., Redis, PubSub)
      subscribe: () => {
        // Return async iterator for payment status changes
        throw new Error("Subscription not implemented");
      },
    },

    vendorPaymentStatusChanged: {
      subscribe: () => {
        // Return async iterator for vendor payment status changes
        throw new Error("Subscription not implemented");
      },
    },

    paymentWebhookReceived: {
      subscribe: () => {
        // Return async iterator for webhook events
        throw new Error("Subscription not implemented");
      },
    },
  },
};

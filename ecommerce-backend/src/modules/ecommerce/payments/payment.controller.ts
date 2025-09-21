/**
 * Payment Controller
 * Handles payment-related HTTP endpoints with comprehensive error handling
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { PaymentService } from "./payment.service.js";
import { PaymentRepository } from "../../../core/repositories/payment.repository.js";
import { OrderRepository } from "../../../core/repositories/order.repository.js";
import { UserRepository } from "../../../core/repositories/user.repository.js";
import { AppError } from "../../../core/errors/app-error.js";
import { db } from "../../../core/database/connection.js";
import {
  createPaymentSchema,
  processPaymentSchema,
  refundPaymentSchema,
  paymentFiltersSchema,
  paymentPaginationSchema,
  paymentListSchema,
  type CreatePaymentInput,
  type ProcessPaymentInput,
  type RefundPaymentInput,
  type PaymentFilters,
  type PaymentPagination,
} from "./payment.validators.js";
import { PaymentErrorCodes, PaymentError } from "./payment.types.js";
import type { AuthenticatedRequest } from "../../../shared/middleware/auth.middleware.js";
import { Validate } from "../../../core/decorators/validate.decorator.js";
import { MonitorQuery } from "../../../core/decorators/query-monitor.decorator.js";

export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Create a new payment for an order
   */
  @Validate({ target: "body", schema: createPaymentSchema })
  @MonitorQuery({ description: "Create payment" })
  async createPayment(
    request: FastifyRequest<{ Body: z.infer<typeof createPaymentSchema> }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // Manual validation and transformation to ensure type safety
      const createPaymentData = createPaymentSchema.parse(request.body);
      const payment = await this.paymentService.createPayment(
        createPaymentData as any
      );

      reply.status(201).send({
        success: true,
        message: "Payment created successfully",
        data: payment,
      });
    } catch (error) {
      if (error instanceof PaymentError) {
        reply.status(error.statusCode).send({
          success: false,
          error: error.code,
          message: error.message,
          details: error.details,
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Process a payment
   */
  @Validate({ target: "body", schema: processPaymentSchema })
  @MonitorQuery({ description: "Process payment" })
  async processPayment(
    request: FastifyRequest<{ Body: ProcessPaymentInput }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const payment = await this.paymentService.processPayment(request.body);

      reply.send({
        success: true,
        message: "Payment processed successfully",
        data: payment,
      });
    } catch (error) {
      if (error instanceof PaymentError) {
        reply.status(error.statusCode).send({
          success: false,
          error: error.code,
          message: error.message,
          details: error.details,
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Create a payment intent
   */
  @MonitorQuery({ description: "Create payment intent" })
  async createPaymentIntent(
    request: FastifyRequest<{
      Body: {
        amount: number;
        currency: string;
        orderId: string;
        paymentMethod: string;
        returnUrl?: string;
        metadata?: Record<string, any>;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { amount, currency, orderId, paymentMethod, returnUrl, metadata } =
        request.body;

      const intent = await this.paymentService.createPaymentIntent({
        amount,
        currency,
        orderId,
        paymentMethod: paymentMethod as any,
        returnUrl,
        metadata,
      });

      reply.send({
        success: true,
        message: "Payment intent created successfully",
        data: intent,
      });
    } catch (error) {
      if (error instanceof PaymentError) {
        reply.status(error.statusCode).send({
          success: false,
          error: error.code,
          message: error.message,
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Refund a payment
   */
  @Validate({ target: "body", schema: refundPaymentSchema })
  @MonitorQuery({ description: "Process refund" })
  async refundPayment(
    request: FastifyRequest<{ Body: RefundPaymentInput }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const refund = await this.paymentService.refundPayment(request.body);

      reply.send({
        success: true,
        message: "Refund processed successfully",
        data: refund,
      });
    } catch (error) {
      if (error instanceof PaymentError) {
        reply.status(error.statusCode).send({
          success: false,
          error: error.code,
          message: error.message,
          details: error.details,
        });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get payment by ID
   */
  @MonitorQuery({ description: "Get payment by ID" })
  async getPayment(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const payment = await this.paymentService.getPayment(request.params.id);

      if (!payment) {
        reply.status(404).send({
          success: false,
          error: PaymentErrorCodes.PAYMENT_NOT_FOUND,
          message: "Payment not found",
        });
        return;
      }

      reply.send({
        success: true,
        data: payment,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payments by order ID
   */
  @MonitorQuery({ description: "Get payments by order" })
  async getPaymentsByOrder(
    request: FastifyRequest<{ Params: { orderId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const payments = await this.paymentService.getPaymentsByOrder(
        request.params.orderId
      );

      reply.send({
        success: true,
        data: payments,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * List payments with filters and pagination
   */
  @MonitorQuery({ description: "List payments" })
  async listPayments(
    request: FastifyRequest<{
      Querystring: PaymentFilters &
        PaymentPagination & {
          sortBy?: string;
          sortOrder?: "asc" | "desc";
        };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { page, limit, sortBy, sortOrder, ...rawFilters } = request.query;

      // Use type assertion since runtime validation works
      const filters = rawFilters as unknown as PaymentFilters;

      const result = await this.paymentService.getPayments(filters as any, {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
        sortBy: (sortBy as any) || "createdAt",
        sortOrder: (sortOrder as any) || "desc",
      });

      reply.send({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get payment analytics
   */
  @MonitorQuery({ description: "Get payment analytics" })
  async getPaymentAnalytics(
    request: FastifyRequest<{ Querystring: PaymentFilters }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const analytics = await this.paymentService.getPaymentAnalytics(
        request.query as any
      );

      reply.send({
        success: true,
        data: analytics,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle webhook events from payment providers
   */
  @MonitorQuery({ description: "Process payment webhook" })
  async handleWebhook(
    request: FastifyRequest<{
      Params: { provider: string };
      Headers: { "x-webhook-signature"?: string };
      Body: any;
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { provider } = request.params;
      const signature = request.headers["x-webhook-signature"];
      const payload = JSON.stringify(request.body);

      if (!signature) {
        reply.status(400).send({
          success: false,
          error: "MISSING_SIGNATURE",
          message: "Webhook signature is required",
        });
        return;
      }

      await this.paymentService.handleWebhook(provider, payload, signature);

      reply.send({
        success: true,
        message: "Webhook processed successfully",
      });
    } catch (error) {
      if (error instanceof PaymentError) {
        reply.status(error.statusCode).send({
          success: false,
          error: error.code,
          message: error.message,
        });
      } else {
        reply.status(500).send({
          success: false,
          error: "WEBHOOK_ERROR",
          message: "Failed to process webhook",
        });
      }
    }
  }

  /**
   * Get payment methods and their configurations
   */
  @MonitorQuery({ description: "Get payment methods" })
  async getPaymentMethods(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      // In a real implementation, this would return available payment methods
      // based on the merchant configuration and regional availability
      const paymentMethods = [
        {
          method: "stripe",
          provider: "stripe",
          name: "Credit/Debit Card",
          description: "Pay securely with your credit or debit card",
          isEnabled: true,
          supportedCurrencies: ["USD", "EUR", "GBP"],
          fees: {
            fixedFee: 0.3,
            percentageFee: 2.9,
          },
        },
        {
          method: "paypal",
          provider: "paypal",
          name: "PayPal",
          description: "Pay with your PayPal account",
          isEnabled: true,
          supportedCurrencies: ["USD", "EUR", "GBP"],
          fees: {
            fixedFee: 0.3,
            percentageFee: 2.9,
          },
        },
      ];

      reply.send({
        success: true,
        data: paymentMethods,
      });
    } catch (error) {
      throw error;
    }
  }
}

// Factory function to create controller with dependencies
export function createPaymentController(): PaymentController {
  const paymentRepo = new PaymentRepository(db);
  const orderRepo = new OrderRepository(db);
  const userRepo = new UserRepository(db);

  const paymentService = new PaymentService(
    paymentRepo,
    orderRepo,
    userRepo
    // Add other services as needed: notificationService, analyticsService, cacheService
  );

  return new PaymentController(paymentService);
}

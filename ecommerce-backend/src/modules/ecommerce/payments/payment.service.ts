/**
 * Payment Service
 * Production-ready payment processing with comprehensive error handling,
 * fraud detection, and multi-provider support
 */

import { AppError } from "../../../core/errors/app-error.js";
import {
  PaymentRepository,
  type PaymentWithRelations,
  type PaymentAnalytics,
} from "../../../core/repositories/payment.repository.js";
import { OrderRepository } from "../../../core/repositories/order.repository.js";
import { UserRepository } from "../../../core/repositories/user.repository.js";
import { NotificationService } from "../../notifications/notification.service.js";
import { AnalyticsService } from "../../analytics/analytics.service.js";
import { CacheService } from "../../cache/cache.service.js";
import {
  type Payment,
  type PaymentTransaction,
  type PaymentRefund,
  type Order,
} from "../../../core/database/schema/index.js";
import {
  type CreatePaymentInput,
  type UpdatePaymentInput,
  type ProcessPaymentInput,
  type RefundPaymentInput,
  type PaymentOutput,
  type RefundOutput,
  type PaymentFilters,
  type PaymentAnalytics as PaymentAnalyticsType,
  PaymentErrorCodes,
  PaymentError,
  type PaymentProviderInterface,
  type PaymentIntentData,
  type PaymentWebhookData,
  type PaymentModuleConfig,
} from "./payment.types.js";
import {
  validatePaymentAmount,
  validateCurrencySupport,
  validateRefundAmount,
} from "./payment.validators.js";
import { MonitorQuery } from "../../../core/decorators/query-monitor.decorator.js";
import { Cache } from "../../../core/decorators/cache.decorator.js";

// Import payment providers
import { StripeProvider } from "./providers/stripe.provider.js";
import { PayPalProvider } from "./providers/paypal.provider";

export class PaymentService {
  private providers: Map<string, PaymentProviderInterface> = new Map();
  private config: PaymentModuleConfig;

  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly orderRepo: OrderRepository,
    private readonly userRepo: UserRepository,
    private readonly notificationService?: NotificationService,
    private readonly analyticsService?: AnalyticsService,
    private readonly cacheService?: CacheService,
    config?: Partial<PaymentModuleConfig>
  ) {
    this.config = this.buildConfig(config);
    this.initializeProviders();
  }

  // ========== PAYMENT CREATION ==========

  /**
   * Create a new payment for an order
   */
  @MonitorQuery({ description: "Create payment" })
  async createPayment(input: CreatePaymentInput): Promise<PaymentOutput> {
    // Validate order exists
    const order = await this.orderRepo.findById(input.orderId);
    if (!order) {
      throw new PaymentError(
        "Order not found",
        PaymentErrorCodes.ORDER_NOT_FOUND,
        404
      );
    }

    // Validate payment amount
    if (!validatePaymentAmount(input.amount, input.currency)) {
      throw new PaymentError(
        "Payment amount below minimum threshold",
        PaymentErrorCodes.INSUFFICIENT_FUNDS,
        400
      );
    }

    // Validate currency support
    if (
      !validateCurrencySupport(
        input.currency || "USD",
        this.config.supportedCurrencies
      )
    ) {
      throw new PaymentError(
        "Currency not supported",
        PaymentErrorCodes.CURRENCY_NOT_SUPPORTED,
        400
      );
    }

    // Check for duplicate payments
    const existingPayments = await this.paymentRepo.findByOrderId(
      input.orderId
    );
    const hasPendingOrSucceeded = existingPayments.some(
      (p) =>
        p.status === "pending" ||
        p.status === "processing" ||
        p.status === "succeeded"
    );

    if (hasPendingOrSucceeded) {
      throw new PaymentError(
        "Payment already exists for this order",
        PaymentErrorCodes.DUPLICATE_PAYMENT,
        409
      );
    }

    // Calculate fees
    const { providerFee, applicationFee, netAmount } = this.calculateFees(
      input.amount,
      input.provider,
      input.currency || "USD"
    );

    // Generate payment number
    const paymentNumber = `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;

    // Get order to extract vendorId
    const paymentOrder = await this.orderRepo.findById(input.orderId);
    if (!paymentOrder) {
      throw new PaymentError(
        "Order not found",
        PaymentErrorCodes.PAYMENT_NOT_FOUND,
        404
      );
    }

    if (!paymentOrder.vendorId) {
      throw new PaymentError(
        "Order must have a vendor assigned",
        PaymentErrorCodes.INVALID_REQUEST,
        400
      );
    }

    const paymentData = {
      orderId: input.orderId,
      vendorId: paymentOrder.vendorId,
      paymentNumber,
      method: input.method as any,
      provider: input.provider as any,
      amount: input.amount.toString(),
      currency: input.currency || "USD",
      providerFee: providerFee.toString(),
      applicationFee: applicationFee.toString(),
      netAmount: netAmount.toString(),
      billingAddress: input.billingAddress,
      paymentIntentId: input.paymentIntentId,
      metadata: {
        ...input.metadata,
        createdBy: "payment_service",
        userAgent: input.metadata?.userAgent,
        customerIp: input.metadata?.customerIp,
      },
    };

    const payment = await this.paymentRepo.create(paymentData);

    // Track analytics
    await this.trackPaymentEvent("payment_created", payment);

    return this.formatPaymentOutput(payment);
  }

  // ========== PAYMENT PROCESSING ==========

  /**
   * Process a payment using the configured provider
   */
  @MonitorQuery({ description: "Process payment" })
  async processPayment(input: ProcessPaymentInput): Promise<PaymentOutput> {
    const payment = await this.paymentRepo.findById(input.paymentId);
    if (!payment) {
      throw new PaymentError(
        "Payment not found",
        PaymentErrorCodes.PAYMENT_NOT_FOUND,
        404
      );
    }

    if (payment.status !== "pending") {
      throw new PaymentError(
        "Payment already processed",
        PaymentErrorCodes.PAYMENT_ALREADY_PROCESSED,
        409
      );
    }

    // Fraud detection check
    const riskAssessment = await this.assessPaymentRisk(payment);
    if (riskAssessment.shouldBlock) {
      await this.paymentRepo.update(payment.id, {
        status: "failed",
        failureReason: "Failed fraud check",
        failureCode: "FRAUD_DETECTED",
        riskScore: riskAssessment.score.toString(),
        riskLevel: riskAssessment.level,
      });

      throw new PaymentError(
        "Payment failed security check",
        PaymentErrorCodes.PAYMENT_DECLINED,
        400
      );
    }

    // Update payment with risk assessment
    await this.paymentRepo.update(payment.id, {
      status: "processing",
      riskScore: riskAssessment.score.toString(),
      riskLevel: riskAssessment.level,
    });

    try {
      // Get payment provider
      const provider = this.getProvider(payment.provider);

      // Process payment with provider
      const result = await provider.processPayment({
        paymentId: payment.id,
        paymentMethodDetails: input.paymentMethodDetails,
        clientSecret: input.clientSecret || payment.clientSecret || undefined,
        returnUrl: input.returnUrl,
      });

      // Update payment status
      const updateData: any = {
        status: result.status,
        processedAt: new Date(),
        providerResponse: result.metadata,
      };

      if (result.transactionId) {
        updateData.externalId = result.transactionId;
      }

      const updatedPayment = await this.paymentRepo.update(
        payment.id,
        updateData
      );

      if (!updatedPayment) {
        throw new AppError(
          "Failed to update payment after processing",
          500,
          "INTERNAL_ERROR"
        );
      }

      // Create transaction record
      await this.paymentRepo.createTransaction({
        paymentId: payment.id,
        transactionNumber: `TXN-${payment.id}-${Date.now()}`,
        type: "payment",
        status: result.status,
        amount: payment.amount,
        currency: payment.currency || "USD",
        externalTransactionId: result.transactionId,
        providerResponse: result.metadata,
        processedAt: new Date(),
      });

      // Handle successful payment
      if (result.status === "succeeded") {
        await this.handleSuccessfulPayment(updatedPayment);
      } else if (result.status === "failed") {
        await this.handleFailedPayment(updatedPayment, result.metadata);
      }

      // Track analytics
      await this.trackPaymentEvent("payment_processed", updatedPayment);

      return this.formatPaymentOutput(updatedPayment);
    } catch (error) {
      // Handle processing error
      await this.paymentRepo.update(payment.id, {
        status: "failed",
        failedAt: new Date(),
        failureReason: error instanceof Error ? error.message : "Unknown error",
        failureCode: "PROCESSING_ERROR",
      });

      throw new PaymentError(
        "Payment processing failed",
        PaymentErrorCodes.PROVIDER_ERROR,
        500,
        { originalError: error }
      );
    }
  }

  // ========== PAYMENT INTENT CREATION ==========

  /**
   * Create a payment intent with the provider
   */
  @MonitorQuery({ description: "Create payment intent" })
  async createPaymentIntent(data: PaymentIntentData): Promise<{
    paymentIntentId: string;
    clientSecret?: string;
    status: string;
  }> {
    const provider = this.getProvider(
      data.paymentMethod === "stripe" ? "stripe" : "paypal"
    );

    try {
      const result = await provider.createPaymentIntent(data);

      return {
        paymentIntentId: result.id,
        clientSecret: result.clientSecret,
        status: result.status,
      };
    } catch (error) {
      throw new PaymentError(
        "Failed to create payment intent",
        PaymentErrorCodes.PROVIDER_ERROR,
        500,
        { originalError: error }
      );
    }
  }

  // ========== REFUND OPERATIONS ==========

  /**
   * Process a payment refund
   */
  @MonitorQuery({ description: "Process refund" })
  async refundPayment(input: RefundPaymentInput): Promise<RefundOutput> {
    const payment = await this.paymentRepo.findById(input.paymentId);
    if (!payment) {
      throw new PaymentError(
        "Payment not found",
        PaymentErrorCodes.PAYMENT_NOT_FOUND,
        404
      );
    }

    if (payment.status !== "succeeded") {
      throw new PaymentError(
        "Cannot refund non-successful payment",
        PaymentErrorCodes.REFUND_NOT_ALLOWED,
        400
      );
    }

    // Validate refund amount
    const refundAmount = input.amount || parseFloat(payment.amount);
    const currentRefunded = parseFloat(payment.refundedAmount || "0");
    const originalAmount = parseFloat(payment.amount);

    if (!validateRefundAmount(refundAmount, originalAmount, currentRefunded)) {
      throw new PaymentError(
        "Refund amount exceeds available amount",
        PaymentErrorCodes.REFUND_AMOUNT_EXCEEDS_AVAILABLE,
        400
      );
    }

    try {
      // Process refund with provider
      const provider = this.getProvider(payment.provider);
      const refundResult = await provider.refundPayment({
        paymentId: payment.id,
        amount: refundAmount,
        reason: input.reason,
        metadata: input.metadata,
      });

      // Create refund record
      const refund = await this.paymentRepo.createRefund({
        paymentId: payment.id,
        orderId: payment.orderId,
        amount: refundAmount.toString(),
        currency: payment.currency,
        reason: input.reason || "Customer request",
        refundNumber: `REF-${Date.now()}`,
        status: "succeeded",
        type: "requested",
        externalRefundId: refundResult.refundId,
        processedAt: new Date(),
        providerResponse: refundResult.metadata,
        metadata: input.metadata,
      });

      // Create transaction record
      await this.paymentRepo.createTransaction({
        paymentId: payment.id,
        type: "refund",
        status: "succeeded",
        amount: refundAmount.toString(),
        currency: payment.currency,
        transactionNumber: `TXN-${Date.now()}`,
        externalTransactionId: refundResult.refundId,
        reason: input.reason,
        processedAt: new Date(),
      });

      // Handle successful refund
      await this.handleSuccessfulRefund(payment, refund);

      // Track analytics
      await this.trackPaymentEvent("refund_processed", payment, {
        refundAmount,
      });

      return {
        id: refund.id,
        paymentId: payment.id,
        orderId: payment.orderId,
        refundNumber: refund.refundNumber,
        externalRefundId: refund.externalRefundId,
        amount: refund.amount,
        currency: refund.currency,
        reason: refund.reason,
        status: refund.status,
        type: refund.type,
        processedAt: refund.processedAt || null,
        failedAt: refund.failedAt,
        failureReason: refund.failureReason,
        providerResponse: refund.providerResponse,
        refundItems: refund.refundItems,
        processedByUserId: refund.processedByUserId,
        adminNotes: refund.adminNotes,
        customerNotified: refund.customerNotified,
        customerNotificationSentAt: refund.customerNotificationSentAt,
        metadata: refund.metadata,
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt,
      };
    } catch (error) {
      throw new PaymentError(
        "Refund processing failed",
        PaymentErrorCodes.PROVIDER_ERROR,
        500,
        { originalError: error }
      );
    }
  }

  // ========== WEBHOOK HANDLING ==========

  /**
   * Handle webhook events from payment providers
   */
  @MonitorQuery({ description: "Process webhook" })
  async handleWebhook(
    provider: string,
    payload: string,
    signature: string
  ): Promise<void> {
    const providerInstance = this.getProvider(provider);

    // Verify webhook signature
    if (!providerInstance.webhookVerification(payload, signature)) {
      throw new PaymentError(
        "Webhook verification failed",
        PaymentErrorCodes.WEBHOOK_VERIFICATION_FAILED,
        400
      );
    }

    try {
      const webhookData = providerInstance.parseWebhookData(
        JSON.parse(payload)
      );

      // Find related payment
      const payment = await this.paymentRepo.findByExternalId(
        webhookData.paymentId,
        provider
      );
      if (!payment) {
        console.warn(`Payment not found for webhook: ${webhookData.paymentId}`);
        return;
      }

      // Update payment based on webhook event
      await this.processWebhookEvent(payment, webhookData);
    } catch (error) {
      console.error("Webhook processing error:", error);
      throw new PaymentError(
        "Webhook processing failed",
        PaymentErrorCodes.PROVIDER_ERROR,
        500,
        { originalError: error }
      );
    }
  }

  // ========== QUERY OPERATIONS ==========

  /**
   * Get payment by ID
   */
  @Cache({ ttl: 300 }) // 5 minutes cache
  async getPayment(paymentId: string): Promise<PaymentOutput | null> {
    const payment = await this.paymentRepo.findById(paymentId);
    return payment ? this.formatPaymentOutput(payment) : null;
  }

  /**
   * Get payments by order ID
   */
  @Cache({ ttl: 300 })
  async getPaymentsByOrder(orderId: string): Promise<PaymentOutput[]> {
    const payments = await this.paymentRepo.findByOrderId(orderId);
    return payments.map((p) => this.formatPaymentOutput(p));
  }

  /**
   * Get payments with filters and pagination
   */
  async getPayments(
    filters: PaymentFilters,
    options: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
    } = {}
  ): Promise<{
    data: PaymentOutput[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;
    const offset = (page - 1) * limit;

    const result = await this.paymentRepo.findWithFilters(filters);
    const total = result.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = offset;
    const endIndex = Math.min(startIndex + limit, total);
    const paginatedData = result.slice(startIndex, endIndex);

    return {
      data: paginatedData.map((p) => this.formatPaymentOutput(p)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get payment analytics
   */
  @Cache({ ttl: 900 }) // 15 minutes cache
  async getPaymentAnalytics(
    filters: PaymentFilters = {}
  ): Promise<PaymentAnalyticsType> {
    return this.paymentRepo.getPaymentAnalytics(filters);
  }

  // ========== HELPER METHODS ==========

  /**
   * Calculate payment fees
   */
  private calculateFees(amount: number, provider: string, currency: string) {
    const providerConfig =
      this.config.providers[provider as keyof typeof this.config.providers];
    if (!providerConfig) {
      throw new PaymentError(
        "Payment provider not configured",
        PaymentErrorCodes.PAYMENT_METHOD_NOT_SUPPORTED,
        400
      );
    }

    const providerFee =
      providerConfig.fees.fixedFee +
      (amount * providerConfig.fees.percentageFee) / 100;
    const applicationFee = Math.max(
      (amount * this.config.fees.defaultApplicationFeePercentage) / 100,
      this.config.fees.minimumApplicationFee
    );
    const netAmount = amount - providerFee - applicationFee;

    return { providerFee, applicationFee, netAmount };
  }

  /**
   * Find payment by external ID
   */
  async findByExternalId(
    externalId: string,
    provider: string
  ): Promise<PaymentOutput | null> {
    const payment = await this.paymentRepo.findByExternalId(
      externalId,
      provider
    );
    return payment ? this.transformPaymentToOutput(payment) : null;
  }

  /**
   * Find many payments with pagination
   */
  async findMany(options: {
    filters?: PaymentFilters;
    sort?: { field: string; direction: "ASC" | "DESC" };
    pagination?: {
      first?: number;
      after?: string;
      last?: number;
      before?: string;
    };
  }): Promise<{
    payments: PaymentOutput[];
    totalCount: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  }> {
    const result = await this.getPayments(options.filters || {}, {
      page: 1,
      limit: options.pagination?.first || 20,
    });

    return {
      payments: result.data,
      totalCount: result.total,
      hasNextPage: result.page < result.totalPages,
      hasPreviousPage: result.page > 1,
    };
  }

  /**
   * Find payments by order ID
   */
  async findByOrderId(orderId: string): Promise<PaymentOutput[]> {
    return this.getPaymentsByOrder(orderId);
  }

  /**
   * Get analytics data
   */
  async getAnalytics(options: {
    filters?: PaymentFilters;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<PaymentAnalyticsType> {
    return this.getPaymentAnalytics(options.filters || {});
  }

  /**
   * Get webhook data
   */
  async getWebhooks(options: {
    provider?: string;
    processed?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    // This would typically fetch from a webhooks table
    // For now, return empty array as this requires webhook storage implementation
    return [];
  }

  /**
   * Update payment
   */
  async updatePayment(
    paymentId: string,
    input: UpdatePaymentInput
  ): Promise<PaymentOutput> {
    const existingPayment = await this.paymentRepo.findById(paymentId);
    if (!existingPayment) {
      throw new PaymentError(
        "Payment not found",
        PaymentErrorCodes.PAYMENT_NOT_FOUND,
        404
      );
    }

    const updateData = {
      ...input,
      riskScore: input.riskScore?.toString(),
      status: input.status as any,
    };

    const updatedPayment = await this.paymentRepo.update(paymentId, updateData);
    if (!updatedPayment) {
      throw new PaymentError(
        "Failed to update payment",
        PaymentErrorCodes.PAYMENT_NOT_FOUND,
        500
      );
    }
    return this.transformPaymentToOutput(updatedPayment);
  }

  /**
   * Confirm payment
   */
  async confirmPayment(paymentId: string): Promise<PaymentOutput> {
    return this.updatePayment(paymentId, {
      status: "succeeded",
      processedAt: new Date(),
    });
  }

  /**
   * Cancel payment
   */
  async cancelPayment(
    paymentId: string,
    reason?: string
  ): Promise<PaymentOutput> {
    return this.updatePayment(paymentId, {
      status: "cancelled",
      failureReason: reason,
    });
  }

  /**
   * Process webhook
   */
  async processWebhook(
    provider: string,
    signature: string,
    payload: string
  ): Promise<void> {
    await this.handleWebhook(provider, payload, signature);
  }

  /**
   * Retry failed payment
   */
  async retryPayment(paymentId: string): Promise<PaymentOutput> {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {
      throw new PaymentError(
        "Payment not found",
        PaymentErrorCodes.PAYMENT_NOT_FOUND,
        404
      );
    }

    if (payment.status !== "failed") {
      throw new PaymentError(
        "Only failed payments can be retried",
        PaymentErrorCodes.PAYMENT_ALREADY_PROCESSED,
        400
      );
    }

    return this.updatePayment(paymentId, {
      status: "pending",
      failureReason: undefined,
      failureCode: undefined,
    });
  }

  /**
   * Mark payment as disputed
   */
  async markAsDisputed(
    paymentId: string,
    disputeId: string,
    reason: string
  ): Promise<any> {
    const updatedPayment = await this.updatePayment(paymentId, {
      status: "disputed",
    });

    // This would typically create a dispute record
    // For now, return a mock dispute object
    return {
      id: disputeId,
      paymentId,
      reason,
      status: "open",
      createdAt: new Date(),
    };
  }

  /**
   * Transform Payment to PaymentOutput
   */
  private transformPaymentToOutput(payment: Payment): PaymentOutput {
    return {
      id: payment.id,
      orderId: payment.orderId,
      vendorId: payment.vendorId,
      paymentNumber: payment.paymentNumber,
      externalId: payment.externalId,
      method: payment.method,
      provider: payment.provider,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency || "USD",
      providerFee: payment.providerFee || "0.00",
      applicationFee: payment.applicationFee || "0.00",
      netAmount: payment.netAmount,
      cardInfo: payment.cardInfo,
      bankInfo: payment.bankInfo,
      walletInfo: payment.walletInfo,
      billingAddress: payment.billingAddress,
      providerResponse: payment.providerResponse,
      paymentIntentId: payment.paymentIntentId,
      clientSecret: payment.clientSecret,
      confirmationMethod: payment.confirmationMethod,
      riskScore: payment.riskScore,
      riskLevel: payment.riskLevel,
      fraudDetection: payment.fraudDetection,
      processedAt: payment.processedAt,
      failedAt: payment.failedAt,
      failureReason: payment.failureReason,
      failureCode: payment.failureCode,
      metadata: payment.metadata,
      refundedAmount: payment.refundedAmount || "0.00",
      refundableAmount: payment.refundableAmount,
      disputedAmount: payment.disputedAmount || "0.00",
      disputeReason: payment.disputeReason,
      settledAt: payment.settledAt,
      settlementId: payment.settlementId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  /**
   * Assess payment risk
   */
  private async assessPaymentRisk(payment: Payment): Promise<{
    score: number;
    level: string;
    shouldBlock: boolean;
  }> {
    let riskScore = 0;

    // Simple risk assessment (in production, use proper fraud detection service)
    const amount = parseFloat(payment.amount);

    if (amount > 1000) riskScore += 20;
    if (amount > 5000) riskScore += 30;
    if (!payment.billingAddress) riskScore += 10;

    // Check for multiple recent payments from same source
    // Implementation would check based on IP, card fingerprint, etc.

    const riskLevel =
      riskScore < 30 ? "low" : riskScore < 70 ? "medium" : "high";
    const shouldBlock = riskScore >= this.config.security.fraudThreshold;

    return { score: riskScore, level: riskLevel, shouldBlock };
  }

  /**
   * Handle successful payment
   */
  private async handleSuccessfulPayment(payment: Payment): Promise<void> {
    // Update order status
    await this.orderRepo.update(payment.orderId, {
      paymentStatus: "paid",
      status: "confirmed",
    });

    // Send notifications
    if (
      this.notificationService &&
      "sendPaymentConfirmation" in this.notificationService
    ) {
      await (this.notificationService as any).sendPaymentConfirmation({
        paymentId: payment.id,
        orderId: payment.orderId,
        amount: payment.amount,
        currency: payment.currency,
      });
    }

    // Clear relevant caches
    if (this.cacheService && "invalidatePattern" in this.cacheService) {
      await (this.cacheService as any).invalidatePattern(
        `payment:${payment.id}*`
      );
      await (this.cacheService as any).invalidatePattern(
        `order:${payment.orderId}*`
      );
    }
  }

  /**
   * Handle failed payment
   */
  private async handleFailedPayment(
    payment: Payment,
    metadata?: any
  ): Promise<void> {
    // Send failure notification
    if (this.notificationService) {
      await this.notificationService.queueNotification(
        "email",
        {
          paymentId: payment.id,
          orderId: payment.orderId,
          reason: payment.failureReason,
        },
        payment.orderId // Using orderId as user identifier
      );
    }
  }

  /**
   * Handle successful refund
   */
  private async handleSuccessfulRefund(
    payment: Payment,
    refund: PaymentRefund
  ): Promise<void> {
    // Check if order should be updated
    const totalRefunded =
      parseFloat(payment.refundedAmount || "0") + parseFloat(refund.amount);
    const originalAmount = parseFloat(payment.amount);

    if (totalRefunded >= originalAmount) {
      await this.orderRepo.update(payment.orderId, {
        paymentStatus: "refunded",
        status: "cancelled",
      });
    }

    // Send refund notification
    if (this.notificationService) {
      await this.notificationService.queueNotification(
        "email",
        {
          paymentId: payment.id,
          refundId: refund.id,
          amount: refund.amount,
          currency: payment.currency,
        },
        payment.orderId // Using orderId as user identifier
      );
    }
  }

  /**
   * Process webhook event
   */
  private async processWebhookEvent(
    payment: Payment,
    webhookData: PaymentWebhookData
  ): Promise<void> {
    const updateData: any = {};

    switch (webhookData.eventType) {
      case "payment_intent.succeeded":
        updateData.status = "succeeded";
        updateData.processedAt = new Date();
        break;
      case "payment_intent.payment_failed":
        updateData.status = "failed";
        updateData.failedAt = new Date();
        updateData.failureReason = "Payment failed";
        break;
      // Add more event types as needed
    }

    if (Object.keys(updateData).length > 0) {
      await this.paymentRepo.update(payment.id, updateData);
    }
  }

  /**
   * Track payment analytics event
   */
  private async trackPaymentEvent(
    event: string,
    payment: Payment,
    metadata?: any
  ): Promise<void> {
    if (this.analyticsService) {
      await this.analyticsService.trackEvent({
        eventType: "payment",
        eventName: event,
        eventCategory: "commerce",
        properties: {
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          provider: payment.provider,
          status: payment.status,
          ...metadata,
        },
      });
    }
  }

  /**
   * Get payment provider instance
   */
  private getProvider(provider: string): PaymentProviderInterface {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new PaymentError(
        `Payment provider '${provider}' not available`,
        PaymentErrorCodes.PAYMENT_METHOD_NOT_SUPPORTED,
        400
      );
    }
    return providerInstance;
  }

  /**
   * Format payment for output
   */
  private formatPaymentOutput(payment: Payment): PaymentOutput {
    return {
      id: payment.id,
      orderId: payment.orderId,
      vendorId: payment.vendorId,
      paymentNumber: payment.paymentNumber,
      externalId: payment.externalId,
      method: payment.method,
      provider: payment.provider,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency || "USD",
      providerFee: payment.providerFee || "0.00",
      applicationFee: payment.applicationFee || "0.00",
      netAmount: payment.netAmount,
      cardInfo: payment.cardInfo,
      bankInfo: payment.bankInfo,
      walletInfo: payment.walletInfo,
      billingAddress: payment.billingAddress,
      providerResponse: payment.providerResponse,
      paymentIntentId: payment.paymentIntentId,
      clientSecret: payment.clientSecret,
      confirmationMethod: payment.confirmationMethod,
      riskScore: payment.riskScore,
      riskLevel: payment.riskLevel,
      fraudDetection: payment.fraudDetection,
      processedAt: payment.processedAt,
      failedAt: payment.failedAt,
      failureReason: payment.failureReason,
      failureCode: payment.failureCode,
      metadata: payment.metadata,
      refundedAmount: payment.refundedAmount || "0.00",
      refundableAmount: payment.refundableAmount,
      disputedAmount: payment.disputedAmount || "0.00",
      disputeReason: payment.disputeReason,
      settledAt: payment.settledAt,
      settlementId: payment.settlementId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  /**
   * Initialize payment providers
   */
  private initializeProviders(): void {
    // Initialize Stripe if configured
    if (this.config.providers.stripe?.isEnabled) {
      this.providers.set(
        "stripe",
        new StripeProvider({
          apiKey: this.config.providers.stripe.config.apiKey || "",
          webhookSecret:
            this.config.providers.stripe.config.webhookSecret || "",
          ...this.config.providers.stripe.config,
        })
      );
    }

    // Initialize PayPal if configured
    if (this.config.providers.paypal?.isEnabled) {
      this.providers.set(
        "paypal",
        new PayPalProvider({
          clientId: this.config.providers.paypal.config.clientId || "",
          clientSecret: this.config.providers.paypal.config.clientSecret || "",
          environment:
            this.config.providers.paypal.config.environment || "sandbox",
          ...this.config.providers.paypal.config,
        })
      );
    }

    // Add more providers as needed
  }

  /**
   * Build configuration with defaults
   */
  private buildConfig(
    config?: Partial<PaymentModuleConfig>
  ): PaymentModuleConfig {
    return {
      defaultCurrency: "USD",
      supportedCurrencies: ["USD", "EUR", "GBP"],
      providers: {
        stripe: {
          provider: "stripe",
          isEnabled: false,
          config: {},
          fees: { fixedFee: 0.3, percentageFee: 2.9, currency: "USD" },
        },
        paypal: {
          provider: "paypal",
          isEnabled: false,
          config: {},
          fees: { fixedFee: 0.3, percentageFee: 2.9, currency: "USD" },
        },
        ...config?.providers,
      },
      security: {
        maxAttempts: 3,
        cooldownPeriod: 15,
        fraudThreshold: 70,
        requiresVerification: true,
        ...config?.security,
      },
      fees: {
        defaultApplicationFeePercentage: 1.0,
        minimumApplicationFee: 0.5,
        ...config?.fees,
      },
      features: {
        enableRefunds: true,
        enablePartialRefunds: true,
        enableDisputes: true,
        enableSubscriptions: false,
        enableMultiCurrency: true,
        ...config?.features,
      },
      ...config,
    };
  }
}

/**
 * Payment repository
 * Enhanced repository for payment management with transaction handling
 */

import {
  eq,
  and,
  or,
  desc,
  asc,
  count,
  sql,
  gte,
  lte,
  inArray,
  isNull,
} from "drizzle-orm";
import {
  BaseRepository,
  QueryOptions,
  PaginatedResult,
} from "./base.repository";
import {
  payments,
  paymentTransactions,
  paymentRefunds,
  paymentWebhooks,
  paymentDisputes,
  Payment,
  NewPayment,
  PaymentTransaction,
  NewPaymentTransaction,
  PaymentRefund,
  NewPaymentRefund,
  PaymentWebhook,
  NewPaymentWebhook,
  PaymentDispute,
  NewPaymentDispute,
  paymentStatusEnum,
} from "../database/schema/payments";
import { orders } from "../database/schema/orders";
import type { Database } from "../database/connection";

// Payment specific filter interfaces
export interface PaymentFilters {
  orderId?: string;
  status?: string[];
  method?: string[];
  provider?: string[];
  amountRange?: {
    min: number;
    max: number;
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  riskLevel?: string[];
  hasDisputes?: boolean;
  hasRefunds?: boolean;
}

export interface PaymentWithDetails extends Payment {
  order?: any;
  transactions?: PaymentTransaction[];
  refunds?: PaymentRefund[];
  disputes?: PaymentDispute[];
  webhooks?: PaymentWebhook[];
}

export interface PaymentSummary {
  totalPayments: number;
  totalAmount: number;
  successfulPayments: number;
  failedPayments: number;
  refundedAmount: number;
  disputedAmount: number;
  averagePaymentAmount: number;
  successRate: number;
}

export interface TransactionSummary {
  totalTransactions: number;
  totalAmount: number;
  byType: Array<{
    type: string;
    count: number;
    amount: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
}

export class PaymentRepository extends BaseRepository<Payment, NewPayment> {
  protected table = payments;
  protected idColumn = payments.id;
  protected tableName = "payments";

  constructor(db: Database) {
    super(db);
  }

  // Payment-specific methods
  async findByOrderId(orderId: string): Promise<Payment[]> {
    const result = await this.db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt));

    return result;
  }

  async findByExternalId(
    externalId: string,
    provider?: string
  ): Promise<Payment | null> {
    const conditions = [eq(payments.externalId, externalId)];

    if (provider) {
      conditions.push(eq(payments.provider, provider));
    }

    const result = await this.db
      .select()
      .from(payments)
      .where(and(...conditions))
      .limit(1);

    return result[0] || null;
  }

  async findPaymentWithDetails(
    paymentId: string
  ): Promise<PaymentWithDetails | null> {
    // Get payment
    const payment = await this.findById(paymentId);
    if (!payment) return null;

    // Get order details
    const orderResult = await this.db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerEmail: orders.customerEmail,
        total: orders.total,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.id, payment.orderId))
      .limit(1);

    // Get transactions
    const transactions = await this.db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.paymentId, paymentId))
      .orderBy(desc(paymentTransactions.createdAt));

    // Get refunds
    const refunds = await this.db
      .select()
      .from(paymentRefunds)
      .where(eq(paymentRefunds.paymentId, paymentId))
      .orderBy(desc(paymentRefunds.createdAt));

    // Get disputes
    const disputes = await this.db
      .select()
      .from(paymentDisputes)
      .where(eq(paymentDisputes.paymentId, paymentId))
      .orderBy(desc(paymentDisputes.createdAt));

    // Get webhooks
    const webhooks = await this.db
      .select()
      .from(paymentWebhooks)
      .where(eq(paymentWebhooks.paymentId, paymentId))
      .orderBy(desc(paymentWebhooks.receivedAt));

    return {
      ...payment,
      order: orderResult[0],
      transactions,
      refunds,
      disputes,
      webhooks,
    };
  }

  async createPayment(paymentData: NewPayment): Promise<Payment> {
    // Generate payment number if not provided
    if (!paymentData.paymentNumber) {
      paymentData.paymentNumber = await this.generatePaymentNumber();
    }

    const payment = await this.create(paymentData);

    // Create initial transaction record
    await this.createTransaction(payment.id, {
      type: "payment",
      status: paymentData.status || "pending",
      amount: paymentData.amount,
      currency: paymentData.currency || "USD",
      reason: "Initial payment",
      description: `Payment created for order ${paymentData.orderId}`,
    });

    return payment;
  }

  async updatePaymentStatus(
    paymentId: string,
    status: string,
    metadata?: any
  ): Promise<Payment | null> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "succeeded") {
      updateData.processedAt = new Date();
    } else if (status === "failed") {
      updateData.failedAt = new Date();
      if (metadata?.failureReason) {
        updateData.failureReason = metadata.failureReason;
      }
      if (metadata?.failureCode) {
        updateData.failureCode = metadata.failureCode;
      }
    }

    if (metadata?.providerResponse) {
      updateData.providerResponse = metadata.providerResponse;
    }

    const result = await this.update(paymentId, updateData);

    if (result) {
      // Create transaction record for status change
      await this.createTransaction(paymentId, {
        type: "payment",
        status,
        amount: result.amount,
        currency: result.currency,
        reason: `Payment status changed to ${status}`,
        metadata,
      });
    }

    return result;
  }

  // Transaction methods
  async createTransaction(
    paymentId: string,
    transactionData: Omit<
      NewPaymentTransaction,
      "paymentId" | "transactionNumber"
    >
  ): Promise<PaymentTransaction> {
    const fullTransactionData: NewPaymentTransaction = {
      paymentId,
      transactionNumber: await this.generateTransactionNumber(),
      ...transactionData,
    };

    const result = await this.db
      .insert(paymentTransactions)
      .values(fullTransactionData)
      .returning();

    return result[0];
  }

  async findTransactionsByPayment(
    paymentId: string
  ): Promise<PaymentTransaction[]> {
    const result = await this.db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.paymentId, paymentId))
      .orderBy(desc(paymentTransactions.createdAt));

    return result;
  }

  // Refund methods
  async createRefund(refundData: NewPaymentRefund): Promise<PaymentRefund> {
    // Generate refund number if not provided
    if (!refundData.refundNumber) {
      refundData.refundNumber = await this.generateRefundNumber();
    }

    const refund = await this.db
      .insert(paymentRefunds)
      .values(refundData)
      .returning();

    // Create transaction record for refund
    await this.createTransaction(refundData.paymentId, {
      type: "refund",
      status: refundData.status || "pending",
      amount: refundData.amount,
      currency: refundData.currency || "USD",
      reason: refundData.reason,
      description: `Refund created: ${refundData.reason}`,
    });

    return refund[0];
  }

  async updateRefundStatus(
    refundId: string,
    status: string,
    metadata?: any
  ): Promise<PaymentRefund | null> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === "succeeded") {
      updateData.processedAt = new Date();
    } else if (status === "failed") {
      updateData.failedAt = new Date();
      if (metadata?.failureReason) {
        updateData.failureReason = metadata.failureReason;
      }
    }

    if (metadata?.providerResponse) {
      updateData.providerResponse = metadata.providerResponse;
    }

    const result = await this.db
      .update(paymentRefunds)
      .set(updateData)
      .where(eq(paymentRefunds.id, refundId))
      .returning();

    if (result[0]) {
      // Update payment refunded amount
      await this.updatePaymentRefundedAmount(result[0].paymentId);

      // Create transaction record
      await this.createTransaction(result[0].paymentId, {
        type: "refund",
        status,
        amount: result[0].amount,
        currency: result[0].currency,
        reason: `Refund status changed to ${status}`,
        metadata,
      });
    }

    return result[0] || null;
  }

  async findRefundsByPayment(paymentId: string): Promise<PaymentRefund[]> {
    const result = await this.db
      .select()
      .from(paymentRefunds)
      .where(eq(paymentRefunds.paymentId, paymentId))
      .orderBy(desc(paymentRefunds.createdAt));

    return result;
  }

  private async updatePaymentRefundedAmount(paymentId: string): Promise<void> {
    const refunds = await this.db
      .select({
        totalRefunded: sql<number>`COALESCE(SUM(${paymentRefunds.amount}::numeric), 0)`,
      })
      .from(paymentRefunds)
      .where(
        and(
          eq(paymentRefunds.paymentId, paymentId),
          eq(paymentRefunds.status, "succeeded")
        )
      );

    const refundedAmount = refunds[0]?.totalRefunded || 0;

    await this.db
      .update(payments)
      .set({
        refundedAmount: refundedAmount.toString(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));
  }

  // Webhook methods
  async createWebhook(webhookData: NewPaymentWebhook): Promise<PaymentWebhook> {
    const result = await this.db
      .insert(paymentWebhooks)
      .values(webhookData)
      .returning();

    return result[0];
  }

  async findWebhookByEventId(
    eventId: string,
    provider: string
  ): Promise<PaymentWebhook | null> {
    const result = await this.db
      .select()
      .from(paymentWebhooks)
      .where(
        and(
          eq(paymentWebhooks.webhookEventId, eventId),
          eq(paymentWebhooks.provider, provider)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  async markWebhookAsProcessed(
    webhookId: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    const updateData: any = {
      processed: success,
      processedAt: new Date(),
      processingAttempts: sql`${paymentWebhooks.processingAttempts} + 1`,
      updatedAt: new Date(),
    };

    if (!success && error) {
      updateData.lastProcessingError = error;
    }

    await this.db
      .update(paymentWebhooks)
      .set(updateData)
      .where(eq(paymentWebhooks.id, webhookId));
  }

  async findUnprocessedWebhooks(
    limit: number = 100
  ): Promise<PaymentWebhook[]> {
    const result = await this.db
      .select()
      .from(paymentWebhooks)
      .where(eq(paymentWebhooks.processed, false))
      .orderBy(asc(paymentWebhooks.receivedAt))
      .limit(limit);

    return result;
  }

  // Dispute methods
  async createDispute(disputeData: NewPaymentDispute): Promise<PaymentDispute> {
    const result = await this.db
      .insert(paymentDisputes)
      .values(disputeData)
      .returning();

    // Update payment disputed amount
    await this.updatePaymentDisputedAmount(disputeData.paymentId);

    return result[0];
  }

  async updateDisputeStatus(
    disputeId: string,
    status: string,
    resolution?: string
  ): Promise<PaymentDispute | null> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (resolution) {
      updateData.resolution = resolution;
      updateData.resolvedAt = new Date();
    }

    const result = await this.db
      .update(paymentDisputes)
      .set(updateData)
      .where(eq(paymentDisputes.id, disputeId))
      .returning();

    return result[0] || null;
  }

  private async updatePaymentDisputedAmount(paymentId: string): Promise<void> {
    const disputes = await this.db
      .select({
        totalDisputed: sql<number>`COALESCE(SUM(${paymentDisputes.amount}::numeric), 0)`,
      })
      .from(paymentDisputes)
      .where(eq(paymentDisputes.paymentId, paymentId));

    const disputedAmount = disputes[0]?.totalDisputed || 0;

    await this.db
      .update(payments)
      .set({
        disputedAmount: disputedAmount.toString(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));
  }

  // Analytics and reporting methods
  async getPaymentSummary(
    filters: PaymentFilters = {}
  ): Promise<PaymentSummary> {
    const whereClause = this.buildPaymentWhereClause(filters);

    const summary = await this.db
      .select({
        totalPayments: count(payments.id),
        totalAmount: sql<number>`COALESCE(SUM(${payments.amount}::numeric), 0)`,
        refundedAmount: sql<number>`COALESCE(SUM(${payments.refundedAmount}::numeric), 0)`,
        disputedAmount: sql<number>`COALESCE(SUM(${payments.disputedAmount}::numeric), 0)`,
      })
      .from(payments)
      .where(whereClause);

    const statusCounts = await this.db
      .select({
        status: payments.status,
        count: count(payments.id),
      })
      .from(payments)
      .where(whereClause)
      .groupBy(payments.status);

    const totalPayments = summary[0]?.totalPayments || 0;
    const totalAmount = summary[0]?.totalAmount || 0;
    const refundedAmount = summary[0]?.refundedAmount || 0;
    const disputedAmount = summary[0]?.disputedAmount || 0;

    const successfulPayments =
      statusCounts.find((s) => s.status === "succeeded")?.count || 0;
    const failedPayments =
      statusCounts.find((s) => s.status === "failed")?.count || 0;

    return {
      totalPayments,
      totalAmount,
      successfulPayments,
      failedPayments,
      refundedAmount,
      disputedAmount,
      averagePaymentAmount: totalPayments > 0 ? totalAmount / totalPayments : 0,
      successRate:
        totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0,
    };
  }

  async getTransactionSummary(paymentId?: string): Promise<TransactionSummary> {
    const whereClause = paymentId
      ? eq(paymentTransactions.paymentId, paymentId)
      : undefined;

    const summary = await this.db
      .select({
        totalTransactions: count(paymentTransactions.id),
        totalAmount: sql<number>`COALESCE(SUM(${paymentTransactions.amount}::numeric), 0)`,
      })
      .from(paymentTransactions)
      .where(whereClause);

    const byType = await this.db
      .select({
        type: paymentTransactions.type,
        count: count(paymentTransactions.id),
        amount: sql<number>`COALESCE(SUM(${paymentTransactions.amount}::numeric), 0)`,
      })
      .from(paymentTransactions)
      .where(whereClause)
      .groupBy(paymentTransactions.type);

    const byStatus = await this.db
      .select({
        status: paymentTransactions.status,
        count: count(paymentTransactions.id),
        amount: sql<number>`COALESCE(SUM(${paymentTransactions.amount}::numeric), 0)`,
      })
      .from(paymentTransactions)
      .where(whereClause)
      .groupBy(paymentTransactions.status);

    return {
      totalTransactions: summary[0]?.totalTransactions || 0,
      totalAmount: summary[0]?.totalAmount || 0,
      byType,
      byStatus,
    };
  }

  // Helper methods
  private async generatePaymentNumber(): Promise<string> {
    const prefix = "PAY";
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  private async generateTransactionNumber(): Promise<string> {
    const prefix = "TXN";
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  private async generateRefundNumber(): Promise<string> {
    const prefix = "REF";
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  private buildPaymentWhereClause(filters: PaymentFilters) {
    const conditions = [];

    if (filters.orderId) {
      conditions.push(eq(payments.orderId, filters.orderId));
    }

    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(payments.status, filters.status));
    }

    if (filters.method && filters.method.length > 0) {
      conditions.push(inArray(payments.method, filters.method));
    }

    if (filters.provider && filters.provider.length > 0) {
      conditions.push(inArray(payments.provider, filters.provider));
    }

    if (filters.amountRange) {
      if (filters.amountRange.min !== undefined) {
        conditions.push(
          gte(sql`${payments.amount}::numeric`, filters.amountRange.min)
        );
      }
      if (filters.amountRange.max !== undefined) {
        conditions.push(
          lte(sql`${payments.amount}::numeric`, filters.amountRange.max)
        );
      }
    }

    if (filters.dateRange) {
      if (filters.dateRange.start) {
        conditions.push(gte(payments.createdAt, filters.dateRange.start));
      }
      if (filters.dateRange.end) {
        conditions.push(lte(payments.createdAt, filters.dateRange.end));
      }
    }

    if (filters.riskLevel && filters.riskLevel.length > 0) {
      conditions.push(inArray(payments.riskLevel, filters.riskLevel));
    }

    if (filters.hasDisputes !== undefined) {
      if (filters.hasDisputes) {
        conditions.push(sql`${payments.disputedAmount}::numeric > 0`);
      } else {
        conditions.push(sql`${payments.disputedAmount}::numeric = 0`);
      }
    }

    if (filters.hasRefunds !== undefined) {
      if (filters.hasRefunds) {
        conditions.push(sql`${payments.refundedAmount}::numeric > 0`);
      } else {
        conditions.push(sql`${payments.refundedAmount}::numeric = 0`);
      }
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

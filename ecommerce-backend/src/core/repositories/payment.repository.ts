/**
 * Enhanced Payment Repository
 * Comprehensive payment data operations with advanced querying and analytics
 */

import crypto from "crypto";
import {
  eq,
  and,
  desc,
  asc,
  gte,
  lte,
  count,
  sum,
  avg,
  sql,
  like,
  inArray,
  or,
} from "drizzle-orm";
import {
  BaseRepository,
  type QueryOptions,
  type PaginatedResult,
} from "./base.repository.js";
import type { Database } from "../database/connection.js";
import {
  payments,
  paymentTransactions,
  paymentRefunds,
  paymentDisputes,
  type Payment,
  type NewPayment,
  type PaymentTransaction,
  type NewPaymentTransaction,
  type PaymentRefund,
  type NewPaymentRefund,
  type PaymentDispute,
  type NewPaymentDispute,
  paymentsStatusEnum,
  paymentMethodEnum,
  paymentProviderEnum,
  transactionTypeEnum,
} from "../database/schema/index.js";

// ========== ENHANCED TYPES ==========

export interface PaymentFilters {
  orderId?: string | string[];
  userId?: string;
  status?: (typeof paymentsStatusEnum.enumValues)[number];
  method?: (typeof paymentMethodEnum.enumValues)[number];
  provider?: (typeof paymentProviderEnum.enumValues)[number];
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  searchTerm?: string;
  paymentNumbers?: string[];
  externalIds?: string[];
}

export interface PaymentWithRelations extends Payment {
  transactions?: PaymentTransaction[];
  refunds?: PaymentRefund[];
  order?: any; // Will be populated from order repository
}

export interface PaymentStats {
  totalPayments: number;
  totalAmount: string;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  refundedPayments: number;
  averageAmount: string;
  totalRefunded: string;
}

export interface PaymentAnalytics {
  stats: PaymentStats;
  methodBreakdown: Array<{
    method: string;
    count: number;
    totalAmount: string;
    percentage: number;
  }>;
  providerBreakdown: Array<{
    provider: string;
    count: number;
    totalAmount: string;
    successRate: number;
  }>;
  dailyTrends: Array<{
    date: string;
    count: number;
    amount: string;
    successRate: number;
  }>;
  topFailureReasons: Array<{
    reason: string;
    count: number;
  }>;
}

export interface CreatePaymentData
  extends Omit<NewPayment, "id" | "createdAt" | "updatedAt"> {}
export interface UpdatePaymentData
  extends Partial<Omit<Payment, "id" | "createdAt" | "updatedAt">> {}
export interface CreateTransactionData
  extends Omit<NewPaymentTransaction, "id" | "createdAt" | "updatedAt"> {}
export interface CreateRefundData
  extends Omit<NewPaymentRefund, "id" | "createdAt" | "updatedAt"> {}

export class PaymentRepository extends BaseRepository<
  Payment,
  NewPayment,
  UpdatePaymentData
> {
  protected table = payments;
  protected idColumn = payments.id;
  protected tableName = "payments";

  constructor(db: Database) {
    super(db);
  }

  // Find payments by order ID
  async findByOrderId(orderId: string): Promise<Payment[]> {
    return this.db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt));
  }

  // Find payments with filters
  async findWithFilters(filters: PaymentFilters): Promise<Payment[]> {
    const baseQuery = this.db.select().from(payments);

    const conditions = [];

    if (filters.orderId) {
      if (Array.isArray(filters.orderId)) {
        conditions.push(inArray(payments.orderId, filters.orderId));
      } else {
        conditions.push(eq(payments.orderId, filters.orderId));
      }
    }

    if (filters.status) {
      conditions.push(eq(payments.status, filters.status));
    }

    if (filters.method) {
      conditions.push(eq(payments.method, filters.method));
    }

    if (filters.dateFrom) {
      conditions.push(gte(payments.createdAt, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(payments.createdAt, filters.dateTo));
    }

    const finalQuery =
      conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

    return finalQuery.orderBy(desc(payments.createdAt));
  }

  // Get payment statistics
  async getPaymentStats(filters: PaymentFilters = {}): Promise<{
    totalPayments: number;
    totalAmount: string;
    successfulPayments: number;
    failedPayments: number;
    pendingPayments: number;
  }> {
    // This would implement payment statistics
    // For now, return default values
    return {
      totalPayments: 0,
      totalAmount: "0.00",
      successfulPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
    };
  }

  // Find recent payments
  async findRecent(limit: number = 10): Promise<Payment[]> {
    return this.db
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt))
      .limit(limit);
  }

  // Find payment by external ID
  async findByExternalId(
    externalId: string,
    provider?: string
  ): Promise<Payment | null> {
    const conditions = [eq(payments.paymentIntentId, externalId)];

    if (provider) {
      conditions.push(eq(payments.provider, provider as any));
    }

    const query = this.db
      .select()
      .from(payments)
      .where(and(...conditions))
      .limit(1);

    const results = await query;
    return results[0] || null;
  }

  // Create transaction record
  async createTransaction(
    data: Omit<NewPaymentTransaction, "id" | "createdAt" | "updatedAt">
  ): Promise<PaymentTransaction> {
    const fullTransactionData: NewPaymentTransaction = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [transaction] = await this.db
      .insert(paymentTransactions)
      .values(fullTransactionData)
      .returning();

    return transaction;
  }

  // Find transactions by payment ID
  async findTransactionsByPaymentId(
    paymentId: string
  ): Promise<PaymentTransaction[]> {
    return this.db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.paymentId, paymentId))
      .orderBy(desc(paymentTransactions.createdAt));
  }

  // Create refund record
  async createRefund(
    data: Omit<NewPaymentRefund, "id" | "createdAt" | "updatedAt">
  ): Promise<PaymentRefund> {
    const fullRefundData: NewPaymentRefund = {
      ...data,
      id: crypto.randomUUID(),
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const [refund] = await this.db
      .insert(paymentRefunds)
      .values(fullRefundData)
      .returning();

    return refund;
  }

  // Find refunds by payment ID
  async findRefundsByPaymentId(paymentId: string): Promise<PaymentRefund[]> {
    return this.db
      .select()
      .from(paymentRefunds)
      .where(eq(paymentRefunds.paymentId, paymentId))
      .orderBy(desc(paymentRefunds.createdAt));
  }

  // Find disputes by payment ID (placeholder for now)
  async findDisputesByPaymentId(paymentId: string): Promise<PaymentDispute[]> {
    // This would query a disputes table when it exists
    return [];
  }

  // Get payment analytics
  async getPaymentAnalytics(filters: PaymentFilters = {}): Promise<any> {
    // This would implement comprehensive analytics
    // For now, return basic stats
    const stats = await this.getPaymentStats(filters);

    return {
      totalAmount: stats.totalAmount,
      totalCount: stats.totalPayments,
      successRate:
        stats.totalPayments > 0
          ? ((stats.successfulPayments / stats.totalPayments) * 100).toFixed(2)
          : "0.00",
      averageAmount:
        stats.totalPayments > 0
          ? (parseFloat(stats.totalAmount) / stats.totalPayments).toFixed(2)
          : "0.00",
      breakdown: {
        successful: stats.successfulPayments,
        failed: stats.failedPayments,
        pending: stats.pendingPayments,
      },
    };
  }
}

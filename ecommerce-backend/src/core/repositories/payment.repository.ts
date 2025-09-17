/**
 * Payment repository
 * Handles all database operations for payments
 */

import { eq, and, desc, gte, lte } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { Database } from "../database/connection";
import {
  payments,
  Payment,
  NewPayment,
  paymentStatusEnum,
} from "../database/schema";

// Payment-specific types
export interface PaymentFilters {
  orderId?: string;
  status?: (typeof paymentStatusEnum.enumValues)[number];
  paymentMethod?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface CreatePaymentData
  extends Omit<NewPayment, "id" | "createdAt" | "updatedAt"> {}

export interface UpdatePaymentData
  extends Partial<Omit<Payment, "id" | "createdAt" | "updatedAt">> {}

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
      conditions.push(eq(payments.orderId, filters.orderId));
    }

    if (filters.status) {
      conditions.push(eq(payments.status, filters.status));
    }

    if (filters.paymentMethod) {
      conditions.push(eq(payments.paymentMethod, filters.paymentMethod));
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
}

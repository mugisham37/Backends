/**
 * Payment Types and Interfaces
 * Comprehensive type definitions for payment processing operations
 */

import { z } from "zod";
import type {
  Payment,
  NewPayment,
  PaymentTransaction,
  PaymentRefund,
  PaymentDispute,
  paymentMethodEnum,
  paymentsStatusEnum,
  paymentProviderEnum,
  transactionTypeEnum,
} from "../../../core/database/schema/payments.js";

// ========== RE-EXPORTED DATABASE TYPES ==========

// Re-export database types for GraphQL resolvers
export type { Payment, PaymentTransaction, PaymentRefund, PaymentDispute };

// ========== ENUMS ==========

export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number];
export type PaymentStatus = (typeof paymentsStatusEnum.enumValues)[number];
export type PaymentProvider = (typeof paymentProviderEnum.enumValues)[number];
export type TransactionType = (typeof transactionTypeEnum.enumValues)[number];

// ========== INTERFACES ==========

export interface PaymentFilters {
  orderId?: string | string[];
  userId?: string;
  vendorId?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  provider?: PaymentProvider;
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  searchTerm?: string;
}

export interface PaymentAnalytics {
  totalPayments: number;
  totalAmount: string;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  averageAmount: string;
  topMethods: Array<{
    method: PaymentMethod;
    count: number;
    totalAmount: string;
  }>;
  dailyStats: Array<{
    date: string;
    count: number;
    amount: string;
  }>;
}

export interface PaymentMethodConfig {
  provider: PaymentProvider;
  isEnabled: boolean;
  config: {
    [key: string]: any;
  };
  fees: {
    fixedFee: number;
    percentageFee: number;
    currency: string;
  };
}

export interface PaymentIntentData {
  amount: number;
  currency: string;
  orderId: string;
  customerId?: string;
  paymentMethod: PaymentMethod;
  returnUrl?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface PaymentWebhookData {
  provider: PaymentProvider;
  eventType: string;
  paymentId: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  metadata?: Record<string, any>;
  rawData: any;
}

// ========== INPUT/OUTPUT TYPES ==========

// Import Zod schemas for type inference
import type {
  createPaymentSchema,
  updatePaymentSchema,
  processPaymentSchema,
  refundPaymentSchema,
} from "./payment.validators.js";

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;

// Additional GraphQL Input Types
export interface PaymentFiltersInput {
  orderId?: string | string[];
  userId?: string;
  vendorId?: string;
  status?: PaymentStatus;
  method?: PaymentMethod;
  provider?: PaymentProvider;
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
  searchTerm?: string;
}

export interface PaymentSortInput {
  field: "createdAt" | "amount" | "status" | "method";
  direction: "ASC" | "DESC";
}

// PaymentWebhook type alias for GraphQL compatibility
export type PaymentWebhook = PaymentWebhookData;

// PaymentIntentResponse type
export interface PaymentIntentResponse {
  id: string;
  clientSecret?: string;
  status: PaymentStatus;
  requiresAction?: boolean;
  nextAction?: {
    type: string;
    redirectUrl?: string;
  };
  metadata?: Record<string, any>;
}

export interface PaymentOutput {
  id: string;
  orderId: string;
  vendorId: string;
  paymentNumber: string;
  externalId: string | null;
  method: PaymentMethod;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: string;
  currency: string;
  providerFee: string;
  applicationFee: string;
  netAmount: string;
  cardInfo: {
    last4?: string;
    brand?: string;
    expMonth?: number;
    expYear?: number;
    fingerprint?: string;
    funding?: string;
    country?: string;
  } | null;
  bankInfo: {
    accountType?: string;
    bankName?: string;
    routingNumber?: string;
    last4?: string;
    country?: string;
  } | null;
  walletInfo: {
    type?: string;
    fingerprint?: string;
  } | null;
  billingAddress: {
    firstName?: string;
    lastName?: string;
    company?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  } | null;
  providerResponse: {
    [key: string]: any;
  } | null;
  paymentIntentId: string | null;
  clientSecret: string | null;
  confirmationMethod: string | null;
  riskScore: string | null;
  riskLevel: string | null;
  fraudDetection: {
    provider?: string;
    score?: number;
    decision?: string;
    rules?: Array<{
      name: string;
      decision: string;
      score: number;
    }>;
  } | null;
  processedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  failureCode: string | null;
  metadata: {
    customerIp?: string;
    userAgent?: string;
    sessionId?: string;
    correlationId?: string;
    [key: string]: any;
  } | null;
  refundedAmount: string;
  refundableAmount: string | null;
  disputedAmount: string;
  disputeReason: string | null;
  settledAt: Date | null;
  settlementId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefundOutput {
  id: string;
  paymentId: string;
  orderId: string;
  refundNumber: string;
  externalRefundId: string | null;
  amount: string;
  currency: string | null;
  reason: string;
  status: PaymentStatus;
  type: string | null;
  processedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  providerResponse: {
    [key: string]: any;
  } | null;
  refundItems: Array<{
    orderItemId: string;
    productId: string;
    productName: string;
    quantity: number;
    amount: number;
    reason?: string;
  }> | null;
  processedByUserId: string | null;
  adminNotes: string | null;
  customerNotified: boolean | null;
  customerNotificationSentAt: Date | null;
  metadata: {
    [key: string]: any;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

// ========== ERROR TYPES ==========

export enum PaymentErrorCodes {
  PAYMENT_NOT_FOUND = "PAYMENT_NOT_FOUND",
  ORDER_NOT_FOUND = "ORDER_NOT_FOUND",
  INVALID_PAYMENT_METHOD = "INVALID_PAYMENT_METHOD",
  INVALID_REQUEST = "INVALID_REQUEST",
  PAYMENT_ALREADY_PROCESSED = "PAYMENT_ALREADY_PROCESSED",
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  PAYMENT_DECLINED = "PAYMENT_DECLINED",
  PROVIDER_ERROR = "PROVIDER_ERROR",
  WEBHOOK_VERIFICATION_FAILED = "WEBHOOK_VERIFICATION_FAILED",
  REFUND_NOT_ALLOWED = "REFUND_NOT_ALLOWED",
  REFUND_AMOUNT_EXCEEDS_AVAILABLE = "REFUND_AMOUNT_EXCEEDS_AVAILABLE",
  DUPLICATE_PAYMENT = "DUPLICATE_PAYMENT",
  CURRENCY_NOT_SUPPORTED = "CURRENCY_NOT_SUPPORTED",
  PAYMENT_METHOD_NOT_SUPPORTED = "PAYMENT_METHOD_NOT_SUPPORTED",
}

export class PaymentError extends Error {
  constructor(
    message: string,
    public code: PaymentErrorCodes,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

// ========== PROVIDER INTERFACES ==========

export interface PaymentProviderInterface {
  createPaymentIntent(data: PaymentIntentData): Promise<{
    id: string;
    clientSecret?: string;
    status: string;
    metadata?: Record<string, any>;
  }>;

  processPayment(data: ProcessPaymentInput): Promise<{
    status: PaymentStatus;
    transactionId?: string;
    metadata?: Record<string, any>;
  }>;

  refundPayment(data: RefundPaymentInput): Promise<{
    refundId: string;
    status: string;
    amount: number;
    metadata?: Record<string, any>;
  }>;

  webhookVerification(payload: string, signature: string): boolean;

  parseWebhookData(payload: any): PaymentWebhookData;
}

// ========== ADVANCED FEATURES ==========

export interface PaymentSecurityConfig {
  maxAttempts: number;
  cooldownPeriod: number;
  fraudThreshold: number;
  requiresVerification: boolean;
  allowedCountries?: string[];
  blockedCountries?: string[];
}

export interface PaymentReporting {
  period: "day" | "week" | "month" | "year";
  startDate: Date;
  endDate: Date;
  groupBy?: "method" | "provider" | "status";
  includeRefunds?: boolean;
}

export interface PaymentSubscription {
  id: string;
  customerId: string;
  planId: string;
  status: "active" | "cancelled" | "past_due" | "incomplete";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

// ========== CONFIGURATION ==========

export interface PaymentModuleConfig {
  defaultCurrency: string;
  supportedCurrencies: string[];
  providers: {
    [key in PaymentProvider]?: PaymentMethodConfig;
  };
  security: PaymentSecurityConfig;
  fees: {
    defaultApplicationFeePercentage: number;
    minimumApplicationFee: number;
  };
  features: {
    enableRefunds: boolean;
    enablePartialRefunds: boolean;
    enableDisputes: boolean;
    enableSubscriptions: boolean;
    enableMultiCurrency: boolean;
  };
}

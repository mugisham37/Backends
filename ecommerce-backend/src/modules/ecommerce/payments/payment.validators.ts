/**
 * Payment Validators
 * Comprehensive Zod validation schemas for payment operations
 */

import { z } from "zod";
import {
  paymentMethodEnum,
  paymentsStatusEnum,
  paymentProviderEnum,
} from "../../../core/database/schema/payments.js";

// ========== BASE SCHEMAS ==========

const paymentMethodSchema = z.enum(
  paymentMethodEnum.enumValues as [string, ...string[]]
);
const paymentStatusSchema = z.enum(
  paymentsStatusEnum.enumValues as [string, ...string[]]
);
const paymentProviderSchema = z.enum(
  paymentProviderEnum.enumValues as [string, ...string[]]
);

const currencySchema = z
  .string()
  .length(3, "Currency must be a 3-letter ISO code")
  .toUpperCase();
const amountSchema = z
  .number()
  .positive("Amount must be positive")
  .max(999999.99, "Amount exceeds maximum limit");

// ========== ADDRESS SCHEMA ==========

const billingAddressSchema = z
  .object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    company: z.string().max(100).optional(),
    address1: z.string().min(1).max(255),
    address2: z.string().max(255).optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(100),
    postalCode: z.string().min(1).max(20),
    country: z
      .string()
      .length(2, "Country must be a 2-letter ISO code")
      .toUpperCase(),
    phone: z
      .string()
      .regex(/^\+?[\d\s-()]+$/, "Invalid phone number format")
      .optional(),
  })
  .strict();

// ========== PAYMENT SCHEMAS ==========

export const createPaymentSchema = z
  .object({
    orderId: z.string().uuid("Invalid order ID format"),
    method: paymentMethodSchema,
    provider: paymentProviderSchema,
    amount: amountSchema,
    currency: currencySchema.default("USD"),
    paymentIntentId: z.string().min(1).max(255).optional(),
    billingAddress: billingAddressSchema.optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict();

export const updatePaymentSchema = z
  .object({
    status: paymentStatusSchema.optional(),
    providerResponse: z.record(z.any()).optional(),
    failureReason: z.string().max(255).optional(),
    failureCode: z.string().max(50).optional(),
    riskScore: z.number().min(0).max(100).optional(),
    riskLevel: z.enum(["low", "medium", "high"]).optional(),
    processedAt: z.coerce.date().optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict();

export const processPaymentSchema = z
  .object({
    paymentId: z.string().uuid("Invalid payment ID format"),
    paymentMethodDetails: z
      .object({
        type: z.string().min(1),
      })
      .passthrough()
      .optional(),
    clientSecret: z.string().min(1).optional(),
    returnUrl: z.string().url("Invalid return URL").optional(),
  })
  .strict();

export const refundPaymentSchema = z
  .object({
    paymentId: z.string().uuid("Invalid payment ID format"),
    amount: z.number().positive("Refund amount must be positive").optional(),
    reason: z.string().min(1).max(500).optional(),
    metadata: z.record(z.any()).optional(),
  })
  .strict();

// ========== QUERY SCHEMAS ==========

export const paymentFiltersSchema = z
  .object({
    orderId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    status: paymentStatusSchema.optional(),
    method: paymentMethodSchema.optional(),
    provider: paymentProviderSchema.optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    amountMin: z.number().positive().optional(),
    amountMax: z.number().positive().optional(),
    searchTerm: z.string().min(1).max(100).optional(),
  })
  .strict();

export const paymentPaginationSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    sortBy: z
      .enum(["createdAt", "updatedAt", "amount", "status"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export const paymentListSchema = z
  .object({
    filters: paymentFiltersSchema.optional(),
    pagination: paymentPaginationSchema.optional(),
  })
  .strict();

// ========== WEBHOOK SCHEMAS ==========

export const webhookDataSchema = z
  .object({
    provider: paymentProviderSchema,
    eventType: z.string().min(1),
    paymentId: z.string().min(1),
    status: paymentStatusSchema,
    amount: z.number().positive(),
    currency: currencySchema,
    metadata: z.record(z.any()).optional(),
    rawData: z.any(),
  })
  .strict();

// ========== STRIPE SPECIFIC SCHEMAS ==========

export const stripeWebhookSchema = z
  .object({
    id: z.string(),
    object: z.literal("event"),
    api_version: z.string(),
    created: z.number(),
    data: z.object({
      object: z.any(),
    }),
    livemode: z.boolean(),
    pending_webhooks: z.number(),
    request: z.object({
      id: z.string().nullable(),
      idempotency_key: z.string().nullable(),
    }),
    type: z.string(),
  })
  .strict();

export const stripePaymentIntentSchema = z
  .object({
    amount: z.number().positive(),
    currency: currencySchema,
    orderId: z.string().uuid(),
    customerId: z.string().optional(),
    paymentMethodTypes: z.array(z.string()).default(["card"]),
    captureMethod: z.enum(["automatic", "manual"]).default("automatic"),
    confirmationMethod: z.enum(["automatic", "manual"]).default("automatic"),
    returnUrl: z.string().url().optional(),
    description: z.string().max(500).optional(),
    metadata: z.record(z.string()).optional(),
  })
  .strict();

// ========== PAYPAL SPECIFIC SCHEMAS ==========

export const paypalOrderSchema = z
  .object({
    intent: z.enum(["CAPTURE", "AUTHORIZE"]).default("CAPTURE"),
    amount: z.number().positive(),
    currency: currencySchema,
    orderId: z.string().uuid(),
    returnUrl: z.string().url(),
    cancelUrl: z.string().url(),
    description: z.string().max(127).optional(),
  })
  .strict();

// ========== ANALYTICS SCHEMAS ==========

export const paymentReportingSchema = z
  .object({
    period: z.enum(["day", "week", "month", "year"]),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    groupBy: z.enum(["method", "provider", "status"]).optional(),
    includeRefunds: z.boolean().default(false),
  })
  .strict()
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

// ========== CONFIGURATION SCHEMAS ==========

export const paymentConfigSchema = z
  .object({
    defaultCurrency: currencySchema,
    supportedCurrencies: z.array(currencySchema).min(1),
    providers: z.record(
      paymentProviderSchema,
      z.object({
        isEnabled: z.boolean(),
        config: z.record(z.any()),
        fees: z.object({
          fixedFee: z.number().min(0),
          percentageFee: z.number().min(0).max(100),
          currency: currencySchema,
        }),
      })
    ),
    security: z.object({
      maxAttempts: z.number().int().positive().max(10),
      cooldownPeriod: z.number().int().positive(), // in minutes
      fraudThreshold: z.number().min(0).max(100),
      requiresVerification: z.boolean(),
      allowedCountries: z.array(z.string().length(2)).optional(),
      blockedCountries: z.array(z.string().length(2)).optional(),
    }),
    fees: z.object({
      defaultApplicationFeePercentage: z.number().min(0).max(100),
      minimumApplicationFee: z.number().min(0),
    }),
    features: z.object({
      enableRefunds: z.boolean(),
      enablePartialRefunds: z.boolean(),
      enableDisputes: z.boolean(),
      enableSubscriptions: z.boolean(),
      enableMultiCurrency: z.boolean(),
    }),
  })
  .strict();

// ========== TYPE EXPORTS ==========
// ========== INFERRED TYPES FROM SCHEMAS ==========

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
export type PaymentFilters = z.infer<typeof paymentFiltersSchema>;
export type PaymentPagination = z.infer<typeof paymentPaginationSchema>;
export type PaymentListQuery = z.infer<typeof paymentListSchema>;
export type WebhookData = z.infer<typeof webhookDataSchema>;
export type StripeWebhookEvent = z.infer<typeof stripeWebhookSchema>;
export type StripePaymentIntent = z.infer<typeof stripePaymentIntentSchema>;
export type PayPalOrder = z.infer<typeof paypalOrderSchema>;
export type PaymentReporting = z.infer<typeof paymentReportingSchema>;
export type PaymentConfig = z.infer<typeof paymentConfigSchema>;
export type BillingAddress = z.infer<typeof billingAddressSchema>;

// ========== VALIDATION HELPERS ==========

export const validatePaymentAmount = (
  amount: number,
  currency: string = "USD"
): boolean => {
  // Minimum amounts by currency (in smallest unit)
  const minimumAmounts: Record<string, number> = {
    USD: 0.5,
    EUR: 0.5,
    GBP: 0.3,
    JPY: 50,
    // Add more currencies as needed
  };

  const minimum = minimumAmounts[currency] || 0.5;
  return amount >= minimum;
};

export const validateCurrencySupport = (
  currency: string,
  supportedCurrencies: string[]
): boolean => {
  return supportedCurrencies.includes(currency.toUpperCase());
};

export const validateRefundAmount = (
  refundAmount: number,
  originalAmount: number,
  refundedAmount: number
): boolean => {
  const availableForRefund = originalAmount - refundedAmount;
  return refundAmount > 0 && refundAmount <= availableForRefund;
};

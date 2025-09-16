import { z } from "zod";

// Base schemas
const uuidSchema = z.string().uuid("Invalid UUID format");

// Order status and payment status enums
const orderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
  "returned",
]);

const paymentStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
]);

const shippingMethodSchema = z.enum([
  "standard",
  "express",
  "overnight",
  "pickup",
  "digital",
]);

const fulfillmentStatusSchema = z.enum([
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

// Address schema for orders
const orderAddressSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  company: z.string().max(100).optional(),
  street: z.string().min(1, "Street address is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  country: z.string().min(2, "Country is required").max(3),
  phone: z
    .string()
    .regex(/^\+?[\d\s-()]+$/, "Invalid phone number format")
    .optional(),
});

// Order item schema
const orderItemSchema = z.object({
  productId: uuidSchema,
  variantId: uuidSchema.optional(),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  price: z.number().min(0, "Price must be non-negative"),
  originalPrice: z.number().min(0).optional(),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  metadata: z.record(z.any()).default({}),
});

// Shipping details schema
const shippingDetailsSchema = z.object({
  method: shippingMethodSchema,
  carrier: z.string().max(100).optional(),
  trackingNumber: z.string().max(100).optional(),
  estimatedDelivery: z.date().optional(),
  cost: z.number().min(0).default(0),
  weight: z.number().min(0).optional(),
  dimensions: z
    .object({
      length: z.number().min(0),
      width: z.number().min(0),
      height: z.number().min(0),
      unit: z.enum(["cm", "in"]).default("cm"),
    })
    .optional(),
});

// Payment details schema
const paymentDetailsSchema = z.object({
  method: z.enum([
    "credit_card",
    "debit_card",
    "paypal",
    "stripe",
    "bank_transfer",
    "cash",
    "other",
  ]),
  transactionId: z.string().max(100).optional(),
  gateway: z.string().max(50).optional(),
  gatewayTransactionId: z.string().max(100).optional(),
  last4: z.string().length(4).optional(),
  brand: z.string().max(50).optional(),
  metadata: z.record(z.any()).default({}),
});

// Discount/coupon schema
const discountSchema = z.object({
  code: z.string().max(50).optional(),
  type: z.enum(["percentage", "fixed", "free_shipping"]),
  value: z.number().min(0),
  description: z.string().max(200).optional(),
});

// Create order schema
export const createOrderSchema = z.object({
  customerId: uuidSchema.optional(), // Optional for guest orders
  customerEmail: z.string().email("Invalid email format"),
  items: z.array(orderItemSchema).min(1, "At least one item is required"),
  billingAddress: orderAddressSchema,
  shippingAddress: orderAddressSchema,
  shippingDetails: shippingDetailsSchema,
  paymentDetails: paymentDetailsSchema.optional(),
  discounts: z.array(discountSchema).default([]),
  notes: z.string().max(1000).optional(),
  currency: z.string().length(3).default("USD"),
  taxRate: z.number().min(0).max(1).default(0),
  metadata: z.record(z.any()).default({}),
});

// Update order schema
export const updateOrderSchema = z.object({
  status: orderStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  fulfillmentStatus: fulfillmentStatusSchema.optional(),
  shippingDetails: shippingDetailsSchema.partial().optional(),
  notes: z.string().max(1000).optional(),
  internalNotes: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
});

// Order filters schema
export const orderFiltersSchema = z.object({
  search: z.string().max(100).optional(), // Search by order number, customer email, etc.
  customerId: uuidSchema.optional(),
  vendorId: uuidSchema.optional(),
  status: orderStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  fulfillmentStatus: fulfillmentStatusSchema.optional(),
  shippingMethod: shippingMethodSchema.optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  currency: z.string().length(3).optional(),
  sortBy: z
    .enum(["orderNumber", "createdAt", "updatedAt", "totalAmount", "status"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// Fulfillment schema
export const createFulfillmentSchema = z.object({
  orderId: uuidSchema,
  items: z
    .array(
      z.object({
        orderItemId: uuidSchema,
        quantity: z.number().int().min(1),
      })
    )
    .min(1),
  trackingNumber: z.string().max(100).optional(),
  carrier: z.string().max(100).optional(),
  shippingMethod: shippingMethodSchema,
  notes: z.string().max(500).optional(),
});

export const updateFulfillmentSchema = z.object({
  status: fulfillmentStatusSchema,
  trackingNumber: z.string().max(100).optional(),
  carrier: z.string().max(100).optional(),
  deliveredAt: z.date().optional(),
  notes: z.string().max(500).optional(),
});

// Refund schema
export const createRefundSchema = z.object({
  orderId: uuidSchema,
  amount: z.number().min(0.01, "Refund amount must be greater than 0"),
  reason: z.enum([
    "customer_request",
    "defective_product",
    "wrong_item",
    "not_as_described",
    "damaged_in_shipping",
    "other",
  ]),
  description: z.string().max(1000).optional(),
  refundShipping: z.boolean().default(false),
  restockItems: z.boolean().default(true),
  notifyCustomer: z.boolean().default(true),
  items: z
    .array(
      z.object({
        orderItemId: uuidSchema,
        quantity: z.number().int().min(1),
        amount: z.number().min(0),
      })
    )
    .optional(),
});

// Return schema
export const createReturnSchema = z.object({
  orderId: uuidSchema,
  items: z
    .array(
      z.object({
        orderItemId: uuidSchema,
        quantity: z.number().int().min(1),
        reason: z.enum([
          "defective",
          "wrong_size",
          "wrong_color",
          "not_as_described",
          "damaged",
          "changed_mind",
          "other",
        ]),
        condition: z.enum(["new", "used", "damaged"]),
        notes: z.string().max(500).optional(),
      })
    )
    .min(1),
  returnAddress: orderAddressSchema.optional(),
  customerNotes: z.string().max(1000).optional(),
});

export const updateReturnSchema = z.object({
  status: z.enum([
    "pending",
    "approved",
    "rejected",
    "received",
    "processed",
    "completed",
  ]),
  adminNotes: z.string().max(1000).optional(),
  refundAmount: z.number().min(0).optional(),
  restockItems: z.boolean().optional(),
});

// Bulk operations
export const bulkUpdateOrdersSchema = z.object({
  orderIds: z.array(uuidSchema).min(1).max(100),
  updates: z.object({
    status: orderStatusSchema.optional(),
    fulfillmentStatus: fulfillmentStatusSchema.optional(),
    tags: z.array(z.string()).optional(),
  }),
});

// Order analytics schema
export const orderAnalyticsSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  vendorId: uuidSchema.optional(),
  groupBy: z.enum(["day", "week", "month"]).default("day"),
  metrics: z
    .array(
      z.enum(["revenue", "orders", "items", "customers", "average_order_value"])
    )
    .default(["revenue", "orders"]),
});

// Type exports
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type OrderFilters = z.infer<typeof orderFiltersSchema>;
export type CreateFulfillmentInput = z.infer<typeof createFulfillmentSchema>;
export type UpdateFulfillmentInput = z.infer<typeof updateFulfillmentSchema>;
export type CreateRefundInput = z.infer<typeof createRefundSchema>;
export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type UpdateReturnInput = z.infer<typeof updateReturnSchema>;
export type BulkUpdateOrdersInput = z.infer<typeof bulkUpdateOrdersSchema>;
export type OrderAnalyticsInput = z.infer<typeof orderAnalyticsSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type FulfillmentStatus = z.infer<typeof fulfillmentStatusSchema>;
export type ShippingMethod = z.infer<typeof shippingMethodSchema>;

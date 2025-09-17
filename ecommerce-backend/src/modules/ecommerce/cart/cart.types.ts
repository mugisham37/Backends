/**
 * Cart types and interfaces
 * Type definitions for cart operations
 */

import { z } from "zod";
import {
  Cart,
  CartItem,
  CartSavedItem,
} from "../../../core/database/schema/cart";

// ========== INPUT TYPES ==========

// Add item to cart input
export interface AddCartItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  selectedAttributes?: Record<string, string | number>;
  customizations?: {
    personalizedText?: string;
    giftWrap?: boolean;
    giftMessage?: string;
    deliveryInstructions?: string;
    [key: string]: any;
  };
  notes?: string;
}

// Update cart item input
export interface UpdateCartItemInput {
  quantity?: number;
  selectedAttributes?: Record<string, string | number>;
  customizations?: {
    personalizedText?: string;
    giftWrap?: boolean;
    giftMessage?: string;
    deliveryInstructions?: string;
    [key: string]: any;
  };
  notes?: string;
}

// Update cart input
export interface UpdateCartInput {
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: {
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
  };
  shippingMethod?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

// Apply coupon input
export interface ApplyCouponInput {
  couponCode: string;
}

// Save item for later input
export interface SaveForLaterInput {
  itemId: string;
  reason?: string;
  notes?: string;
}

// Cart conversion input
export interface ConvertCartInput {
  cartId: string;
  orderId: string;
}

// ========== OUTPUT TYPES ==========

// Cart item output with enhanced product information
export interface CartItemOutput {
  id: string;
  cartId: string;
  productId: string;
  variantId?: string;
  vendorId: string;

  // Product snapshot
  productName: string;
  productSlug?: string;
  productSku?: string;
  variantTitle?: string;
  productImage?: string;

  // Pricing
  price: string;
  compareAtPrice?: string;
  quantity: number;
  subtotal: string;

  // Customizations
  selectedAttributes?: Record<string, string | number>;
  customizations?: Record<string, any>;
  notes?: string;

  // Product information
  product?: {
    name: string;
    slug: string;
    status: string;
    images: string[];
    isAvailable: boolean;
    currentPrice: string;
    inStock: boolean;
    stockQuantity: number;
  };

  // Variant information
  variant?: {
    title: string;
    options: Record<string, string>;
    isActive: boolean;
    isAvailable: boolean;
    currentPrice: string;
  };

  // Vendor information
  vendor?: {
    id: string;
    businessName: string;
    status: string;
    isActive: boolean;
  };

  // Timestamps
  addedAt: Date;
  updatedAt: Date;
}

// Saved item output
export interface SavedItemOutput {
  id: string;
  cartId: string;
  originalCartItemId?: string;

  // Product information
  productId: string;
  variantId?: string;
  vendorId: string;
  productName: string;
  productSlug?: string;
  productImage?: string;

  // Saved details
  price: string;
  quantity: number;
  selectedAttributes?: Record<string, string | number>;
  savedReason?: string;
  notes?: string;

  // Product availability
  product?: {
    isAvailable: boolean;
    currentPrice: string;
    inStock: boolean;
  };

  // Timestamps
  savedAt: Date;
  updatedAt: Date;
}

// Cart summary output
export interface CartSummaryOutput {
  itemCount: number;
  totalQuantity: number;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  shippingAmount: string;
  total: string;
  currency: string;

  // Applied discounts
  appliedCoupons: Array<{
    code: string;
    discountAmount: number;
    discountType: "percentage" | "fixed";
    appliedAt: string;
  }>;

  // Vendor breakdown
  vendorBreakdown?: Array<{
    vendorId: string;
    vendorName: string;
    itemCount: number;
    subtotal: string;
    items: string[]; // item IDs
  }>;
}

// Main cart output
export interface CartOutput {
  id: string;
  userId?: string;
  sessionId?: string;

  // Cart properties
  type: "shopping" | "wishlist" | "saved_for_later";
  status: "active" | "abandoned" | "converted" | "expired";
  currency: string;

  // Customer information
  customerEmail?: string;
  customerPhone?: string;

  // Shipping information
  shippingAddress?: {
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
  };
  shippingMethod?: string;
  shippingRate?: string;

  // Cart summary
  summary: CartSummaryOutput;

  // Items
  items: CartItemOutput[];
  savedItems?: SavedItemOutput[];

  // Cart metadata
  notes?: string;
  metadata?: Record<string, any>;

  // Conversion tracking
  convertedOrderId?: string;
  convertedAt?: Date;

  // Timestamps
  expiresAt?: Date;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ========== ANALYTICS TYPES ==========

export interface CartAnalytics {
  // General metrics
  totalCarts: number;
  activeCarts: number;
  abandonedCarts: number;
  convertedCarts: number;

  // Value metrics
  totalValue: number;
  averageCartValue: number;
  averageItemsPerCart: number;

  // Conversion metrics
  conversionRate: number;
  abandonmentRate: number;

  // Time-based metrics
  averageTimeInCart: number; // in minutes

  // Top products in carts
  topProducts: Array<{
    productId: string;
    productName: string;
    timesAdded: number;
    totalQuantity: number;
    conversionRate: number;
  }>;

  // Cart by device/source
  bySource: Array<{
    source: string;
    cartCount: number;
    conversionRate: number;
  }>;
}

// ========== ERROR TYPES ==========

export interface CartError {
  code: string;
  message: string;
  details?: any;
}

export const CartErrorCodes = {
  CART_NOT_FOUND: "CART_NOT_FOUND",
  ITEM_NOT_FOUND: "ITEM_NOT_FOUND",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  PRODUCT_UNAVAILABLE: "PRODUCT_UNAVAILABLE",
  VARIANT_NOT_FOUND: "VARIANT_NOT_FOUND",
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  INVALID_QUANTITY: "INVALID_QUANTITY",
  VENDOR_INACTIVE: "VENDOR_INACTIVE",
  CART_EXPIRED: "CART_EXPIRED",
  CART_ALREADY_CONVERTED: "CART_ALREADY_CONVERTED",
  COUPON_INVALID: "COUPON_INVALID",
  COUPON_EXPIRED: "COUPON_EXPIRED",
  COUPON_ALREADY_APPLIED: "COUPON_ALREADY_APPLIED",
  MAXIMUM_QUANTITY_EXCEEDED: "MAXIMUM_QUANTITY_EXCEEDED",
} as const;

// ========== FILTER TYPES ==========

export interface CartListFilters {
  userId?: string;
  sessionId?: string;
  status?: ("active" | "abandoned" | "converted" | "expired")[];
  type?: ("shopping" | "wishlist" | "saved_for_later")[];
  hasItems?: boolean;
  valueRange?: {
    min: number;
    max: number;
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  lastActivityRange?: {
    start: Date;
    end: Date;
  };
}

export interface CartItemFilters {
  cartId?: string;
  productId?: string;
  vendorId?: string;
  priceRange?: {
    min: number;
    max: number;
  };
  addedDateRange?: {
    start: Date;
    end: Date;
  };
}

// ========== VALIDATION SCHEMAS ==========

export const addCartItemSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  variantId: z.string().uuid("Invalid variant ID").optional(),
  quantity: z
    .number()
    .int()
    .min(1, "Quantity must be at least 1")
    .max(100, "Maximum quantity is 100"),
  selectedAttributes: z.record(z.union([z.string(), z.number()])).optional(),
  customizations: z
    .object({
      personalizedText: z.string().max(500).optional(),
      giftWrap: z.boolean().optional(),
      giftMessage: z.string().max(500).optional(),
      deliveryInstructions: z.string().max(1000).optional(),
    })
    .passthrough()
    .optional(),
  notes: z.string().max(1000).optional(),
});

export const updateCartItemSchema = z.object({
  quantity: z
    .number()
    .int()
    .min(1, "Quantity must be at least 1")
    .max(100, "Maximum quantity is 100")
    .optional(),
  selectedAttributes: z.record(z.union([z.string(), z.number()])).optional(),
  customizations: z
    .object({
      personalizedText: z.string().max(500).optional(),
      giftWrap: z.boolean().optional(),
      giftMessage: z.string().max(500).optional(),
      deliveryInstructions: z.string().max(1000).optional(),
    })
    .passthrough()
    .optional(),
  notes: z.string().max(1000).optional(),
});

export const updateCartSchema = z.object({
  customerEmail: z.string().email("Invalid email format").optional(),
  customerPhone: z
    .string()
    .regex(/^\+?[\d\s-()]+$/, "Invalid phone format")
    .optional(),
  shippingAddress: z
    .object({
      firstName: z.string().min(1).max(50).optional(),
      lastName: z.string().min(1).max(50).optional(),
      company: z.string().max(100).optional(),
      address1: z.string().min(1).max(200).optional(),
      address2: z.string().max(200).optional(),
      city: z.string().min(1).max(100).optional(),
      state: z.string().min(1).max(100).optional(),
      postalCode: z.string().min(1).max(20).optional(),
      country: z.string().min(2).max(3).optional(),
      phone: z
        .string()
        .regex(/^\+?[\d\s-()]+$/)
        .optional(),
    })
    .optional(),
  shippingMethod: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
});

export const applyCouponSchema = z.object({
  couponCode: z.string().min(1, "Coupon code is required").max(50),
});

export const saveForLaterSchema = z.object({
  itemId: z.string().uuid("Invalid item ID"),
  reason: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

// Type exports for validation
export type AddCartItemInput_Validated = z.infer<typeof addCartItemSchema>;
export type UpdateCartItemInput_Validated = z.infer<
  typeof updateCartItemSchema
>;
export type UpdateCartInput_Validated = z.infer<typeof updateCartSchema>;
export type ApplyCouponInput_Validated = z.infer<typeof applyCouponSchema>;
export type SaveForLaterInput_Validated = z.infer<typeof saveForLaterSchema>;

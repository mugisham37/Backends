/**
 * Order service types
 * Input/Output DTOs for clean interfaces
 */

import {
  orderStatusEnum,
  paymentStatusEnum,
  shippingStatusEnum,
  Payment,
} from "../../../core/database/schema";

// Input types
export interface OrderItemInput {
  productId: string;
  variantId?: string;
  variantTitle?: string;
  quantity: number;
}

export interface CreateOrderInput {
  userId?: string;
  customerEmail: string;
  customerPhone?: string;
  items: OrderItemInput[];
  taxAmount?: number;
  shippingAmount?: number;
  discountAmount?: number;
  currency?: string;
  billingAddress: {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  shippingAddress: {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  shippingMethod?: string;
  customerNotes?: string;
  metadata?: {
    source?: string;
    utm?: {
      source?: string;
      medium?: string;
      campaign?: string;
    };
    [key: string]: any;
  };
}

export interface UpdateOrderInput {
  customerPhone?: string;
  billingAddress?: {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  shippingAddress?: {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  shippingMethod?: string;
  customerNotes?: string;
  adminNotes?: string;
}

// Output types
export interface OrderItemOutput {
  id: string;
  productId: string;
  variantId: string | null;
  vendorId: string;
  productName: string;
  productSku: string | null;
  variantTitle: string | null;
  price: number;
  quantity: number;
  total: number;
  productSnapshot?: {
    name: string;
    description?: string;
    image?: string;
    attributes?: { [key: string]: any };
  };
  product: {
    id: string;
    name: string;
    slug: string;
  };
  vendor: {
    id: string;
    businessName: string;
  };
}

export interface OrderOutput {
  id: string;
  orderNumber: string;
  userId: string | null;
  customerEmail: string;
  customerPhone: string | null;
  status: (typeof orderStatusEnum.enumValues)[number];
  paymentStatus: (typeof paymentStatusEnum.enumValues)[number];
  shippingStatus: (typeof shippingStatusEnum.enumValues)[number];
  subtotal: number;
  taxAmount: number;
  shippingAmount: number;
  discountAmount: number;
  total: number;
  currency: string;
  billingAddress: {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  shippingAddress: {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
  };
  shippingMethod: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  customerNotes: string | null;
  adminNotes: string | null;
  metadata?: {
    source?: string;
    utm?: {
      source?: string;
      medium?: string;
      campaign?: string;
    };
    [key: string]: any;
  };
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItemOutput[];
  payments: Payment[];
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

/**
 * Product service types
 * Input/Output DTOs for clean interfaces
 */

import {
  productStatusEnum,
  productConditionEnum,
} from "../../../core/database/schema";

// Input types
export interface CreateProductInput {
  categoryId?: string;
  name: string;
  description?: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  sku?: string;
  barcode?: string;
  trackQuantity?: boolean;
  quantity?: number;
  lowStockThreshold?: number;
  weight?: number;
  weightUnit?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  };
  condition?: (typeof productConditionEnum.enumValues)[number];
  images?: string[];
  metaTitle?: string;
  metaDescription?: string;
  attributes?: { [key: string]: string | number | boolean };
  requiresShipping?: boolean;
  shippingClass?: string;
  taxable?: boolean;
  taxClass?: string;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  shortDescription?: string;
  price?: number;
  compareAtPrice?: number;
  quantity?: number;
  lowStockThreshold?: number;
  weight?: number;
  weightUnit?: string;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  };
  images?: string[];
  metaTitle?: string;
  metaDescription?: string;
  attributes?: { [key: string]: string | number | boolean };
}

// Output types
export interface ProductOutput {
  id: string;
  vendorId: string;
  categoryId: string | null;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  price: number;
  compareAtPrice?: number;
  sku: string | null;
  barcode: string | null;
  trackQuantity: boolean;
  quantity: number;
  lowStockThreshold: number;
  weight?: number;
  weightUnit: string | null;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: string;
  };
  status: (typeof productStatusEnum.enumValues)[number];
  condition: (typeof productConditionEnum.enumValues)[number] | null;
  featured: boolean;
  images: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  attributes?: { [key: string]: string | number | boolean };
  hasVariants: boolean;
  requiresShipping: boolean;
  shippingClass: string | null;
  taxable: boolean;
  taxClass: string | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Optional relations
  vendor?: {
    id: string;
    businessName: string;
    slug: string;
  };
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  variants?: Array<{
    id: string;
    title: string;
    price: string | null;
    quantity: number;
    isActive: boolean;
  }>;
}

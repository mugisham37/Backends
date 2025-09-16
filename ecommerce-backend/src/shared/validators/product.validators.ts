import { z } from "zod";

// Base schemas
const uuidSchema = z.string().uuid("Invalid UUID format");
const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format");

// Product status and visibility enums
const productStatusSchema = z.enum(["draft", "active", "inactive", "archived"]);
const productVisibilitySchema = z.enum(["public", "private", "hidden"]);
const productTypeSchema = z.enum(["physical", "digital", "service"]);

// Inventory tracking schema
const inventorySchema = z.object({
  trackQuantity: z.boolean().default(true),
  quantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(10),
  allowBackorders: z.boolean().default(false),
  sku: z.string().min(1).max(100).optional(),
  barcode: z.string().max(100).optional(),
});

// SEO schema
const seoSchema = z.object({
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  keywords: z.array(z.string()).max(10).default([]),
  canonicalUrl: z.string().url().optional(),
});

// Pricing schema
const pricingSchema = z.object({
  price: z.number().min(0, "Price must be non-negative"),
  compareAtPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  taxable: z.boolean().default(true),
});

// Dimensions and shipping schema
const dimensionsSchema = z.object({
  weight: z.number().min(0).optional(),
  length: z.number().min(0).optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  weightUnit: z.enum(["kg", "lb", "g", "oz"]).default("kg"),
  dimensionUnit: z.enum(["cm", "in", "m", "ft"]).default("cm"),
});

// Product variant schema
const variantSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().min(1).max(100),
  sku: z.string().max(100).optional(),
  price: z.number().min(0),
  compareAtPrice: z.number().min(0).optional(),
  inventory: inventorySchema,
  attributes: z.record(z.string()).default({}),
  images: z.array(z.string().url()).max(10).default([]),
  active: z.boolean().default(true),
});

// Create product schema
export const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(200),
  slug: slugSchema.optional(),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(5000),
  shortDescription: z.string().max(500).optional(),
  vendorId: uuidSchema,
  categoryId: uuidSchema,
  type: productTypeSchema.default("physical"),
  status: productStatusSchema.default("draft"),
  visibility: productVisibilitySchema.default("public"),
  pricing: pricingSchema,
  inventory: inventorySchema,
  dimensions: dimensionsSchema.optional(),
  images: z
    .array(z.string().url())
    .min(1, "At least one image is required")
    .max(20),
  variants: z.array(variantSchema).max(50).default([]),
  tags: z.array(z.string().max(50)).max(20).default([]),
  seo: seoSchema.optional(),
  customFields: z.record(z.any()).default({}),
  publishedAt: z.date().optional(),
});

// Update product schema
export const updateProductSchema = createProductSchema.partial().omit({
  vendorId: true,
});

// Product query filters
export const productFiltersSchema = z.object({
  search: z.string().max(100).optional(),
  categoryId: uuidSchema.optional(),
  vendorId: uuidSchema.optional(),
  status: productStatusSchema.optional(),
  visibility: productVisibilitySchema.optional(),
  type: productTypeSchema.optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  inStock: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z
    .enum(["name", "price", "createdAt", "updatedAt", "popularity", "rating"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// Product review schema
export const createReviewSchema = z.object({
  productId: uuidSchema,
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(100),
  comment: z.string().min(10).max(2000),
  images: z.array(z.string().url()).max(5).default([]),
  verified: z.boolean().default(false),
});

export const updateReviewSchema = createReviewSchema
  .omit({ productId: true })
  .partial();

// Bulk operations
export const bulkUpdateProductsSchema = z.object({
  productIds: z.array(uuidSchema).min(1).max(100),
  updates: z.object({
    status: productStatusSchema.optional(),
    visibility: productVisibilitySchema.optional(),
    categoryId: uuidSchema.optional(),
    tags: z.array(z.string()).optional(),
  }),
});

export const bulkDeleteProductsSchema = z.object({
  productIds: z.array(uuidSchema).min(1).max(100),
});

// Import/Export schemas
export const importProductsSchema = z.object({
  products: z.array(createProductSchema).min(1).max(1000),
  overwriteExisting: z.boolean().default(false),
});

// Type exports
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFilters = z.infer<typeof productFiltersSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type BulkUpdateProductsInput = z.infer<typeof bulkUpdateProductsSchema>;
export type BulkDeleteProductsInput = z.infer<typeof bulkDeleteProductsSchema>;
export type ImportProductsInput = z.infer<typeof importProductsSchema>;
export type ProductStatus = z.infer<typeof productStatusSchema>;
export type ProductVisibility = z.infer<typeof productVisibilitySchema>;
export type ProductType = z.infer<typeof productTypeSchema>;

import { z } from "zod";
import {
  idParamsSchema,
  paginatedResponseSchema,
  paginationQuerySchema,
  searchQuerySchema,
  slugValidation,
  successResponseSchema,
  uuidSchema,
} from "../../shared/validators/common.schemas";

/**
 * Zod validation schemas for content management endpoints
 */

export const createContentSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be less than 255 characters"),
  slug: slugValidation,
  body: z.string().optional(),
  excerpt: z
    .string()
    .max(500, "Excerpt must be less than 500 characters")
    .optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  tags: z.array(z.string()).optional(),
  categoryId: uuidSchema.optional(),
  featuredImage: uuidSchema.optional(),
  seoTitle: z
    .string()
    .max(60, "SEO title must be less than 60 characters")
    .optional(),
  seoDescription: z
    .string()
    .max(160, "SEO description must be less than 160 characters")
    .optional(),
  publishedAt: z.coerce.date().optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateContentSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be less than 255 characters")
    .optional(),
  slug: slugValidation.optional(),
  body: z.string().optional(),
  excerpt: z
    .string()
    .max(500, "Excerpt must be less than 500 characters")
    .optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  tags: z.array(z.string()).optional(),
  categoryId: uuidSchema.optional(),
  featuredImage: uuidSchema.optional(),
  seoTitle: z
    .string()
    .max(60, "SEO title must be less than 60 characters")
    .optional(),
  seoDescription: z
    .string()
    .max(160, "SEO description must be less than 160 characters")
    .optional(),
  publishedAt: z.coerce.date().optional(),
  metadata: z.record(z.any()).optional(),
});

export const contentQuerySchema = paginationQuerySchema
  .merge(searchQuerySchema)
  .extend({
    status: z.enum(["draft", "published", "archived"]).optional(),
    authorId: uuidSchema.optional(),
    categoryId: uuidSchema.optional(),
    tags: z.string().optional(), // Comma-separated tags
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    sortBy: z
      .enum(["createdAt", "updatedAt", "title", "publishedAt", "views"])
      .default("createdAt"),
  });

export const contentVersionQuerySchema = z.object({
  version: z.coerce.number().int().min(1).optional(),
});

export const contentParamsSchema = z.object({
  id: uuidSchema,
});

export const publishContentSchema = z.object({
  publishedAt: z.coerce.date().optional(),
  notifySubscribers: z.boolean().default(false),
});

// Response schemas
export const contentSchema = z.object({
  id: uuidSchema,
  title: z.string(),
  slug: z.string(),
  body: z.string().nullable(),
  excerpt: z.string().nullable(),
  status: z.enum(["draft", "published", "archived"]),
  version: z.number(),
  tags: z.array(z.string()),
  categoryId: uuidSchema.nullable(),
  featuredImage: uuidSchema.nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  views: z.number().default(0),
  metadata: z.record(z.any()),
  authorId: uuidSchema,
  tenantId: uuidSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
});

export const contentWithAuthorSchema = contentSchema.extend({
  author: z.object({
    id: uuidSchema,
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    avatar: z.string().nullable(),
  }),
});

export const contentVersionSchema = z.object({
  version: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  status: z.string(),
  createdAt: z.string().datetime(),
  author: z.object({
    id: uuidSchema,
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
  }),
});

export const contentStatsSchema = z.object({
  totalContent: z.number(),
  publishedContent: z.number(),
  draftContent: z.number(),
  archivedContent: z.number(),
  totalViews: z.number(),
  contentByAuthor: z.record(z.number()),
  contentByCategory: z.record(z.number()),
});

export const contentResponseSchema = successResponseSchema(
  contentWithAuthorSchema
);
export const contentListResponseSchema = paginatedResponseSchema(
  contentWithAuthorSchema
);
export const contentVersionsResponseSchema = successResponseSchema(
  z.array(contentVersionSchema)
);
export const contentStatsResponseSchema =
  successResponseSchema(contentStatsSchema);

// Endpoint schemas
export const createContentEndpoint = {
  body: createContentSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const updateContentEndpoint = {
  body: updateContentSchema,
  query: z.void(),
  params: idParamsSchema,
  headers: z.void(),
};

export const getContentEndpoint = {
  body: z.void(),
  query: contentVersionQuerySchema,
  params: idParamsSchema,
  headers: z.void(),
};

export const listContentEndpoint = {
  body: z.void(),
  query: contentQuerySchema,
  params: z.void(),
  headers: z.void(),
};

export const publishContentEndpoint = {
  body: publishContentSchema,
  query: z.void(),
  params: idParamsSchema,
  headers: z.void(),
};

// Type exports
export type CreateContentRequest = z.infer<typeof createContentSchema>;
export type UpdateContentRequest = z.infer<typeof updateContentSchema>;
export type ContentQueryParams = z.infer<typeof contentQuerySchema>;
export type ContentVersionQuery = z.infer<typeof contentVersionQuerySchema>;
export type ContentParams = z.infer<typeof contentParamsSchema>;
export type PublishContentRequest = z.infer<typeof publishContentSchema>;
export type Content = z.infer<typeof contentSchema>;
export type ContentWithAuthor = z.infer<typeof contentWithAuthorSchema>;
export type ContentVersion = z.infer<typeof contentVersionSchema>;
export type ContentStats = z.infer<typeof contentStatsSchema>;
export type ContentResponse = z.infer<typeof contentResponseSchema>;
export type ContentListResponse = z.infer<typeof contentListResponseSchema>;
export type ContentVersionsResponse = z.infer<
  typeof contentVersionsResponseSchema
>;
export type ContentStatsResponse = z.infer<typeof contentStatsResponseSchema>;

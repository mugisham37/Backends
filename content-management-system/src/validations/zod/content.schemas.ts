import { z } from "zod";

/**
 * Zod validation schemas for content management endpoints
 */

export const createContentSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be less than 255 characters"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(255, "Slug must be less than 255 characters"),
  body: z.string().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateContentSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title must be less than 255 characters")
    .optional(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(255, "Slug must be less than 255 characters")
    .optional(),
  body: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const contentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["draft", "published", "archived"]).optional(),
  authorId: z.string().uuid().optional(),
  search: z.string().optional(),
  tags: z.string().optional(), // Comma-separated tags
  sortBy: z
    .enum(["createdAt", "updatedAt", "title", "publishedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const contentParamsSchema = z.object({
  id: z.string().uuid("Invalid content ID format"),
});

export const contentVersionQuerySchema = z.object({
  version: z.coerce.number().int().min(1).optional(),
});

// Response schemas
export const contentResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    title: z.string(),
    slug: z.string(),
    body: z.string().nullable(),
    status: z.string(),
    version: z.number(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
    authorId: z.string(),
    tenantId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    publishedAt: z.string().nullable(),
    author: z
      .object({
        id: z.string(),
        email: z.string(),
        firstName: z.string(),
        lastName: z.string(),
      })
      .optional(),
  }),
  timestamp: z.string(),
});

export const contentListResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    items: z.array(contentResponseSchema.shape.data),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    hasMore: z.boolean(),
  }),
  timestamp: z.string(),
});

export const contentVersionsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(
    z.object({
      version: z.number(),
      title: z.string(),
      createdAt: z.string(),
      author: z.object({
        id: z.string(),
        email: z.string(),
        firstName: z.string(),
        lastName: z.string(),
      }),
    })
  ),
  timestamp: z.string(),
});

export type CreateContentRequest = z.infer<typeof createContentSchema>;
export type UpdateContentRequest = z.infer<typeof updateContentSchema>;
export type ContentQueryParams = z.infer<typeof contentQuerySchema>;
export type ContentParams = z.infer<typeof contentParamsSchema>;
export type ContentVersionQuery = z.infer<typeof contentVersionQuerySchema>;
export type ContentResponse = z.infer<typeof contentResponseSchema>;
export type ContentListResponse = z.infer<typeof contentListResponseSchema>;
export type ContentVersionsResponse = z.infer<
  typeof contentVersionsResponseSchema
>;

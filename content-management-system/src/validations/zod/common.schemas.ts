import { z } from "zod";

/**
 * Common Zod validation schemas used across the application
 */

// Base schemas
export const uuidSchema = z.string().uuid("Invalid UUID format");
export const emailSchema = z.string().email("Invalid email format");
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
  );

// Pagination schemas
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const searchQuerySchema = z.object({
  search: z.string().optional(),
  filter: z.record(z.any()).optional(),
});

// Common parameter schemas
export const idParamsSchema = z.object({
  id: uuidSchema,
});

export const slugParamsSchema = z.object({
  slug: z.string().min(1, "Slug is required"),
});

// Date schemas
export const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// File upload schemas
export const fileUploadSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  mimetype: z.string().min(1, "MIME type is required"),
  size: z
    .number()
    .min(1, "File size must be greater than 0")
    .max(50 * 1024 * 1024, "File size cannot exceed 50MB"),
  encoding: z.string().optional(),
});

// Response wrapper schemas
export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    timestamp: z.string().datetime(),
  });

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
  timestamp: z.string().datetime(),
});

export const paginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  successResponseSchema(
    z.object({
      items: z.array(itemSchema),
      pagination: z.object({
        page: z.number(),
        limit: z.number(),
        total: z.number(),
        totalPages: z.number(),
        hasNext: z.boolean(),
        hasPrev: z.boolean(),
      }),
    })
  );

// Validation result types
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type IdParams = z.infer<typeof idParamsSchema>;
export type SlugParams = z.infer<typeof slugParamsSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type FileUpload = z.infer<typeof fileUploadSchema>;

// Helper function to create API endpoint schemas
export const createEndpointSchema = <
  TBody extends z.ZodTypeAny = z.ZodVoid,
  TQuery extends z.ZodTypeAny = z.ZodVoid,
  TParams extends z.ZodTypeAny = z.ZodVoid,
  THeaders extends z.ZodTypeAny = z.ZodVoid
>(config: {
  body?: TBody;
  query?: TQuery;
  params?: TParams;
  headers?: THeaders;
}) => ({
  body: config.body || z.void(),
  query: config.query || z.void(),
  params: config.params || z.void(),
  headers: config.headers || z.void(),
});

// Common validation patterns
export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const phonePattern = /^\+?[1-9]\d{1,14}$/;
export const urlPattern = /^https?:\/\/.+/;

export const slugValidation = z
  .string()
  .regex(
    slugPattern,
    "Slug must contain only lowercase letters, numbers, and hyphens"
  );

export const phoneValidation = z
  .string()
  .regex(phonePattern, "Invalid phone number format");

export const urlValidation = z.string().regex(urlPattern, "Invalid URL format");

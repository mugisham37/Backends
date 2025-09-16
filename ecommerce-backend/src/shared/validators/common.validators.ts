import { z } from "zod";

// Common UUID schema
export const uuidSchema = z.string().uuid("Invalid UUID format");

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Search schema
export const searchSchema = z.object({
  query: z.string().min(1).max(100),
  filters: z.record(z.any()).optional(),
});

// Date range schema
export const dateRangeSchema = z.object({
  startDate: z.date(),
  endDate: z.date().refine((date, ctx) => {
    const startDate = ctx.parent.startDate;
    return date >= startDate;
  }, "End date must be after or equal to start date"),
});

// File upload schema
export const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimetype: z
    .string()
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_]*\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-\^_.]*$/
    ),
  size: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024), // 10MB max
  buffer: z.instanceof(Buffer),
});

// Image upload schema
export const imageUploadSchema = fileUploadSchema.extend({
  mimetype: z.enum([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ]),
  size: z
    .number()
    .int()
    .min(1)
    .max(5 * 1024 * 1024), // 5MB max for images
});

// Address schema (reusable)
export const addressSchema = z.object({
  id: uuidSchema.optional(),
  type: z.enum(["billing", "shipping", "business"]).optional(),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  company: z.string().max(100).optional(),
  street: z.string().min(1, "Street address is required").max(200),
  street2: z.string().max(200).optional(),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  country: z.string().min(2, "Country is required").max(3),
  phone: z
    .string()
    .regex(/^\+?[\d\s-()]+$/, "Invalid phone number format")
    .optional(),
  isDefault: z.boolean().default(false),
});

// Contact information schema
export const contactInfoSchema = z.object({
  email: z.string().email("Invalid email format"),
  phone: z
    .string()
    .regex(/^\+?[\d\s-()]+$/, "Invalid phone number format")
    .optional(),
  website: z.string().url("Invalid website URL").optional(),
});

// Money/currency schema
export const moneySchema = z.object({
  amount: z.number().min(0, "Amount must be non-negative"),
  currency: z
    .string()
    .length(3, "Currency must be 3 characters")
    .default("USD"),
});

// Metadata schema
export const metadataSchema = z.record(
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);

// Slug schema
export const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format");

// Color hex schema
export const colorHexSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format");

// URL schema
export const urlSchema = z.string().url("Invalid URL format");

// Email schema
export const emailSchema = z
  .string()
  .email("Invalid email format")
  .toLowerCase();

// Phone schema
export const phoneSchema = z
  .string()
  .regex(/^\+?[\d\s-()]+$/, "Invalid phone number format");

// Password schema
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
  );

// Status schemas
export const activeStatusSchema = z.enum(["active", "inactive"]);
export const enabledStatusSchema = z.enum(["enabled", "disabled"]);

// Language and locale schemas
export const languageCodeSchema = z.string().min(2).max(5);
export const countryCodeSchema = z.string().length(2);
export const currencyCodeSchema = z.string().length(3);

// Validation error response schema
export const validationErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    message: z.string(),
    code: z.string(),
    details: z.array(
      z.object({
        field: z.string(),
        message: z.string(),
        code: z.string(),
      })
    ),
  }),
});

// Success response schema
export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z
      .object({
        pagination: z
          .object({
            page: z.number(),
            limit: z.number(),
            total: z.number(),
            totalPages: z.number(),
          })
          .optional(),
        timestamp: z.date().optional(),
      })
      .optional(),
  });

// Bulk operation result schema
export const bulkOperationResultSchema = z.object({
  success: z.boolean(),
  processed: z.number(),
  succeeded: z.number(),
  failed: z.number(),
  errors: z.array(
    z.object({
      index: z.number(),
      error: z.string(),
    })
  ),
});

// Type exports
export type UUID = z.infer<typeof uuidSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type Search = z.infer<typeof searchSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type FileUpload = z.infer<typeof fileUploadSchema>;
export type ImageUpload = z.infer<typeof imageUploadSchema>;
export type Address = z.infer<typeof addressSchema>;
export type ContactInfo = z.infer<typeof contactInfoSchema>;
export type Money = z.infer<typeof moneySchema>;
export type Metadata = z.infer<typeof metadataSchema>;
export type ValidationError = z.infer<typeof validationErrorSchema>;
export type BulkOperationResult = z.infer<typeof bulkOperationResultSchema>;

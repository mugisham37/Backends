import { z } from "zod";
import { REGEX_PATTERNS, VALIDATION_RULES } from "../constants";

/**
 * Common Zod validation schemas used across the application
 * This file provides reusable validation schemas for common data types
 */

// Basic UUID schema
export const uuidSchema = z.string().uuid("Invalid UUID format");

// Email validation schema
export const emailSchema = z
  .string()
  .email("Invalid email format")
  .max(VALIDATION_RULES.EMAIL_MAX_LENGTH, "Email is too long");

// Password validation schema with strong requirements
export const passwordSchema = z
  .string()
  .min(
    VALIDATION_RULES.PASSWORD_MIN_LENGTH,
    "Password must be at least 8 characters"
  )
  .max(VALIDATION_RULES.PASSWORD_MAX_LENGTH, "Password is too long")
  .regex(
    REGEX_PATTERNS.PASSWORD,
    "Password must contain at least one uppercase letter, lowercase letter, number, and special character"
  );

// Phone validation schema
export const phoneValidation = z
  .string()
  .regex(REGEX_PATTERNS.PHONE, "Invalid phone number format")
  .max(VALIDATION_RULES.PHONE_MAX_LENGTH, "Phone number is too long");

// URL validation schema
export const urlValidation = z
  .string()
  .url("Invalid URL format")
  .max(VALIDATION_RULES.URL_MAX_LENGTH, "URL is too long");

// Slug validation schema
export const slugValidation = z
  .string()
  .min(VALIDATION_RULES.SLUG_MIN_LENGTH, "Slug is required")
  .max(VALIDATION_RULES.SLUG_MAX_LENGTH, "Slug is too long")
  .regex(
    REGEX_PATTERNS.SLUG,
    "Slug must contain only lowercase letters, numbers, and hyphens"
  );

// Pagination query schema
export const paginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1, "Page must be at least 1")),
  limit: z
    .string()
    .optional()
    .default("20")
    .transform((val) => parseInt(val, 10))
    .pipe(
      z
        .number()
        .int()
        .min(1, "Limit must be at least 1")
        .max(100, "Limit cannot exceed 100")
    ),
});

// Search query schema
export const searchQuerySchema = z.object({
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
});

// ID parameters schema
export const idParamsSchema = z.object({
  id: uuidSchema,
});

// File upload schema
export const fileUploadSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  mimetype: z.string().min(1, "MIME type is required"),
  size: z.number().int().min(1, "File size must be greater than 0"),
});

// Generic success response schema
export const successResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    timestamp: z.string().datetime(),
  });

// Generic error response schema
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
  timestamp: z.string().datetime(),
});

// Paginated response schema
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  z.object({
    success: z.literal(true),
    data: z.object({
      items: z.array(itemSchema),
      pagination: z.object({
        page: z.number().int().min(1),
        limit: z.number().int().min(1),
        total: z.number().int().min(0),
        totalPages: z.number().int().min(0),
        hasNext: z.boolean(),
        hasPrev: z.boolean(),
      }),
    }),
    timestamp: z.string().datetime(),
  });

// Date range schema
export const dateRangeSchema = z.object({
  startDate: z.string().datetime("Invalid start date format").optional(),
  endDate: z.string().datetime("Invalid end date format").optional(),
});

// Metadata schema for extensible objects
export const metadataSchema = z.record(z.any()).optional();

// Common enum schemas
export const statusSchema = z.enum([
  "active",
  "inactive",
  "pending",
  "suspended",
]);
export const prioritySchema = z.enum(["low", "medium", "high", "critical"]);
export const visibilitySchema = z.enum(["public", "private", "restricted"]);

// Text content schemas with different length limits
export const shortTextSchema = z
  .string()
  .max(VALIDATION_RULES.NAME_MAX_LENGTH, "Text is too long");

export const mediumTextSchema = z
  .string()
  .max(VALIDATION_RULES.DESCRIPTION_MAX_LENGTH, "Text is too long");

export const longTextSchema = z
  .string()
  .max(VALIDATION_RULES.CONTENT_MAX_LENGTH, "Text is too long");

// Coordinate schema for location data
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90, "Invalid latitude").max(90, "Invalid latitude"),
  longitude: z
    .number()
    .min(-180, "Invalid longitude")
    .max(180, "Invalid longitude"),
});

// Color schema (hex format)
export const colorSchema = z
  .string()
  .regex(REGEX_PATTERNS.HEX_COLOR, "Invalid hex color format");

// Language code schema (ISO 639-1)
export const languageCodeSchema = z
  .string()
  .length(2, "Language code must be 2 characters")
  .regex(/^[a-z]{2}$/, "Language code must be lowercase letters");

// Currency code schema (ISO 4217)
export const currencyCodeSchema = z
  .string()
  .length(3, "Currency code must be 3 characters")
  .regex(/^[A-Z]{3}$/, "Currency code must be uppercase letters");

// Version schema (semantic versioning)
export const versionSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "Invalid version format (must be x.y.z)");

// IP address schema
export const ipAddressSchema = z.string().ip("Invalid IP address format");

// Base64 schema
export const base64Schema = z
  .string()
  .regex(/^[A-Za-z0-9+/]+=*$/, "Invalid base64 format");

// JSON string schema that validates and parses JSON
export const jsonStringSchema = z
  .string()
  .refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, "Invalid JSON format")
  .transform((val) => JSON.parse(val));

// Optional fields wrapper
export const makeOptional = <T extends z.ZodTypeAny>(schema: T) =>
  schema.optional();

// Array wrapper with validation
export const arraySchema = <T extends z.ZodTypeAny>(
  itemSchema: T,
  minItems = 0,
  maxItems = 100
) =>
  z
    .array(itemSchema)
    .min(minItems, `Array must contain at least ${minItems} items`)
    .max(maxItems, `Array cannot contain more than ${maxItems} items`);

// Utility function to create enum schema from array
export const createEnumSchema = (values: readonly string[]) =>
  z.enum(values as [string, ...string[]]);

// Common request headers schema
export const commonHeadersSchema = z.object({
  "content-type": z.string().optional(),
  authorization: z.string().optional(),
  "user-agent": z.string().optional(),
  "x-tenant-id": uuidSchema.optional(),
  "x-request-id": uuidSchema.optional(),
});

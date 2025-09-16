import { z } from "zod";
import {
  uuidSchema,
  emailSchema,
  passwordSchema,
  paginationQuerySchema,
  searchQuerySchema,
  idParamsSchema,
  phoneValidation,
  successResponseSchema,
  paginatedResponseSchema,
} from "./common.schemas.js";

/**
 * Zod validation schemas for user management endpoints
 */

// User creation schema
export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(100, "First name must be less than 100 characters"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(100, "Last name must be less than 100 characters"),
  role: z.enum(["admin", "editor", "author", "viewer"]).default("viewer"),
  phone: phoneValidation.optional(),
  avatar: z.string().url().optional(),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  preferences: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

// User update schema
export const updateUserSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(100, "First name must be less than 100 characters")
    .optional(),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(100, "Last name must be less than 100 characters")
    .optional(),
  phone: phoneValidation.optional(),
  avatar: z.string().url().optional(),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  preferences: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

// User profile update schema (for self-updates)
export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(100, "First name must be less than 100 characters")
    .optional(),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(100, "Last name must be less than 100 characters")
    .optional(),
  phone: phoneValidation.optional(),
  avatar: z.string().url().optional(),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  preferences: z.record(z.any()).optional(),
});

// User role update schema
export const updateUserRoleSchema = z.object({
  role: z.enum(["admin", "editor", "author", "viewer"]),
});

// User query schema
export const userQuerySchema = paginationQuerySchema
  .merge(searchQuerySchema)
  .extend({
    role: z.enum(["admin", "editor", "author", "viewer"]).optional(),
    isActive: z.coerce.boolean().optional(),
    tenantId: uuidSchema.optional(),
    sortBy: z
      .enum([
        "firstName",
        "lastName",
        "email",
        "createdAt",
        "updatedAt",
        "lastLoginAt",
      ])
      .default("createdAt"),
  });

// User activity query schema
export const userActivityQuerySchema = paginationQuerySchema.extend({
  action: z.string().optional(),
  resource: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

// Response schemas
export const userSchema = z.object({
  id: uuidSchema,
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.string(),
  phone: z.string().nullable(),
  avatar: z.string().nullable(),
  bio: z.string().nullable(),
  preferences: z.record(z.any()),
  metadata: z.record(z.any()),
  isActive: z.boolean(),
  emailVerified: z.boolean(),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const userProfileSchema = userSchema.omit({
  metadata: true,
});

export const userActivitySchema = z.object({
  id: uuidSchema,
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().nullable(),
  details: z.record(z.any()),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const userStatsSchema = z.object({
  totalUsers: z.number(),
  activeUsers: z.number(),
  newUsersThisMonth: z.number(),
  usersByRole: z.record(z.number()),
  usersByTenant: z.record(z.number()),
});

export const userResponseSchema = successResponseSchema(userSchema);
export const userProfileResponseSchema =
  successResponseSchema(userProfileSchema);
export const userListResponseSchema = paginatedResponseSchema(userSchema);
export const userActivityResponseSchema =
  paginatedResponseSchema(userActivitySchema);
export const userStatsResponseSchema = successResponseSchema(userStatsSchema);

// Endpoint schemas
export const createUserEndpoint = {
  body: createUserSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const updateUserEndpoint = {
  body: updateUserSchema,
  query: z.void(),
  params: idParamsSchema,
  headers: z.void(),
};

export const updateProfileEndpoint = {
  body: updateProfileSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const updateUserRoleEndpoint = {
  body: updateUserRoleSchema,
  query: z.void(),
  params: idParamsSchema,
  headers: z.void(),
};

export const getUserEndpoint = {
  body: z.void(),
  query: z.void(),
  params: idParamsSchema,
  headers: z.void(),
};

export const listUsersEndpoint = {
  body: z.void(),
  query: userQuerySchema,
  params: z.void(),
  headers: z.void(),
};

export const getUserActivityEndpoint = {
  body: z.void(),
  query: userActivityQuerySchema,
  params: idParamsSchema,
  headers: z.void(),
};

// Type exports
export type CreateUserRequest = z.infer<typeof createUserSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
export type UpdateUserRoleRequest = z.infer<typeof updateUserRoleSchema>;
export type UserQueryParams = z.infer<typeof userQuerySchema>;
export type UserActivityQueryParams = z.infer<typeof userActivityQuerySchema>;
export type User = z.infer<typeof userSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type UserActivity = z.infer<typeof userActivitySchema>;
export type UserStats = z.infer<typeof userStatsSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;
export type UserListResponse = z.infer<typeof userListResponseSchema>;
export type UserActivityResponse = z.infer<typeof userActivityResponseSchema>;
export type UserStatsResponse = z.infer<typeof userStatsResponseSchema>;

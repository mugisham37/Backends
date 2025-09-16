import { z } from "zod";
import {
  uuidSchema,
  emailSchema,
  paginationQuerySchema,
  searchQuerySchema,
  idParamsSchema,
  slugValidation,
  successResponseSchema,
  paginatedResponseSchema,
} from "./common.schemas.js";

/**
 * Zod validation schemas for tenant management endpoints
 */

// Tenant creation schema
export const createTenantSchema = z.object({
  name: z
    .string()
    .min(1, "Tenant name is required")
    .max(255, "Name must be less than 255 characters"),
  slug: slugValidation,
  description: z.string().optional(),
  settings: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

// Tenant update schema
export const updateTenantSchema = z.object({
  name: z
    .string()
    .min(1, "Tenant name is required")
    .max(255, "Name must be less than 255 characters")
    .optional(),
  slug: slugValidation.optional(),
  description: z.string().optional(),
  settings: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

// Tenant query schema
export const tenantQuerySchema = paginationQuerySchema
  .merge(searchQuerySchema)
  .extend({
    isActive: z.coerce.boolean().optional(),
    sortBy: z.enum(["name", "createdAt", "updatedAt"]).default("createdAt"),
  });

// Tenant invitation schema
export const inviteTenantUserSchema = z.object({
  email: emailSchema,
  role: z.enum(["admin", "editor", "author", "viewer"]),
  message: z.string().optional(),
});

// Tenant user role update schema
export const updateTenantUserRoleSchema = z.object({
  role: z.enum(["admin", "editor", "author", "viewer"]),
});

// Response schemas
export const tenantSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  settings: z.record(z.any()),
  metadata: z.record(z.any()),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const tenantUserSchema = z.object({
  id: uuidSchema,
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.string(),
  joinedAt: z.string().datetime(),
  lastActiveAt: z.string().datetime().nullable(),
});

export const tenantWithUsersSchema = tenantSchema.extend({
  users: z.array(tenantUserSchema),
  userCount: z.number(),
});

export const tenantResponseSchema = successResponseSchema(tenantSchema);
export const tenantListResponseSchema = paginatedResponseSchema(tenantSchema);
export const tenantUsersResponseSchema = successResponseSchema(
  z.array(tenantUserSchema)
);

// Endpoint schemas
export const createTenantEndpoint = {
  body: createTenantSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const updateTenantEndpoint = {
  body: updateTenantSchema,
  query: z.void(),
  params: idParamsSchema,
  headers: z.void(),
};

export const getTenantEndpoint = {
  body: z.void(),
  query: z.void(),
  params: idParamsSchema,
  headers: z.void(),
};

export const listTenantsEndpoint = {
  body: z.void(),
  query: tenantQuerySchema,
  params: z.void(),
  headers: z.void(),
};

export const inviteTenantUserEndpoint = {
  body: inviteTenantUserSchema,
  query: z.void(),
  params: idParamsSchema,
  headers: z.void(),
};

export const updateTenantUserRoleEndpoint = {
  body: updateTenantUserRoleSchema,
  query: z.void(),
  params: z.object({
    tenantId: uuidSchema,
    userId: uuidSchema,
  }),
  headers: z.void(),
};

// Type exports
export type CreateTenantRequest = z.infer<typeof createTenantSchema>;
export type UpdateTenantRequest = z.infer<typeof updateTenantSchema>;
export type TenantQueryParams = z.infer<typeof tenantQuerySchema>;
export type InviteTenantUserRequest = z.infer<typeof inviteTenantUserSchema>;
export type UpdateTenantUserRoleRequest = z.infer<
  typeof updateTenantUserRoleSchema
>;
export type Tenant = z.infer<typeof tenantSchema>;
export type TenantUser = z.infer<typeof tenantUserSchema>;
export type TenantWithUsers = z.infer<typeof tenantWithUsersSchema>;
export type TenantResponse = z.infer<typeof tenantResponseSchema>;
export type TenantListResponse = z.infer<typeof tenantListResponseSchema>;
export type TenantUsersResponse = z.infer<typeof tenantUsersResponseSchema>;

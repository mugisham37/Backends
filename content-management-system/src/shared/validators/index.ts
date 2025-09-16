/**
 * Zod Validation Schemas Index
 *
 * Central export point for all validation schemas used throughout the application.
 * This provides a single import location for all validation needs.
 */

// Common schemas and utilities
export * from "./common.schemas.ts";

// Authentication schemas
export * from "./auth.schemas.ts";

// User management schemas
export * from "./user.schemas.ts";

// Tenant management schemas
export * from "./tenant.schemas.ts";

// Content management schemas
export * from "./content.schemas.ts";

// Media management schemas
export * from "./media.schemas.ts";

// Webhook management schemas
export * from "./webhook.schemas.ts";

// Re-export zod for convenience
export { z } from "zod";

/**
 * Validation schema collections for easy access
 */
export const ValidationSchemas = {
  // Authentication
  Auth: {
    login: () => import("./auth.schemas.ts").then((m) => m.loginSchema),
    register: () => import("./auth.schemas.ts").then((m) => m.registerSchema),
    refreshToken: () =>
      import("./auth.schemas.ts").then((m) => m.refreshTokenSchema),
    changePassword: () =>
      import("./auth.schemas.ts").then((m) => m.changePasswordSchema),
    forgotPassword: () =>
      import("./auth.schemas.ts").then((m) => m.forgotPasswordSchema),
    resetPassword: () =>
      import("./auth.schemas.ts").then((m) => m.resetPasswordSchema),
  },

  // Users
  User: {
    create: () => import("./user.schemas.ts").then((m) => m.createUserSchema),
    update: () => import("./user.schemas.ts").then((m) => m.updateUserSchema),
    updateProfile: () =>
      import("./user.schemas.ts").then((m) => m.updateProfileSchema),
    query: () => import("./user.schemas.ts").then((m) => m.userQuerySchema),
  },

  // Tenants
  Tenant: {
    create: () =>
      import("./tenant.schemas.ts").then((m) => m.createTenantSchema),
    update: () =>
      import("./tenant.schemas.ts").then((m) => m.updateTenantSchema),
    query: () => import("./tenant.schemas.ts").then((m) => m.tenantQuerySchema),
    inviteUser: () =>
      import("./tenant.schemas.ts").then((m) => m.inviteTenantUserSchema),
  },

  // Content
  Content: {
    create: () =>
      import("./content.schemas.ts").then((m) => m.createContentSchema),
    update: () =>
      import("./content.schemas.ts").then((m) => m.updateContentSchema),
    query: () =>
      import("./content.schemas.ts").then((m) => m.contentQuerySchema),
    publish: () =>
      import("./content.schemas.ts").then((m) => m.publishContentSchema),
  },

  // Media
  Media: {
    upload: () => import("./media.schemas.ts").then((m) => m.uploadMediaSchema),
    update: () => import("./media.schemas.ts").then((m) => m.updateMediaSchema),
    query: () => import("./media.schemas.ts").then((m) => m.mediaQuerySchema),
    transform: () =>
      import("./media.schemas.ts").then((m) => m.imageTransformSchema),
  },

  // Webhooks
  Webhook: {
    create: () =>
      import("./webhook.schemas.ts").then((m) => m.createWebhookSchema),
    update: () =>
      import("./webhook.schemas.ts").then((m) => m.updateWebhookSchema),
    query: () =>
      import("./webhook.schemas.ts").then((m) => m.webhookQuerySchema),
    test: () => import("./webhook.schemas.ts").then((m) => m.testWebhookSchema),
  },

  // Common
  Common: {
    pagination: () =>
      import("./common.schemas.ts").then((m) => m.paginationQuerySchema),
    search: () =>
      import("./common.schemas.ts").then((m) => m.searchQuerySchema),
    idParams: () => import("./common.schemas.ts").then((m) => m.idParamsSchema),
    fileUpload: () =>
      import("./common.schemas.ts").then((m) => m.fileUploadSchema),
  },
} as const;

/**
 * Endpoint schema collections for route validation
 */
export const EndpointSchemas = {
  Auth: {
    login: () => import("./auth.schemas.ts").then((m) => m.loginEndpoint),
    register: () => import("./auth.schemas.ts").then((m) => m.registerEndpoint),
    refreshToken: () =>
      import("./auth.schemas.ts").then((m) => m.refreshTokenEndpoint),
    changePassword: () =>
      import("./auth.schemas.ts").then((m) => m.changePasswordEndpoint),
    forgotPassword: () =>
      import("./auth.schemas.ts").then((m) => m.forgotPasswordEndpoint),
    resetPassword: () =>
      import("./auth.schemas.ts").then((m) => m.resetPasswordEndpoint),
  },

  User: {
    create: () => import("./user.schemas.ts").then((m) => m.createUserEndpoint),
    update: () => import("./user.schemas.ts").then((m) => m.updateUserEndpoint),
    get: () => import("./user.schemas.ts").then((m) => m.getUserEndpoint),
    list: () => import("./user.schemas.ts").then((m) => m.listUsersEndpoint),
    updateProfile: () =>
      import("./user.schemas.ts").then((m) => m.updateProfileEndpoint),
  },

  Tenant: {
    create: () =>
      import("./tenant.schemas.ts").then((m) => m.createTenantEndpoint),
    update: () =>
      import("./tenant.schemas.ts").then((m) => m.updateTenantEndpoint),
    get: () => import("./tenant.schemas.ts").then((m) => m.getTenantEndpoint),
    list: () =>
      import("./tenant.schemas.ts").then((m) => m.listTenantsEndpoint),
    inviteUser: () =>
      import("./tenant.schemas.ts").then((m) => m.inviteTenantUserEndpoint),
  },

  Content: {
    create: () =>
      import("./content.schemas.ts").then((m) => m.createContentEndpoint),
    update: () =>
      import("./content.schemas.ts").then((m) => m.updateContentEndpoint),
    get: () => import("./content.schemas.ts").then((m) => m.getContentEndpoint),
    list: () =>
      import("./content.schemas.ts").then((m) => m.listContentEndpoint),
    publish: () =>
      import("./content.schemas.ts").then((m) => m.publishContentEndpoint),
  },

  Media: {
    upload: () =>
      import("./media.schemas.ts").then((m) => m.uploadMediaEndpoint),
    update: () =>
      import("./media.schemas.ts").then((m) => m.updateMediaEndpoint),
    get: () => import("./media.schemas.ts").then((m) => m.getMediaEndpoint),
    list: () => import("./media.schemas.ts").then((m) => m.listMediaEndpoint),
    generateCdnUrl: () =>
      import("./media.schemas.ts").then((m) => m.generateCdnUrlEndpoint),
    bulkDelete: () =>
      import("./media.schemas.ts").then((m) => m.bulkDeleteMediaEndpoint),
  },

  Webhook: {
    create: () =>
      import("./webhook.schemas.ts").then((m) => m.createWebhookEndpoint),
    update: () =>
      import("./webhook.schemas.ts").then((m) => m.updateWebhookEndpoint),
    get: () => import("./webhook.schemas.ts").then((m) => m.getWebhookEndpoint),
    list: () =>
      import("./webhook.schemas.ts").then((m) => m.listWebhooksEndpoint),
    test: () =>
      import("./webhook.schemas.ts").then((m) => m.testWebhookEndpoint),
  },
} as const;

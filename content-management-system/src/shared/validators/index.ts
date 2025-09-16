/**
 * Zod Validation Schemas Index
 *
 * Central export point for all validation schemas used throughout the application.
 * This provides a single import location for all validation needs.
 */

// Common schemas and utilities
export * from "./common.schemas.js";

// Authentication schemas
export * from "./auth.schemas.js";

// User management schemas
export * from "./user.schemas.js";

// Tenant management schemas
export * from "./tenant.schemas.js";

// Content management schemas
export * from "./content.schemas.js";

// Media management schemas
export * from "./media.schemas.js";

// Webhook management schemas
export * from "./webhook.schemas.js";

// Re-export zod for convenience
export { z } from "zod";

/**
 * Validation schema collections for easy access
 */
export const ValidationSchemas = {
  // Authentication
  Auth: {
    login: () => import("./auth.schemas.js").then((m) => m.loginSchema),
    register: () => import("./auth.schemas.js").then((m) => m.registerSchema),
    refreshToken: () =>
      import("./auth.schemas.js").then((m) => m.refreshTokenSchema),
    changePassword: () =>
      import("./auth.schemas.js").then((m) => m.changePasswordSchema),
    forgotPassword: () =>
      import("./auth.schemas.js").then((m) => m.forgotPasswordSchema),
    resetPassword: () =>
      import("./auth.schemas.js").then((m) => m.resetPasswordSchema),
  },

  // Users
  User: {
    create: () => import("./user.schemas.js").then((m) => m.createUserSchema),
    update: () => import("./user.schemas.js").then((m) => m.updateUserSchema),
    updateProfile: () =>
      import("./user.schemas.js").then((m) => m.updateProfileSchema),
    query: () => import("./user.schemas.js").then((m) => m.userQuerySchema),
  },

  // Tenants
  Tenant: {
    create: () =>
      import("./tenant.schemas.js").then((m) => m.createTenantSchema),
    update: () =>
      import("./tenant.schemas.js").then((m) => m.updateTenantSchema),
    query: () => import("./tenant.schemas.js").then((m) => m.tenantQuerySchema),
    inviteUser: () =>
      import("./tenant.schemas.js").then((m) => m.inviteTenantUserSchema),
  },

  // Content
  Content: {
    create: () =>
      import("./content.schemas.js").then((m) => m.createContentSchema),
    update: () =>
      import("./content.schemas.js").then((m) => m.updateContentSchema),
    query: () =>
      import("./content.schemas.js").then((m) => m.contentQuerySchema),
    publish: () =>
      import("./content.schemas.js").then((m) => m.publishContentSchema),
  },

  // Media
  Media: {
    upload: () => import("./media.schemas.js").then((m) => m.uploadMediaSchema),
    update: () => import("./media.schemas.js").then((m) => m.updateMediaSchema),
    query: () => import("./media.schemas.js").then((m) => m.mediaQuerySchema),
    transform: () =>
      import("./media.schemas.js").then((m) => m.imageTransformSchema),
  },

  // Webhooks
  Webhook: {
    create: () =>
      import("./webhook.schemas.js").then((m) => m.createWebhookSchema),
    update: () =>
      import("./webhook.schemas.js").then((m) => m.updateWebhookSchema),
    query: () =>
      import("./webhook.schemas.js").then((m) => m.webhookQuerySchema),
    test: () => import("./webhook.schemas.js").then((m) => m.testWebhookSchema),
  },

  // Common
  Common: {
    pagination: () =>
      import("./common.schemas.js").then((m) => m.paginationQuerySchema),
    search: () =>
      import("./common.schemas.js").then((m) => m.searchQuerySchema),
    idParams: () => import("./common.schemas.js").then((m) => m.idParamsSchema),
    fileUpload: () =>
      import("./common.schemas.js").then((m) => m.fileUploadSchema),
  },
} as const;

/**
 * Endpoint schema collections for route validation
 */
export const EndpointSchemas = {
  Auth: {
    login: () => import("./auth.schemas.js").then((m) => m.loginEndpoint),
    register: () => import("./auth.schemas.js").then((m) => m.registerEndpoint),
    refreshToken: () =>
      import("./auth.schemas.js").then((m) => m.refreshTokenEndpoint),
    changePassword: () =>
      import("./auth.schemas.js").then((m) => m.changePasswordEndpoint),
    forgotPassword: () =>
      import("./auth.schemas.js").then((m) => m.forgotPasswordEndpoint),
    resetPassword: () =>
      import("./auth.schemas.js").then((m) => m.resetPasswordEndpoint),
  },

  User: {
    create: () => import("./user.schemas.js").then((m) => m.createUserEndpoint),
    update: () => import("./user.schemas.js").then((m) => m.updateUserEndpoint),
    get: () => import("./user.schemas.js").then((m) => m.getUserEndpoint),
    list: () => import("./user.schemas.js").then((m) => m.listUsersEndpoint),
    updateProfile: () =>
      import("./user.schemas.js").then((m) => m.updateProfileEndpoint),
  },

  Tenant: {
    create: () =>
      import("./tenant.schemas.js").then((m) => m.createTenantEndpoint),
    update: () =>
      import("./tenant.schemas.js").then((m) => m.updateTenantEndpoint),
    get: () => import("./tenant.schemas.js").then((m) => m.getTenantEndpoint),
    list: () =>
      import("./tenant.schemas.js").then((m) => m.listTenantsEndpoint),
    inviteUser: () =>
      import("./tenant.schemas.js").then((m) => m.inviteTenantUserEndpoint),
  },

  Content: {
    create: () =>
      import("./content.schemas.js").then((m) => m.createContentEndpoint),
    update: () =>
      import("./content.schemas.js").then((m) => m.updateContentEndpoint),
    get: () => import("./content.schemas.js").then((m) => m.getContentEndpoint),
    list: () =>
      import("./content.schemas.js").then((m) => m.listContentEndpoint),
    publish: () =>
      import("./content.schemas.js").then((m) => m.publishContentEndpoint),
  },

  Media: {
    upload: () =>
      import("./media.schemas.js").then((m) => m.uploadMediaEndpoint),
    update: () =>
      import("./media.schemas.js").then((m) => m.updateMediaEndpoint),
    get: () => import("./media.schemas.js").then((m) => m.getMediaEndpoint),
    list: () => import("./media.schemas.js").then((m) => m.listMediaEndpoint),
    generateCdnUrl: () =>
      import("./media.schemas.js").then((m) => m.generateCdnUrlEndpoint),
    bulkDelete: () =>
      import("./media.schemas.js").then((m) => m.bulkDeleteMediaEndpoint),
  },

  Webhook: {
    create: () =>
      import("./webhook.schemas.js").then((m) => m.createWebhookEndpoint),
    update: () =>
      import("./webhook.schemas.js").then((m) => m.updateWebhookEndpoint),
    get: () => import("./webhook.schemas.js").then((m) => m.getWebhookEndpoint),
    list: () =>
      import("./webhook.schemas.js").then((m) => m.listWebhooksEndpoint),
    test: () =>
      import("./webhook.schemas.js").then((m) => m.testWebhookEndpoint),
  },
} as const;

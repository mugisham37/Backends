// Export all schemas and their relations
export * from "./tenant.schema";
export * from "./auth.schema";
export * from "./content.schema";
export * from "./media.schema";

// Re-export commonly used types
export type {
  Tenant,
  NewTenant,
  TenantSettings,
  TenantMetadata,
} from "./tenant.schema";

export type {
  User,
  NewUser,
  UserRole,
  UserPreferences,
  UserMetadata,
  UserSession,
  NewUserSession,
  SessionDeviceInfo,
  UserPermission,
  NewUserPermission,
} from "./auth.schema";

export type {
  Content,
  NewContent,
  ContentStatus,
  ContentType,
  ContentMetadata,
  ContentVersion,
  NewContentVersion,
  ContentCategory,
  NewContentCategory,
  ContentTag,
  NewContentTag,
} from "./content.schema";

export type {
  Media,
  NewMedia,
  MediaType,
  StorageProvider,
  ProcessingStatus,
  MediaMetadata,
  MediaFolder,
  NewMediaFolder,
  MediaTransformation,
  NewMediaTransformation,
  TransformationConfig,
  MediaUsage,
  NewMediaUsage,
} from "./media.schema";

// Schema collections for easier imports
import { tenants, tenantRelations } from "./tenant.schema";

import {
  users,
  userSessions,
  userPermissions,
  userRelations,
  userSessionRelations,
  userPermissionRelations,
} from "./auth.schema";

import {
  contents,
  contentVersions,
  contentCategories,
  contentTags,
  contentRelations,
  contentVersionRelations,
  contentCategoryRelations,
  contentTagRelations,
} from "./content.schema";

import {
  media,
  mediaFolders,
  mediaTransformations,
  mediaUsage,
  mediaRelations,
  mediaFolderRelations,
  mediaTransformationRelations,
  mediaUsageRelations,
} from "./media.schema";

// All tables for migrations and schema operations
export const allTables = {
  // Tenant tables
  tenants,

  // Auth tables
  users,
  userSessions,
  userPermissions,

  // Content tables
  contents,
  contentVersions,
  contentCategories,
  contentTags,

  // Media tables
  media,
  mediaFolders,
  mediaTransformations,
  mediaUsage,
};

// All relations for Drizzle ORM
export const allRelations = {
  tenantRelations,
  userRelations,
  userSessionRelations,
  userPermissionRelations,
  contentRelations,
  contentVersionRelations,
  contentCategoryRelations,
  contentTagRelations,
  mediaRelations,
  mediaFolderRelations,
  mediaTransformationRelations,
  mediaUsageRelations,
};

// Schema validation constants
export const SCHEMA_CONSTANTS = {
  // String length limits
  MAX_EMAIL_LENGTH: 255,
  MAX_NAME_LENGTH: 255,
  MAX_SLUG_LENGTH: 255,
  MAX_TITLE_LENGTH: 500,
  MAX_DESCRIPTION_LENGTH: 1000,

  // File size limits (in bytes)
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB

  // Pagination limits
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Version limits
  MAX_CONTENT_VERSIONS: 50,
} as const;

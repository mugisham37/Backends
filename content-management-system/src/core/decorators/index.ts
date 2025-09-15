/**
 * Core decorators for authentication, validation, and caching
 */

// Authentication decorators
export {
  Auth,
  RequireRoles,
  RequirePermissions,
  AllowAnonymous,
  RequireAdmin,
  RequireOwnerOrAdmin,
  CurrentUser,
  CurrentTenant,
  AuthMetadataUtils,
  UserExtractor,
  isUserPayload,
  type AuthMetadata,
  AUTH_METADATA_KEY,
  ROLES_METADATA_KEY,
  PERMISSIONS_METADATA_KEY,
} from "./auth.decorator";

// Validation decorators
export {
  Validate,
  ValidateBody,
  ValidateParams,
  ValidateQuery,
  ValidateHeaders,
  ValidateResponse,
  ValidateParam,
  CommonSchemas,
  ValidationUtils,
  CommonValidators,
  type ValidationMetadata,
  type ParamValidationMetadata,
  type ValidationOptions,
  VALIDATION_METADATA_KEY,
  PARAM_VALIDATION_KEY,
} from "./validate.decorator";

// Cache decorators
export {
  Cache,
  CacheTTL,
  CacheShort,
  CacheMedium,
  CacheLong,
  CacheWithTags,
  CacheInvalidate,
  CacheInvalidateKeys,
  CacheInvalidateTags,
  CacheInvalidatePattern,
  CacheClear,
  CacheKeyGenerator,
  CacheUtils,
  CacheDecorators,
  type CacheMetadata,
  type CacheInvalidateMetadata,
  type CacheOptions,
  CACHE_METADATA_KEY,
  CACHE_INVALIDATE_KEY,
} from "./cache.decorator";

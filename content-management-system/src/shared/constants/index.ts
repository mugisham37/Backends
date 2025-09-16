// Constants module exports

// HTTP Status Codes
export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// Content Types
export const CONTENT_TYPES = {
  JSON: "application/json",
  XML: "application/xml",
  HTML: "text/html",
  TEXT: "text/plain",
  FORM_URLENCODED: "application/x-www-form-urlencoded",
  MULTIPART_FORM_DATA: "multipart/form-data",
  OCTET_STREAM: "application/octet-stream",
  PDF: "application/pdf",
  CSV: "text/csv",
  JPEG: "image/jpeg",
  PNG: "image/png",
  GIF: "image/gif",
  SVG: "image/svg+xml",
} as const;

// User Roles
export const USER_ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  EDITOR: "editor",
  AUTHOR: "author",
  CONTRIBUTOR: "contributor",
  VIEWER: "viewer",
  USER: "user",
  GUEST: "guest",
} as const;

// User Permissions
export const PERMISSIONS = {
  // Content permissions
  CONTENT_CREATE: "content:create",
  CONTENT_READ: "content:read",
  CONTENT_UPDATE: "content:update",
  CONTENT_DELETE: "content:delete",
  CONTENT_PUBLISH: "content:publish",
  CONTENT_MODERATE: "content:moderate",

  // User permissions
  USER_CREATE: "user:create",
  USER_READ: "user:read",
  USER_UPDATE: "user:update",
  USER_DELETE: "user:delete",
  USER_INVITE: "user:invite",

  // Admin permissions
  ADMIN_ACCESS: "admin:access",
  ADMIN_SETTINGS: "admin:settings",
  ADMIN_AUDIT: "admin:audit",

  // System permissions
  SYSTEM_BACKUP: "system:backup",
  SYSTEM_RESTORE: "system:restore",
  SYSTEM_MAINTENANCE: "system:maintenance",
} as const;

// Content Status
export const CONTENT_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
  SCHEDULED: "scheduled",
  REVIEW: "review",
  REJECTED: "rejected",
  TRASH: "trash",
} as const;

// Content Types
export const CONTENT_TYPES_ENUM = {
  ARTICLE: "article",
  PAGE: "page",
  POST: "post",
  PRODUCT: "product",
  EVENT: "event",
  NEWS: "news",
  BLOG: "blog",
  PORTFOLIO: "portfolio",
  TESTIMONIAL: "testimonial",
  FAQ: "faq",
} as const;

// Media Types
export const MEDIA_TYPES = {
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  DOCUMENT: "document",
  ARCHIVE: "archive",
  OTHER: "other",
} as const;

// File Extensions
export const ALLOWED_IMAGE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".svg",
  ".webp",
  ".bmp",
  ".tiff",
] as const;

export const ALLOWED_DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".rtf",
] as const;

export const ALLOWED_VIDEO_EXTENSIONS = [
  ".mp4",
  ".avi",
  ".mov",
  ".wmv",
  ".flv",
  ".webm",
  ".mkv",
] as const;

export const ALLOWED_AUDIO_EXTENSIONS = [
  ".mp3",
  ".wav",
  ".ogg",
  ".aac",
  ".flac",
  ".wma",
] as const;

// Cache Keys
export const CACHE_KEYS = {
  USER_PREFIX: "user:",
  CONTENT_PREFIX: "content:",
  TENANT_PREFIX: "tenant:",
  SESSION_PREFIX: "session:",
  RATE_LIMIT_PREFIX: "rate_limit:",
  API_KEY_PREFIX: "api_key:",
  SEARCH_PREFIX: "search:",
} as const;

// Cache TTL (in seconds)
export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 3600, // 1 hour
  EXTENDED: 86400, // 24 hours
  PERMANENT: 604800, // 7 days
} as const;

// Event Types
export const EVENT_TYPES = {
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DELETED: "user.deleted",
  USER_LOGIN: "user.login",
  USER_LOGOUT: "user.logout",

  CONTENT_CREATED: "content.created",
  CONTENT_UPDATED: "content.updated",
  CONTENT_DELETED: "content.deleted",
  CONTENT_PUBLISHED: "content.published",
  CONTENT_ARCHIVED: "content.archived",

  TENANT_CREATED: "tenant.created",
  TENANT_UPDATED: "tenant.updated",
  TENANT_DELETED: "tenant.deleted",

  SYSTEM_BACKUP: "system.backup",
  SYSTEM_RESTORE: "system.restore",
  SYSTEM_ERROR: "system.error",
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH_LOGIN: "/auth/login",
  AUTH_LOGOUT: "/auth/logout",
  AUTH_REGISTER: "/auth/register",
  AUTH_REFRESH: "/auth/refresh",
  AUTH_FORGOT_PASSWORD: "/auth/forgot-password",
  AUTH_RESET_PASSWORD: "/auth/reset-password",

  // User endpoints
  USERS: "/users",
  USER_PROFILE: "/users/profile",
  USER_SETTINGS: "/users/settings",

  // Content endpoints
  CONTENT: "/content",
  CONTENT_SEARCH: "/content/search",
  CONTENT_BULK: "/content/bulk",

  // Media endpoints
  MEDIA: "/media",
  MEDIA_UPLOAD: "/media/upload",

  // Admin endpoints
  ADMIN: "/admin",
  ADMIN_USERS: "/admin/users",
  ADMIN_CONTENT: "/admin/content",
  ADMIN_SETTINGS: "/admin/settings",
  ADMIN_AUDIT: "/admin/audit",
} as const;

// Validation Rules
export const VALIDATION_RULES = {
  // User validation
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 50,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  EMAIL_MAX_LENGTH: 255,

  // Content validation
  TITLE_MIN_LENGTH: 1,
  TITLE_MAX_LENGTH: 200,
  SLUG_MIN_LENGTH: 1,
  SLUG_MAX_LENGTH: 200,
  DESCRIPTION_MAX_LENGTH: 500,
  CONTENT_MAX_LENGTH: 100000,

  // General validation
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  URL_MAX_LENGTH: 2000,
  PHONE_MAX_LENGTH: 20,
} as const;

// Date Formats
export const DATE_FORMATS = {
  ISO: "YYYY-MM-DDTHH:mm:ss.sssZ",
  DATE_ONLY: "YYYY-MM-DD",
  TIME_ONLY: "HH:mm:ss",
  DISPLAY: "DD/MM/YYYY HH:mm",
  FILENAME: "YYYY-MM-DD_HH-mm-ss",
} as const;

// Environment Types
export const ENVIRONMENTS = {
  DEVELOPMENT: "development",
  STAGING: "staging",
  PRODUCTION: "production",
  TEST: "test",
} as const;

// Log Levels
export const LOG_LEVELS = {
  TRACE: "trace",
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  FATAL: "fatal",
} as const;

// Database Table Names
export const TABLE_NAMES = {
  USERS: "users",
  TENANTS: "tenants",
  CONTENT: "content",
  MEDIA: "media",
  ROLES: "roles",
  PERMISSIONS: "permissions",
  USER_ROLES: "user_roles",
  ROLE_PERMISSIONS: "role_permissions",
  SESSIONS: "sessions",
  API_KEYS: "api_keys",
  AUDIT_LOGS: "audit_logs",
  WEBHOOKS: "webhooks",
  SETTINGS: "settings",
} as const;

// Error Codes
export const ERROR_CODES = {
  // Authentication errors
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",
  AUTH_FORBIDDEN: "AUTH_FORBIDDEN",

  // Validation errors
  VALIDATION_FAILED: "VALIDATION_FAILED",
  VALIDATION_REQUIRED_FIELD: "VALIDATION_REQUIRED_FIELD",
  VALIDATION_INVALID_FORMAT: "VALIDATION_INVALID_FORMAT",
  VALIDATION_OUT_OF_RANGE: "VALIDATION_OUT_OF_RANGE",

  // Business logic errors
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",
  RESOURCE_CONFLICT: "RESOURCE_CONFLICT",
  OPERATION_NOT_ALLOWED: "OPERATION_NOT_ALLOWED",

  // System errors
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  NETWORK_ERROR: "NETWORK_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

// Rate Limiting
export const RATE_LIMITS = {
  VERY_STRICT: { windowMs: 15 * 60 * 1000, max: 10 }, // 10 requests per 15 minutes
  STRICT: { windowMs: 15 * 60 * 1000, max: 50 }, // 50 requests per 15 minutes
  NORMAL: { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 minutes
  LENIENT: { windowMs: 15 * 60 * 1000, max: 500 }, // 500 requests per 15 minutes
  VERY_LENIENT: { windowMs: 15 * 60 * 1000, max: 1000 }, // 1000 requests per 15 minutes
} as const;

// Regex patterns
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[\d\s\-\(\)]+$/,
  URL: /^https?:\/\/[^\s$.?#].[^\s]*$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  USERNAME: /^[a-zA-Z0-9_-]+$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  IPV4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const;

// Type exports for better TypeScript support
export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
export type ContentType = (typeof CONTENT_TYPES)[keyof typeof CONTENT_TYPES];
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type ContentStatus =
  (typeof CONTENT_STATUS)[keyof typeof CONTENT_STATUS];
export type MediaType = (typeof MEDIA_TYPES)[keyof typeof MEDIA_TYPES];
export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
export type Environment = (typeof ENVIRONMENTS)[keyof typeof ENVIRONMENTS];
export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

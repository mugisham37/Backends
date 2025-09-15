import type { Result } from "./result.types";

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    version?: string;
  };
}

/**
 * Paginated API response
 */
export interface PaginatedApiResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * API request context
 */
export interface ApiRequestContext {
  requestId: string;
  userId?: string;
  tenantId?: string;
  userAgent?: string;
  ip?: string;
  timestamp: Date;
  path: string;
  method: string;
  headers: Record<string, string>;
  query: Record<string, unknown>;
  params: Record<string, string>;
}

/**
 * Base API request interface
 */
export interface BaseApiRequest {
  context?: ApiRequestContext;
}

/**
 * Pagination parameters for API requests
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  cursor?: string;
}

/**
 * Sorting parameters for API requests
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Filtering parameters for API requests
 */
export interface FilterParams {
  search?: string;
  filters?: Record<string, unknown>;
  dateRange?: {
    from?: string;
    to?: string;
  };
}

/**
 * Standard list request parameters
 */
export interface ListRequestParams
  extends PaginationParams,
    SortParams,
    FilterParams {
  include?: string[];
  fields?: string[];
}

/**
 * Authentication request types
 */
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    role: string;
    tenantId?: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Content management request types
 */
export interface CreateContentRequest {
  title: string;
  slug?: string;
  body?: string;
  status?: "draft" | "published" | "archived";
  metadata?: Record<string, unknown>;
  tags?: string[];
  categoryId?: string;
}

export interface UpdateContentRequest {
  title?: string;
  slug?: string;
  body?: string;
  status?: "draft" | "published" | "archived";
  metadata?: Record<string, unknown>;
  tags?: string[];
  categoryId?: string;
}

export interface ContentResponse {
  id: string;
  title: string;
  slug: string;
  body?: string;
  status: "draft" | "published" | "archived";
  version: number;
  metadata?: Record<string, unknown>;
  tags: string[];
  categoryId?: string;
  authorId: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

/**
 * Media management request types
 */
export interface UploadMediaRequest {
  file: File | Buffer;
  filename: string;
  mimeType: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  alt?: string;
  caption?: string;
}

export interface MediaResponse {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
  tags: string[];
  alt?: string;
  caption?: string;
  uploadedBy: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * User management request types
 */
export interface CreateUserRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

export interface UserResponse {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Tenant management request types
 */
export interface CreateTenantRequest {
  name: string;
  slug?: string;
  domain?: string;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateTenantRequest {
  name?: string;
  slug?: string;
  domain?: string;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
}

export interface TenantResponse {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Search request types
 */
export interface SearchRequest extends ListRequestParams {
  query: string;
  type?: "content" | "media" | "user" | "all";
  facets?: string[];
  boost?: Record<string, number>;
}

export interface SearchResponse<T = unknown> {
  results: T[];
  total: number;
  took: number;
  facets?: Record<string, Array<{ value: string; count: number }>>;
  suggestions?: string[];
}

/**
 * Webhook request types
 */
export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
  tenantId?: string;
  userId?: string;
}

export interface WebhookDelivery {
  id: string;
  eventId: string;
  url: string;
  status: "pending" | "success" | "failed" | "retrying";
  attempts: number;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  response?: {
    statusCode: number;
    body?: string;
    headers?: Record<string, string>;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: {
      status: "healthy" | "unhealthy";
      latency?: number;
      error?: string;
    };
    redis: {
      status: "healthy" | "unhealthy";
      latency?: number;
      error?: string;
    };
    search: {
      status: "healthy" | "unhealthy";
      latency?: number;
      error?: string;
    };
  };
}

/**
 * Generic API handler type
 */
export type ApiHandler<TRequest = unknown, TResponse = unknown> = (
  request: TRequest & BaseApiRequest
) => Promise<Result<TResponse, Error>>;

/**
 * API route definition
 */
export interface ApiRoute {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  handler: ApiHandler;
  middleware?: string[];
  schema?: {
    params?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
    response?: Record<string, unknown>;
  };
  auth?: {
    required: boolean;
    roles?: string[];
    permissions?: string[];
  };
  rateLimit?: {
    max: number;
    windowMs: number;
  };
}

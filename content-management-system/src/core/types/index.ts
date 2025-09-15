// Result pattern types
export * from "./result.types";

// Database types
export * from "./database.types";

// API types
export * from "./api.types";

// Service types - NOTE: Some types may conflict with other modules
// If you encounter conflicts, import specific types instead of using export *
// Example: import type { SpecificType } from "./service.types"
// export * from "./service.types";

// Re-export commonly used types for convenience
export type { Result, ResultData, ResultError } from "./result.types";

export type {
  BaseEntity,
  SoftDeleteEntity,
  TenantEntity,
  VersionedEntity,
  AuditableEntity,
  PaginatedResult,
  FilterOptions,
  IRepository,
  ITenantRepository,
  ISoftDeleteRepository,
  User,
  Tenant,
  Content,
  Media,
  Category,
  DatabaseResult,
  DatabaseListResult,
  DatabasePaginatedResult,
} from "./database.types";

export type {
  ApiResponse,
  PaginatedApiResponse,
  ApiRequestContext,
  BaseApiRequest,
  PaginationParams,
  SortParams,
  FilterParams,
  ListRequestParams,
  ApiHandler,
  ApiRoute,
} from "./api.types";

export type {
  IBaseService,
  IAuthService,
  IUserService,
  ITenantService,
  IContentService,
  IMediaService,
  ISearchService,
  ICacheService,
  IWebhookService,
  IAuditService,
  LoginCredentials,
  AuthResult,
  TokenPair,
  UserPayload,
  CreateUserData,
  UpdateUserData,
  CreateTenantData,
  UpdateTenantData,
  CreateContentData,
  UpdateContentData,
  FileUpload,
  MediaMetadata,
  SearchQuery,
  SearchResult,
  WebhookEvent,
  AuditEvent,
  ServiceConfig,
  ServiceRegistry,
} from "./service.types";

/**
 * Global utility types
 */

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Make all properties required recursively
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/**
 * Pick properties by value type
 */
export type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};

/**
 * Omit properties by value type
 */
export type OmitByType<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};

/**
 * Extract keys that have optional values
 */
export type OptionalKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? K : never;
}[keyof T];

/**
 * Extract keys that have required values
 */
export type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

/**
 * Make specific keys optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific keys required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;

/**
 * Create a type with all string keys
 */
export type StringKeys<T> = Extract<keyof T, string>;

/**
 * Create a type with all number keys
 */
export type NumberKeys<T> = Extract<keyof T, number>;

/**
 * Create a type with all symbol keys
 */
export type SymbolKeys<T> = Extract<keyof T, symbol>;

/**
 * Flatten nested object types
 */
export type Flatten<T> = T extends object
  ? T extends infer O
    ? { [K in keyof O]: O[K] }
    : never
  : T;

/**
 * Create a union of all possible paths in an object
 */
export type Paths<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? K | `${K}.${Paths<T[K]>}`
          : K
        : never;
    }[keyof T]
  : never;

/**
 * Get the type of a nested property by path
 */
export type PathValue<
  T,
  P extends Paths<T>
> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? Rest extends Paths<T[K]>
      ? PathValue<T[K], Rest>
      : never
    : never
  : P extends keyof T
  ? T[P]
  : never;

/**
 * Create a type that represents a constructor function
 */
export type Constructor<T = {}> = new (...args: any[]) => T;

/**
 * Create a type that represents an abstract constructor function
 */
export type AbstractConstructor<T = {}> = abstract new (...args: any[]) => T;

/**
 * Create a type that represents a mixin
 */
export type Mixin<T extends Constructor> = InstanceType<T>;

/**
 * Create a branded type for better type safety
 */
export type Brand<T, B> = T & { readonly __brand: B };

/**
 * Create a nominal type for better type safety
 */
export type Nominal<T, N extends string> = T & { readonly [Symbol.species]: N };

/**
 * Environment-specific types
 */
export type Environment = "development" | "test" | "staging" | "production";

export type LogLevel = "error" | "warn" | "info" | "debug" | "trace";

/**
 * HTTP method types
 */
export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

/**
 * HTTP status code types
 */
export type HttpStatusCode =
  | 200
  | 201
  | 202
  | 204
  | 400
  | 401
  | 403
  | 404
  | 409
  | 422
  | 429
  | 500
  | 502
  | 503
  | 504;

/**
 * Common ID types
 */
export type UUID = Brand<string, "UUID">;
export type Email = Brand<string, "Email">;
export type URL = Brand<string, "URL">;
export type Slug = Brand<string, "Slug">;
export type ISODateString = Brand<string, "ISODateString">;
export type JWTToken = Brand<string, "JWTToken">;

/**
 * Validation result type
 */
export interface ValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
}

/**
 * Configuration types
 */
export interface AppConfig {
  env: Environment;
  port: number;
  host: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  database: {
    url: string;
    maxConnections: number;
    ssl: boolean;
  };
  redis: {
    url: string;
    maxRetriesPerRequest: number;
  };
  storage: {
    provider: "local" | "s3" | "gcs";
    bucket?: string;
    region?: string;
    endpoint?: string;
  };
  email: {
    provider: "smtp" | "sendgrid" | "ses";
    from: string;
    apiKey?: string;
  };
  monitoring: {
    enabled: boolean;
    apiKey?: string;
    environment: Environment;
  };
}

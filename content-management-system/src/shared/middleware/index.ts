// Middleware module exports
export * from "./auth";
export * from "./validation";
export * from "./error-handler";
export * from "./rate-limit";
export * from "./tenant.middleware";
export * from "./audit.middleware";
export * from "./monitoring.middleware";
export { ApiKeyMiddleware } from "./api-key.middleware";
export * from "./compression-security";
export * from "./fastify-auth";
export * from "./validate-request";
export * from "./zod-validation";

// Common middleware types
export interface MiddlewareContext {
  request: {
    id: string;
    method: string;
    url: string;
    headers: Record<string, string | string[]>;
    body?: unknown;
    query?: Record<string, string | string[]>;
    params?: Record<string, string>;
  };
  user?: {
    id: string;
    email: string;
    role: string;
    tenantId?: string;
  };
  tenant?: {
    id: string;
    name: string;
    settings?: Record<string, unknown>;
  };
  startTime: number;
  correlationId: string;
}

export interface MiddlewareOptions {
  enabled?: boolean;
  skipPaths?: string[];
  includePaths?: string[];
  priority?: number;
}

export interface AuthMiddlewareOptions extends MiddlewareOptions {
  required?: boolean;
  roles?: string[];
  permissions?: string[];
}

export interface ValidationMiddlewareOptions extends MiddlewareOptions {
  schema?: unknown;
  validateBody?: boolean;
  validateQuery?: boolean;
  validateParams?: boolean;
  validateHeaders?: boolean;
}

export interface RateLimitMiddlewareOptions extends MiddlewareOptions {
  windowMs?: number;
  max?: number;
  keyGenerator?: (context: MiddlewareContext) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface CorsMiddlewareOptions extends MiddlewareOptions {
  origin?: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

// Base middleware interface
export interface Middleware<T = unknown> {
  name: string;
  priority: number;
  options: MiddlewareOptions & T;
  handler: (
    context: MiddlewareContext,
    next: () => Promise<void>
  ) => Promise<void>;
}

// Middleware registry for managing middleware
export class MiddlewareRegistry {
  private middlewares: Map<string, Middleware> = new Map();

  register<T = unknown>(middleware: Middleware<T>): void {
    this.middlewares.set(middleware.name, middleware);
  }

  unregister(name: string): boolean {
    return this.middlewares.delete(name);
  }

  get(name: string): Middleware | undefined {
    return this.middlewares.get(name);
  }

  getAll(): Middleware[] {
    return Array.from(this.middlewares.values()).sort(
      (a, b) => a.priority - b.priority
    );
  }

  getEnabled(): Middleware[] {
    return this.getAll().filter(
      (middleware) => middleware.options.enabled !== false
    );
  }

  clear(): void {
    this.middlewares.clear();
  }
}

// Global middleware registry instance
export const middlewareRegistry = new MiddlewareRegistry();

// Utility functions for middleware
export const createMiddleware = <T = unknown>(
  name: string,
  handler: (
    context: MiddlewareContext,
    next: () => Promise<void>
  ) => Promise<void>,
  options: MiddlewareOptions & T = {} as MiddlewareOptions & T,
  priority = 100
): Middleware<T> => {
  return {
    name,
    priority,
    options: { enabled: true, ...options },
    handler,
  };
};

export const shouldSkipMiddleware = (
  context: MiddlewareContext,
  options: MiddlewareOptions
): boolean => {
  const path = new URL(context.request.url).pathname;

  // Check skip paths
  if (options.skipPaths?.some((skipPath) => path.startsWith(skipPath))) {
    return true;
  }

  // Check include paths
  if (
    options.includePaths &&
    !options.includePaths.some((includePath) => path.startsWith(includePath))
  ) {
    return true;
  }

  return false;
};

export const generateCorrelationId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const extractUserAgent = (
  headers: Record<string, string | string[]>
): string => {
  const userAgent = headers["user-agent"] || headers["User-Agent"];
  const agent = Array.isArray(userAgent) ? userAgent[0] : userAgent;
  return agent || "unknown";
};

export const extractIpAddress = (
  headers: Record<string, string | string[]>
): string => {
  const forwarded = headers["x-forwarded-for"] || headers["X-Forwarded-For"];
  const realIp = headers["x-real-ip"] || headers["X-Real-IP"];

  if (forwarded) {
    const forwardedArray = Array.isArray(forwarded) ? forwarded : [forwarded];
    const firstForwarded = forwardedArray[0];
    return firstForwarded
      ? firstForwarded.split(",")[0]?.trim() || "unknown"
      : "unknown";
  }

  if (realIp) {
    const ip = Array.isArray(realIp) ? realIp[0] : realIp;
    return ip || "unknown";
  }

  return "unknown";
};

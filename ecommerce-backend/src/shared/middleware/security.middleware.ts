/**
 * Security Middleware
 * Comprehensive security headers, input sanitization, and protection mechanisms
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { AppError } from "../../core/errors/app-error.js";
import { config } from "../config/env.config.js";

export interface SecurityOptions {
  contentSecurityPolicy?: {
    directives?: Record<string, string[]>;
    reportOnly?: boolean;
  };
  hsts?: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
  noSniff?: boolean;
  frameguard?: {
    action?: "deny" | "sameorigin" | "allow-from";
    domain?: string;
  };
  xssFilter?: boolean;
  referrerPolicy?: string;
  permittedCrossDomainPolicies?: boolean;
  hidePoweredBy?: boolean;
}

export interface SanitizationOptions {
  body?: boolean;
  query?: boolean;
  params?: boolean;
  headers?: string[];
  maxLength?: number;
  allowedTags?: string[];
  allowedAttributes?: Record<string, string[]>;
}

export class SecurityMiddleware {
  /**
   * Apply security headers middleware
   */
  securityHeaders = (options: SecurityOptions = {}) => {
    const {
      contentSecurityPolicy = {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts = {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      noSniff = true,
      frameguard = { action: "deny" },
      xssFilter = true,
      referrerPolicy = "strict-origin-when-cross-origin",
      permittedCrossDomainPolicies = false,
      hidePoweredBy = true,
    } = options;

    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      // Content Security Policy
      if (contentSecurityPolicy) {
        const cspValue = Object.entries(contentSecurityPolicy.directives || {})
          .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
          .join("; ");

        const headerName = contentSecurityPolicy.reportOnly
          ? "Content-Security-Policy-Report-Only"
          : "Content-Security-Policy";

        reply.header(headerName, cspValue);
      }

      // HTTP Strict Transport Security
      if (hsts && config.nodeEnv === "production") {
        let hstsValue = `max-age=${hsts.maxAge}`;
        if (hsts.includeSubDomains) hstsValue += "; includeSubDomains";
        if (hsts.preload) hstsValue += "; preload";
        reply.header("Strict-Transport-Security", hstsValue);
      }

      // X-Content-Type-Options
      if (noSniff) {
        reply.header("X-Content-Type-Options", "nosniff");
      }

      // X-Frame-Options
      if (frameguard) {
        let frameValue = frameguard.action;
        if (frameguard.action === "allow-from" && frameguard.domain) {
          frameValue += ` ${frameguard.domain}`;
        }
        reply.header("X-Frame-Options", frameValue);
      }

      // X-XSS-Protection
      if (xssFilter) {
        reply.header("X-XSS-Protection", "1; mode=block");
      }

      // Referrer Policy
      if (referrerPolicy) {
        reply.header("Referrer-Policy", referrerPolicy);
      }

      // X-Permitted-Cross-Domain-Policies
      if (!permittedCrossDomainPolicies) {
        reply.header("X-Permitted-Cross-Domain-Policies", "none");
      }

      // Hide X-Powered-By
      if (hidePoweredBy) {
        reply.removeHeader("X-Powered-By");
      }

      // Additional security headers
      reply.header("X-DNS-Prefetch-Control", "off");
      reply.header("X-Download-Options", "noopen");
      reply.header("Cache-Control", "no-cache, no-store, must-revalidate");
      reply.header("Pragma", "no-cache");
      reply.header("Expires", "0");
    };
  };

  /**
   * Input sanitization middleware
   */
  sanitizeInput = (options: SanitizationOptions = {}) => {
    const {
      body = true,
      query = true,
      params = true,
      headers = [],
      maxLength = 10000,
      allowedTags = [],
      allowedAttributes = {},
    } = options;

    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      try {
        // Sanitize request body
        if (body && request.body) {
          request.body = this.sanitizeObject(
            request.body,
            maxLength,
            allowedTags,
            allowedAttributes
          );
        }

        // Sanitize query parameters
        if (query && request.query) {
          request.query = this.sanitizeObject(
            request.query,
            maxLength,
            allowedTags,
            allowedAttributes
          );
        }

        // Sanitize route parameters
        if (params && request.params) {
          request.params = this.sanitizeObject(
            request.params,
            maxLength,
            allowedTags,
            allowedAttributes
          );
        }

        // Sanitize specific headers
        if (headers.length > 0) {
          for (const headerName of headers) {
            const headerValue = request.headers[headerName];
            if (typeof headerValue === "string") {
              request.headers[headerName] = this.sanitizeString(
                headerValue,
                maxLength
              );
            }
          }
        }
      } catch (error) {
        throw new AppError("Invalid input data", 400, "INVALID_INPUT", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    };
  };

  /**
   * CORS middleware with security considerations
   */
  corsMiddleware = (
    options: {
      origin?: string | string[] | boolean;
      credentials?: boolean;
      methods?: string[];
      allowedHeaders?: string[];
      exposedHeaders?: string[];
      maxAge?: number;
    } = {}
  ) => {
    const {
      origin = config.nodeEnv === "development" ? true : false,
      credentials = false,
      methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders = [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "X-Request-ID",
      ],
      exposedHeaders = ["X-Request-ID", "X-RateLimit-Remaining"],
      maxAge = 86400, // 24 hours
    } = options;

    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      const requestOrigin = request.headers.origin;

      // Handle origin
      if (typeof origin === "boolean") {
        if (origin) {
          reply.header("Access-Control-Allow-Origin", requestOrigin || "*");
        }
      } else if (typeof origin === "string") {
        reply.header("Access-Control-Allow-Origin", origin);
      } else if (Array.isArray(origin)) {
        if (requestOrigin && origin.includes(requestOrigin)) {
          reply.header("Access-Control-Allow-Origin", requestOrigin);
        }
      }

      // Handle credentials
      if (credentials) {
        reply.header("Access-Control-Allow-Credentials", "true");
      }

      // Handle preflight requests
      if (request.method === "OPTIONS") {
        reply.header("Access-Control-Allow-Methods", methods.join(", "));
        reply.header("Access-Control-Allow-Headers", allowedHeaders.join(", "));
        reply.header("Access-Control-Max-Age", maxAge.toString());
        reply.status(204).send();
        return;
      }

      // Expose headers
      if (exposedHeaders.length > 0) {
        reply.header(
          "Access-Control-Expose-Headers",
          exposedHeaders.join(", ")
        );
      }
    };
  };

  /**
   * Request size limiting middleware
   */
  requestSizeLimit = (maxSize: number = 1024 * 1024) => {
    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      const contentLength = request.headers["content-length"];

      if (contentLength && parseInt(contentLength, 10) > maxSize) {
        throw new AppError(
          "Request entity too large",
          413,
          "REQUEST_TOO_LARGE",
          { maxSize, receivedSize: contentLength }
        );
      }
    };
  };

  /**
   * IP whitelist/blacklist middleware
   */
  ipFilter = (options: {
    whitelist?: string[];
    blacklist?: string[];
    trustProxy?: boolean;
  }) => {
    const { whitelist, blacklist, trustProxy = true } = options;

    return async (
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void> => {
      const clientIP = this.getClientIP(request, trustProxy);

      // Check blacklist first
      if (blacklist && blacklist.includes(clientIP)) {
        throw new AppError("Access denied", 403, "IP_BLACKLISTED", {
          ip: clientIP,
        });
      }

      // Check whitelist if defined
      if (whitelist && !whitelist.includes(clientIP)) {
        throw new AppError("Access denied", 403, "IP_NOT_WHITELISTED", {
          ip: clientIP,
        });
      }
    };
  };

  /**
   * Sanitize a string value
   */
  private sanitizeString = (
    value: string,
    maxLength: number,
    allowedTags: string[] = [],
    allowedAttributes: Record<string, string[]> = {}
  ): string => {
    if (typeof value !== "string") return value;

    // Limit length
    let sanitized = value.slice(0, maxLength);

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, "");

    // Basic HTML sanitization if no tags are allowed
    if (allowedTags.length === 0) {
      sanitized = sanitized
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;");
    } else {
      // More sophisticated HTML sanitization would go here
      // For now, we'll do basic tag filtering
      sanitized = this.filterHtmlTags(
        sanitized,
        allowedTags,
        allowedAttributes
      );
    }

    // Remove potentially dangerous patterns
    sanitized = sanitized
      .replace(/javascript:/gi, "")
      .replace(/vbscript:/gi, "")
      .replace(/data:/gi, "")
      .replace(/on\w+\s*=/gi, "");

    return sanitized.trim();
  };

  /**
   * Sanitize an object recursively
   */
  private sanitizeObject = (
    obj: any,
    maxLength: number,
    allowedTags: string[],
    allowedAttributes: Record<string, string[]>
  ): any => {
    if (typeof obj === "string") {
      return this.sanitizeString(
        obj,
        maxLength,
        allowedTags,
        allowedAttributes
      );
    }

    if (Array.isArray(obj)) {
      return obj.map((item) =>
        this.sanitizeObject(item, maxLength, allowedTags, allowedAttributes)
      );
    }

    if (obj && typeof obj === "object") {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key, 100); // Limit key length
        sanitized[sanitizedKey] = this.sanitizeObject(
          value,
          maxLength,
          allowedTags,
          allowedAttributes
        );
      }
      return sanitized;
    }

    return obj;
  };

  /**
   * Basic HTML tag filtering
   */
  private filterHtmlTags = (
    html: string,
    allowedTags: string[],
    allowedAttributes: Record<string, string[]>
  ): string => {
    // This is a basic implementation
    // In production, consider using a library like DOMPurify
    return html.replace(
      /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/gi,
      (match, tag) => {
        if (allowedTags.includes(tag.toLowerCase())) {
          // Filter attributes if needed
          return match; // Simplified - would need proper attribute filtering
        }
        return "";
      }
    );
  };

  /**
   * Extract client IP address
   */
  private getClientIP = (
    request: FastifyRequest,
    trustProxy: boolean
  ): string => {
    if (trustProxy) {
      const forwarded = request.headers["x-forwarded-for"] as string;
      if (forwarded) {
        return forwarded.split(",")[0].trim();
      }

      const realIP = request.headers["x-real-ip"] as string;
      if (realIP) {
        return realIP;
      }
    }

    return request.ip || "unknown";
  };
}

// Singleton instance
export const securityMiddleware = new SecurityMiddleware();

// Predefined security configurations
export const securityConfigs = {
  // Strict security for production
  strict: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: "deny" as const },
  },

  // Relaxed security for development
  development: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
    hsts: undefined, // No HSTS in development
  },

  // API-specific security
  api: {
    contentSecurityPolicy: undefined, // Not needed for API-only responses
    frameguard: { action: "deny" as const },
    noSniff: true,
    xssFilter: false, // Not needed for JSON APIs
  },
};

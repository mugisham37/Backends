/**
 * Comprehensive Middleware Plugin
 * Integrates all advanced middleware functionality
 */

import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import fp from "fastify-plugin";
import {
  requestIdMiddleware,
  createRequestLoggingMiddleware,
  createPerformanceMiddleware,
  createApiVersionMiddleware,
} from "../middleware/index.js";
import { config } from "../config/env.config.js";

export interface AdvancedMiddlewareOptions {
  // Request ID options
  requestId?: {
    enabled?: boolean;
  };

  // Request logging options
  requestLogging?: {
    enabled?: boolean;
    logRequests?: boolean;
    logResponses?: boolean;
    logHeaders?: boolean;
    logBody?: boolean;
    excludePaths?: string[];
    sensitiveFields?: string[];
  };

  // Performance monitoring options
  performance?: {
    enabled?: boolean;
  };

  // API versioning options
  apiVersioning?: {
    enabled?: boolean;
    defaultVersion?: string;
    supportedVersions?: string[];
    deprecatedVersions?: string[];
  };
}

async function advancedMiddlewarePlugin(
  fastify: FastifyInstance,
  options: AdvancedMiddlewareOptions = {}
) {
  const {
    requestId: requestIdOpts = { enabled: true },
    requestLogging: requestLoggingOpts = {
      enabled: true,
      logRequests: config.nodeEnv !== "production",
      logResponses: true,
      logHeaders: false,
      logBody: config.nodeEnv === "development",
      excludePaths: ["/health", "/metrics", "/ready"],
      sensitiveFields: [
        "password",
        "token",
        "authorization",
        "cookie",
        "secret",
      ],
    },
    performance: performanceOpts = { enabled: true },
    apiVersioning: apiVersioningOpts = {
      enabled: true,
      defaultVersion: "v1",
      supportedVersions: ["v1"],
      deprecatedVersions: [],
    },
  } = options;

  // Register Request ID middleware
  if (requestIdOpts.enabled) {
    fastify.addHook("onRequest", requestIdMiddleware);
    fastify.log.info("✅ Request ID middleware registered");
  }

  // Register API Versioning middleware
  if (apiVersioningOpts.enabled) {
    const apiVersionMiddleware = createApiVersionMiddleware({
      defaultVersion: apiVersioningOpts.defaultVersion!,
      supportedVersions: apiVersioningOpts.supportedVersions!,
      deprecatedVersions: apiVersioningOpts.deprecatedVersions!,
    });

    fastify.addHook("onRequest", apiVersionMiddleware);
    fastify.log.info("✅ API versioning middleware registered");
  }

  // Register Request Logging middleware
  if (requestLoggingOpts.enabled) {
    const requestLoggingMiddleware = createRequestLoggingMiddleware({
      logRequests: requestLoggingOpts.logRequests,
      logResponses: requestLoggingOpts.logResponses,
      logHeaders: requestLoggingOpts.logHeaders,
      logBody: requestLoggingOpts.logBody,
      excludePaths: requestLoggingOpts.excludePaths,
      sensitiveFields: requestLoggingOpts.sensitiveFields,
    });

    fastify.addHook("onRequest", requestLoggingMiddleware);
    fastify.log.info("✅ Request logging middleware registered");
  }

  // Register Performance monitoring middleware
  if (performanceOpts.enabled) {
    const performanceMiddleware = createPerformanceMiddleware();
    fastify.addHook("onRequest", performanceMiddleware);
    fastify.log.info("✅ Performance monitoring middleware registered");
  }

  // Add utility decorators
  fastify.decorate("getRequestId", function (request: any) {
    return request.id || "unknown";
  });

  fastify.decorate("getApiVersion", function (request: any) {
    return request.apiVersion || "v1";
  });

  fastify.log.info("✅ Advanced middleware plugin registered successfully");
}

export default fp(advancedMiddlewarePlugin, {
  name: "advanced-middleware",
  dependencies: [],
});

// Presets for different environments
export const middlewarePresets = {
  production: {
    requestId: { enabled: true },
    requestLogging: {
      enabled: true,
      logRequests: false,
      logResponses: true,
      logHeaders: false,
      logBody: false,
      excludePaths: ["/health", "/metrics", "/ready"],
      sensitiveFields: [
        "password",
        "token",
        "authorization",
        "cookie",
        "secret",
        "key",
        "pass",
      ],
    },
    performance: { enabled: true },
    apiVersioning: {
      enabled: true,
      defaultVersion: "v1",
      supportedVersions: ["v1"],
      deprecatedVersions: [],
    },
  },

  development: {
    requestId: { enabled: true },
    requestLogging: {
      enabled: true,
      logRequests: true,
      logResponses: true,
      logHeaders: true,
      logBody: true,
      excludePaths: ["/health", "/metrics", "/ready"],
      sensitiveFields: ["password", "token", "authorization"],
    },
    performance: { enabled: true },
    apiVersioning: {
      enabled: true,
      defaultVersion: "v1",
      supportedVersions: ["v1"],
      deprecatedVersions: [],
    },
  },

  test: {
    requestId: { enabled: false },
    requestLogging: { enabled: false },
    performance: { enabled: false },
    apiVersioning: { enabled: false },
  },
};

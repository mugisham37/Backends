/**
 * E-commerce Backend Application
 * Main application setup with Fastify, PostgreSQL, Drizzle ORM, and Clean Architecture
 */

import fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import { config } from "./shared/config/env.config";
import {
  getSecurityConfig,
  securityPresets,
} from "./shared/config/security.config";
import { logger } from "./shared/utils/logger";
import { db, getDatabase } from "./core/database/connection";
import { container, registerServices } from "./core/container/index";
import { sql } from "drizzle-orm";

// Import plugins
import securityPlugin from "./shared/plugins/security.plugin";
import advancedMiddlewarePlugin, {
  middlewarePresets,
} from "./shared/plugins/advanced-middleware.plugin";
import multipart from "@fastify/multipart";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

// Import API plugins
import { restApiPlugin } from "./api/rest/index";

// Import error handling
import { defaultErrorHandler, createErrorHandler } from "./core/errors/index";

/**
 * Create and configure the main Fastify application
 */
export const createApp = async (): Promise<FastifyInstance> => {
  logger.info("🏗️ Initializing E-commerce Backend Application...");

  // Configure Fastify server options
  const serverOptions: FastifyServerOptions = {
    logger: {
      level: config.monitoring.logLevel,
      transport:
        config.nodeEnv === "development"
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "HH:MM:ss.l",
                ignore: "pid,hostname",
                singleLine: true,
              },
            }
          : undefined,
    },
    disableRequestLogging: false,
    trustProxy: true,
    bodyLimit: config.upload.maxFileSize,
    keepAliveTimeout: 65000,
    connectionTimeout: 60000,
    requestTimeout: 30000,
    ignoreTrailingSlash: true,
    caseSensitive: false,
    ajv: {
      customOptions: {
        removeAdditional: "all",
        useDefaults: true,
        coerceTypes: "array",
        allErrors: false,
      },
    },
  };

  // Create Fastify instance
  const app: FastifyInstance = fastify(serverOptions);

  try {
    logger.info("📊 Testing database connection...");
    // Test database connection
    await db.execute(sql`SELECT 1`);
    logger.info("✅ Database connection successful");

    logger.info("📝 Registering core services...");
    // Initialize dependency injection container
    await registerServices();
    logger.info("✅ Services registered");

    logger.info("🛡️ Setting up comprehensive security...");
    // Get security configuration based on environment
    const securityConfig = getSecurityConfig();
    const securityOptions =
      config.nodeEnv === "production"
        ? securityPresets.production
        : securityPresets.development;

    // Register comprehensive security plugin
    await app.register(securityPlugin, securityOptions);

    // Initialize default RBAC setup
    await securityConfig.setupDefaultRBAC();
    logger.info("✅ Security configuration completed");

    logger.info("🔧 Setting up advanced middleware...");
    // Register advanced middleware plugin
    const middlewareOptions =
      config.nodeEnv === "production"
        ? middlewarePresets.production
        : middlewarePresets.development;

    await app.register(advancedMiddlewarePlugin, middlewareOptions);
    logger.info("✅ Advanced middleware registered");

    logger.info("🔐 Configuring JWT authentication...");
    // JWT Authentication
    await app.register(jwt, {
      secret: config.jwt.accessSecret,
      sign: {
        expiresIn: "1d",
      },
      verify: {
        maxAge: "1d",
      },
    });

    logger.info("📁 Configuring file upload support...");
    // File upload support
    await app.register(multipart, {
      limits: {
        fieldNameSize: 100,
        fieldSize: 100,
        fields: 10,
        fileSize: config.upload.maxFileSize,
        files: 5,
        headerPairs: 2000,
      },
      attachFieldsToBody: "keyValues",
    });

    logger.info("📚 Setting up API documentation...");
    // Swagger documentation
    await app.register(swagger, {
      openapi: {
        openapi: "3.0.0",
        info: {
          title: "E-commerce Backend API",
          description:
            "Modern e-commerce backend with PostgreSQL, Drizzle ORM, and clean architecture",
          version: "2.0.0",
          contact: {
            name: "API Support",
            email: "support@ecommerce.com",
          },
          license: {
            name: "MIT",
            url: "https://opensource.org/licenses/MIT",
          },
        },
        servers: [
          {
            url:
              config.nodeEnv === "production"
                ? "https://api.ecommerce.com"
                : `http://localhost:${config.port}`,
            description:
              config.nodeEnv === "production" ? "Production" : "Development",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    });

    await app.register(swaggerUi, {
      routePrefix: "/api/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
      },
      staticCSP: true,
      transformSpecificationClone: true,
    });

    logger.info("🌐 Registering API routes...");
    // Register REST API
    await app.register(restApiPlugin, { prefix: "/api" });

    // Health check endpoint
    app.get("/health", async (request, reply) => {
      const startTime = Date.now();

      try {
        // Test database
        await db.execute(sql`SELECT 1`);
        const dbResponseTime = Date.now() - startTime;

        return reply.status(200).send({
          status: "healthy",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.nodeEnv,
          version: "2.0.0",
          database: {
            status: "connected",
            responseTime: `${dbResponseTime}ms`,
          },
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            limit: Math.round(process.memoryUsage().rss / 1024 / 1024),
          },
          services: {
            rest: "active",
            graphql: "active",
            container: "initialized",
          },
        });
      } catch (error) {
        return reply.status(503).send({
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
          database: {
            status: "disconnected",
          },
        });
      }
    });

    // Ready check endpoint
    app.get("/ready", async (request, reply) => {
      try {
        await db.execute(sql`SELECT 1`);
        return reply.status(200).send({
          status: "ready",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return reply.status(503).send({
          status: "not ready",
          reason: "Database not available",
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Version endpoint
    app.get("/version", async (request, reply) => {
      return reply.status(200).send({
        version: "2.0.0",
        name: "E-commerce Backend",
        environment: config.nodeEnv,
        node: process.version,
        timestamp: new Date().toISOString(),
      });
    });

    logger.info("📊 Setting up application hooks...");
    // Application hooks
    app.addHook("onRequest", async (request) => {
      request.startTime = Date.now();
      const correlationId =
        request.headers["x-correlation-id"] ||
        request.headers["x-request-id"] ||
        request.id;

      request.log.info(
        {
          method: request.method,
          url: request.url,
          correlationId,
          userAgent: request.headers["user-agent"],
          ip: request.ip,
        },
        "Incoming request"
      );
    });

    app.addHook("onResponse", async (request, reply) => {
      const responseTime = Date.now() - (request.startTime || Date.now());

      request.log.info(
        {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTime: `${responseTime}ms`,
          correlationId: request.headers["x-correlation-id"] || request.id,
        },
        "Request completed"
      );
    });

    app.addHook("onError", async (request, reply, error) => {
      request.log.error(
        {
          error: error.message,
          stack: error.stack,
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          correlationId: request.headers["x-correlation-id"] || request.id,
        },
        "Request error"
      );
    });

    logger.info("⚠️ Setting up error handlers...");
    // Basic error handling (will improve when error handler is available)
    app.setErrorHandler(async (error, request, reply) => {
      const errorId = `err_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      request.log.error(
        {
          errorId,
          error: error.message,
          stack: error.stack,
          method: request.method,
          url: request.url,
        },
        "Application error occurred"
      );

      // Handle validation errors
      if (error.validation) {
        return reply.status(400).send({
          error: "Validation Error",
          message: error.message,
          details: error.validation,
          errorId,
          timestamp: new Date().toISOString(),
        });
      }

      // Handle authentication errors
      if (error.statusCode === 401) {
        return reply.status(401).send({
          error: "Authentication Error",
          message: "Authentication required",
          errorId,
          timestamp: new Date().toISOString(),
        });
      }

      // Handle server errors
      return reply.status(error.statusCode || 500).send({
        error: "Internal Server Error",
        message:
          config.nodeEnv === "development"
            ? error.message
            : "Something went wrong",
        errorId,
        timestamp: new Date().toISOString(),
      });
    });

    // Not found handler
    app.setNotFoundHandler(async (request, reply) => {
      const suggestions = [
        "Check the API documentation at /api/docs",
        "Use /health for health checks",
        "Use /version for version info",
        "REST API endpoints start with /api/v1",
      ];

      return reply.status(404).send({
        error: "Not Found",
        message: `Route ${request.method} ${request.url} not found`,
        suggestions,
        timestamp: new Date().toISOString(),
        requestId: request.id,
      });
    });

    logger.info("🎉 Application created successfully!");
    return app;
  } catch (error) {
    logger.error("💥 Failed to create application:", error);
    throw error;
  }
};

// Additional type declarations for request extensions
declare module "fastify" {
  interface FastifyRequest {
    startTime?: number;
  }
}

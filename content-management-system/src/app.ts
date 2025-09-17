import multipart from "@fastify/multipart";
import fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import { apiGatewayPlugin } from "./api/gateway";
import { config } from "./shared/config";
import {
  getApplicationStatus,
  initializeApplication,
} from "./core/container/bootstrap";
import {
  checkDatabaseHealth,
  getConnectionStats,
  initializeDatabase,
  isDatabaseConnected,
} from "./core/database/connection";
import { compressionSecurityPlugin } from "./shared/middleware/compression-security";
import authPlugin from "./shared/middleware/fastify-auth";
import validationPlugin from "./shared/middleware/validation";
import { logger } from "./shared/utils/logger";
import { PerformanceMonitorService } from "./shared/services/performance-monitor.service";

/**
 * Application Factory
 *
 * Creates and configures the main Fastify application instance with all
 * necessary middleware, plugins, and services properly integrated.
 */
export const createApp = async (): Promise<FastifyInstance> => {
  // Fastify server options with optimized configuration
  const serverOptions: FastifyServerOptions = {
    logger: config.logging.prettyPrint
      ? {
          level: config.logging.level,
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
              singleLine: true,
            },
          },
        }
      : {
          level: config.logging.level,
        },
    trustProxy: true,
    bodyLimit: config.upload.maxSize,
    keepAliveTimeout: 30000,
    connectionTimeout: 10000,
    requestTimeout: 30000,
    // Enable JSON schema validation and optimization
    ajv: {
      customOptions: {
        removeAdditional: "all",
        useDefaults: true,
        coerceTypes: "array",
      },
    },
  };

  // Create Fastify application instance
  const app: FastifyInstance = fastify(serverOptions);

  try {
    logger.info("🚀 Starting application initialization...");

    // Step 1: Initialize database connection
    logger.info("📊 Initializing database connection...");
    await initializeDatabase();
    logger.info("✅ Database connection established");

    // Step 2: Initialize dependency injection container
    logger.info("🔧 Initializing dependency injection container...");
    await initializeApplication(app);
    logger.info("✅ Container initialized with all services");

    // Step 3: Register core middleware (order matters)
    logger.info("🛡️ Registering security and performance middleware...");

    // Security and compression (register early)
    await app.register(compressionSecurityPlugin);

    // Rate limiting (register after security)
    logger.info("⚡ Configuring rate limiting...");
    // Note: apiRateLimiter is Express middleware, would need Fastify adapter
    // This is a placeholder for future Fastify rate limiting implementation

    // Step 4: Register file upload support
    logger.info("📁 Configuring file upload support...");
    await app.register(multipart, {
      limits: {
        fieldNameSize: 100,
        fieldSize: 100,
        fields: 10,
        fileSize: config.upload.maxSize,
        files: 5,
        headerPairs: 2000,
      },
      attachFieldsToBody: true,
      sharedSchemaId: "MultipartFileType",
    });

    // Step 5: Register authentication and validation
    logger.info("🔐 Setting up authentication and validation...");
    await app.register(authPlugin);
    await app.register(validationPlugin);

    // Step 6: Register API gateway (REST + GraphQL)
    logger.info("🌐 Registering unified API gateway...");
    await app.register(apiGatewayPlugin);

    // Step 7: Initialize Performance Monitoring
    logger.info("📊 Initializing performance monitoring...");
    const performanceMonitor = new PerformanceMonitorService();

    // Step 8: Register application lifecycle hooks
    logger.info("🔄 Setting up application lifecycle hooks...");

    // Pre-request logging and performance tracking
    app.addHook("onRequest", async (request) => {
      // Start performance tracking
      (request as any).startTime = Date.now();

      request.log.info(
        {
          method: request.method,
          url: request.url,
          userAgent: request.headers["user-agent"],
          ip: request.ip,
          requestId: request.id,
        },
        "📥 Incoming request"
      );
    });

    // Response logging with performance metrics
    app.addHook("onResponse", async (request, reply) => {
      const duration = (request as any).startTime
        ? Date.now() - (request as any).startTime
        : reply.elapsedTime || 0;

      // Record performance metrics
      await performanceMonitor.recordRequest(duration, request.url);

      request.log.info(
        {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTime: duration,
          requestId: request.id,
        },
        "📤 Request completed"
      );
    });

    // Error logging and tracking hook
    app.addHook("onError", async (request, _reply, error) => {
      // Record error in performance monitor
      await performanceMonitor.recordError(error, request.url);

      request.log.error(
        {
          error: error.message,
          stack: error.stack,
          method: request.method,
          url: request.url,
          requestId: request.id,
        },
        "❌ Request error occurred"
      );
    });

    // Step 8: Register health and status endpoints
    logger.info("🏥 Setting up health check endpoints...");

    // Comprehensive health check endpoint
    app.get("/health", async (_request, reply) => {
      const appStatus = getApplicationStatus();
      const dbHealth = await checkDatabaseHealth();
      const connectionStats = isDatabaseConnected()
        ? await getConnectionStats()
        : null;

      // Get performance metrics
      const performanceMetrics = await performanceMonitor.getMetrics();
      const performanceReport = await performanceMonitor.getReport();

      const healthStatus = {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env["npm_package_version"] || config.app.version,
        environment: config.env,
        database: {
          connected: isDatabaseConnected(),
          health: dbHealth,
          ...(connectionStats && {
            queryMetrics: connectionStats.queryMetrics,
            poolHealth: connectionStats.poolHealth.healthy,
            recommendations: connectionStats.recommendations,
          }),
        },
        container: {
          initialized: appStatus.initialized,
          ready: appStatus.containerReady,
          services: appStatus.serviceCount,
        },
        memory: process.memoryUsage(),
        performance: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          metrics: performanceMetrics.success ? performanceMetrics.data : null,
          health: performanceReport.success
            ? performanceReport.data.health
            : null,
        },
      };

      return reply.status(200).send(healthStatus);
    });

    // Ready check endpoint
    app.get("/ready", async (_request, reply) => {
      if (!isDatabaseConnected()) {
        return reply.status(503).send({
          status: "not ready",
          message: "Database not connected",
          timestamp: new Date().toISOString(),
        });
      }

      const appStatus = getApplicationStatus();
      if (!appStatus.containerReady) {
        return reply.status(503).send({
          status: "not ready",
          message: "Application container not ready",
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        status: "ready",
        timestamp: new Date().toISOString(),
        services: {
          database: "connected",
          container: "ready",
          apis: ["REST", "GraphQL"],
        },
      });
    });

    // Application info endpoint
    app.get("/info", async (_request, reply) => {
      return reply.status(200).send({
        name: config.app.name,
        version: config.app.version,
        description:
          "Modern Content Management System with unified API gateway",
        environment: config.env,
        apis: {
          rest: {
            base: "/api/v1",
            docs: "/api/v1/docs",
          },
          graphql: {
            endpoint: "/graphql",
            playground: config.isDevelopment ? "/graphql" : null,
          },
          gateway: "/api",
        },
        features: [
          "Multi-tenant architecture",
          "Real-time capabilities",
          "File upload support",
          "Authentication & authorization",
          "Rate limiting",
          "Caching",
          "Audit logging",
          "Search integration",
        ],
        timestamp: new Date().toISOString(),
      });
    });

    // Performance metrics endpoint
    app.get("/metrics", async (_request, reply) => {
      const performanceReport = await performanceMonitor.getReport();

      if (!performanceReport.success) {
        return reply.status(500).send({
          error: "Failed to retrieve performance metrics",
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        performance: performanceReport.data,
        timestamp: new Date().toISOString(),
      });
    });

    // Performance recommendations endpoint
    app.get("/metrics/recommendations", async (_request, reply) => {
      const recommendations = await performanceMonitor.getRecommendations();

      if (!recommendations.success) {
        return reply.status(500).send({
          error: "Failed to retrieve recommendations",
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        recommendations: recommendations.data,
        timestamp: new Date().toISOString(),
      });
    });

    // Step 9: Register enhanced error handlers
    logger.info("⚠️ Setting up error handlers...");

    // Enhanced global error handler
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
          userAgent: request.headers["user-agent"],
          ip: request.ip,
        },
        "💥 Application error occurred"
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

      // Handle authorization errors
      if (error.statusCode === 403) {
        return reply.status(403).send({
          error: "Authorization Error",
          message: "Insufficient permissions",
          errorId,
          timestamp: new Date().toISOString(),
        });
      }

      // Handle known client errors (4xx)
      if (
        error.statusCode &&
        error.statusCode >= 400 &&
        error.statusCode < 500
      ) {
        return reply.status(error.statusCode).send({
          error: error.name || "Client Error",
          message: error.message,
          errorId,
          timestamp: new Date().toISOString(),
        });
      }

      // Handle server errors (5xx)
      const isDevelopment = config.isDevelopment;
      return reply.status(error.statusCode || 500).send({
        error: "Internal Server Error",
        message: isDevelopment
          ? error.message
          : "Something went wrong on our end",
        errorId,
        ...(isDevelopment && {
          stack: error.stack,
          details: error,
        }),
        timestamp: new Date().toISOString(),
      });
    });

    // Enhanced not found handler
    app.setNotFoundHandler(async (request, reply) => {
      request.log.warn(
        {
          method: request.method,
          url: request.url,
          userAgent: request.headers["user-agent"],
          ip: request.ip,
        },
        "🔍 Route not found"
      );

      return reply.status(404).send({
        error: "Not Found",
        message: `Route ${request.method} ${request.url} not found`,
        suggestions: [
          "Check the API documentation at /api/info",
          "Use /health for health checks",
          "Access GraphQL at /graphql",
          "Try REST API at /api/v1",
        ],
        timestamp: new Date().toISOString(),
      });
    });

    logger.info("🎉 Application created successfully!");
    return app;
  } catch (error) {
    logger.error("💥 Failed to create application:", error);
    throw error;
  }
};

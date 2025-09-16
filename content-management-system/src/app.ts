import fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import multipart from "@fastify/multipart";
import { config } from "./config";
import {
  initializeDatabase,
  isDatabaseConnected,
  checkDatabaseHealth,
  getConnectionStats,
} from "./core/database/connection";
import { logger } from "./utils/logger";
import {
  initializeApplication,
  getApplicationStatus,
} from "./core/container/bootstrap";
import authPlugin from "./middleware/fastify-auth";
import validationPlugin from "./middleware/validation";
import { apiGatewayPlugin } from "./api/gateway";
import { compressionSecurityPlugin } from "./middleware/compression-security";

export const createApp = async (): Promise<FastifyInstance> => {
  // Fastify server options with proper typing
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
  };

  // Create Fastify application
  const app: FastifyInstance = fastify(serverOptions);

  try {
    // Initialize database connection
    await initializeDatabase();

    // Initialize dependency injection container
    await initializeApplication(app);

    // Register optimized compression and security middleware
    await app.register(compressionSecurityPlugin);

    // Register multipart support for file uploads
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

    // Register authentication plugin
    await app.register(authPlugin);

    // Register validation plugin
    await app.register(validationPlugin);

    // Register unified API gateway
    await app.register(apiGatewayPlugin);

    // Health check endpoint with enhanced metrics
    app.get("/health", async (_request, reply) => {
      const appStatus = getApplicationStatus();
      const dbHealth = await checkDatabaseHealth();
      const connectionStats = isDatabaseConnected()
        ? await getConnectionStats()
        : null;

      const healthStatus = {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env["npm_package_version"] || "1.0.0",
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
        });
      }

      return reply.status(200).send({
        status: "ready",
        timestamp: new Date().toISOString(),
      });
    });

    // Global error handler
    app.setErrorHandler(async (error, request, reply) => {
      request.log.error(error);

      // Handle validation errors
      if (error.validation) {
        return reply.status(400).send({
          error: "Validation Error",
          message: error.message,
          details: error.validation,
          timestamp: new Date().toISOString(),
        });
      }

      // Handle known errors with status codes
      if (error.statusCode && error.statusCode < 500) {
        return reply.status(error.statusCode).send({
          error: error.name,
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }

      // Handle server errors
      const isDevelopment = config.env === "development";
      return reply.status(500).send({
        error: "Internal Server Error",
        message: isDevelopment ? error.message : "Something went wrong",
        ...(isDevelopment && { stack: error.stack }),
        timestamp: new Date().toISOString(),
      });
    });

    // Not found handler
    app.setNotFoundHandler(async (request, reply) => {
      return reply.status(404).send({
        error: "Not Found",
        message: `Route ${request.method}:${request.url} not found`,
        timestamp: new Date().toISOString(),
      });
    });

    // Add request logging
    app.addHook("onRequest", async (request) => {
      request.log.info(
        {
          method: request.method,
          url: request.url,
          userAgent: request.headers["user-agent"],
          ip: request.ip,
        },
        "Incoming request"
      );
    });

    // Add response logging
    app.addHook("onResponse", async (request, reply) => {
      request.log.info(
        {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTime: reply.elapsedTime,
        },
        "Request completed"
      );
    });

    return app;
  } catch (error) {
    logger.error("Failed to create application:", error);
    throw error;
  }
};

/**
 * Content Management System Backend Application
 * Streamlined application factory with essential functionality
 */

import { sql } from "drizzle-orm";
import fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import {
  getDatabase,
  initializeDatabase as initDb,
} from "./core/database/index.js";
import { config } from "./shared/config/env.config.js";
import { logger } from "./shared/utils/logger.js";

import compress from "@fastify/compress";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
// Core Fastify plugins
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

// API modules
import { setupRestApi } from "./api/rest/index.js";

// Error handling
import { createErrorHandler } from "./core/errors/index.js";

// Service registration
import { registerAllServices } from "./core/container/registry.js";

/**
 * Initialize database connection
 */
const initializeDatabase = async (): Promise<void> => {
  try {
    logger.info("📊 Initializing database...");
    await initDb();

    // Basic health check
    const db = getDatabase();
    await db.execute(sql`SELECT 1`);

    logger.info("✅ Database initialized");
  } catch (error) {
    logger.error("❌ Database initialization failed:", error);
    throw error;
  }
};

/**
 * Initialize services
 */
const initializeServices = async (): Promise<void> => {
  try {
    logger.info("📝 Initializing services...");
    await registerAllServices();
    logger.info("✅ Services initialized");
  } catch (error) {
    logger.error("❌ Service initialization failed:", error);
    throw error;
  }
};

/**
 * Configure core plugins
 */
const configureCorePlugins = async (app: FastifyInstance): Promise<void> => {
  try {
    logger.info("🔧 Setting up core plugins...");

    // CORS
    await app.register(cors, {
      origin: config.cors.origin,
      credentials: config.cors.credentials,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Tenant-ID",
        "X-API-Key",
      ],
    });

    // Security headers
    await app.register(
      helmet,
      config.isProduction
        ? {}
        : {
            contentSecurityPolicy: false,
          }
    );

    // Compression
    await app.register(compress, {
      global: true,
      threshold: 1024,
    });

    // Rate limiting
    await app.register(rateLimit, {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.windowMs,
    });

    logger.info("✅ Core plugins configured");
  } catch (error) {
    logger.error("❌ Core plugins configuration failed:", error);
    throw error;
  }
};

/**
 * Configure JWT authentication
 */
const configureJWT = async (app: FastifyInstance): Promise<void> => {
  try {
    logger.info("🔐 Configuring JWT...");

    await app.register(jwt, {
      secret: config.jwt.accessSecret,
      sign: {
        expiresIn: config.jwt.accessExpiresIn,
      },
      verify: {
        maxAge: config.jwt.accessExpiresIn,
      },
    });

    logger.info("✅ JWT configured");
  } catch (error) {
    logger.error("❌ JWT configuration failed:", error);
    throw error;
  }
};

/**
 * Configure file upload
 */
const configureFileUpload = async (app: FastifyInstance): Promise<void> => {
  try {
    logger.info("📁 Configuring file upload...");

    await app.register(multipart, {
      limits: {
        fileSize: config.upload.maxFileSize,
        files: 5,
      },
      attachFieldsToBody: "keyValues",
    });

    logger.info("✅ File upload configured");
  } catch (error) {
    logger.error("❌ File upload configuration failed:", error);
    throw error;
  }
};

/**
 * Configure API documentation
 */
const configureDocumentation = async (app: FastifyInstance): Promise<void> => {
  try {
    logger.info("📚 Setting up API documentation...");

    // Swagger/OpenAPI
    await app.register(swagger, {
      openapi: {
        openapi: "3.0.0",
        info: {
          title: "Content Management System API",
          description:
            "Modern CMS with PostgreSQL, Drizzle ORM, and clean architecture",
          version: "2.0.0",
        },
        servers: [
          {
            url: `http://localhost:${config.port}`,
            description: "Development",
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

    // Swagger UI
    await app.register(swaggerUi, {
      routePrefix: "/api/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true,
      },
    });

    logger.info("✅ API documentation configured");
  } catch (error) {
    logger.error("❌ Documentation configuration failed:", error);
    throw error;
  }
};

/**
 * Register API routes
 */
const registerAPIRoutes = async (app: FastifyInstance): Promise<void> => {
  try {
    logger.info("🌐 Registering API routes...");

    // Register REST API
    await app.register(
      async (fastify) => {
        await setupRestApi(fastify);
      },
      {
        prefix: "/api/v1",
      }
    );

    logger.info("✅ API routes registered");
  } catch (error) {
    logger.error("❌ API routes registration failed:", error);
    throw error;
  }
};

/**
 * Configure monitoring endpoints
 */
const configureMonitoring = async (app: FastifyInstance): Promise<void> => {
  try {
    logger.info("📊 Setting up monitoring...");

    // Health check
    app.get("/health", async (_request, reply) => {
      try {
        const db = getDatabase();
        await db.execute(sql`SELECT 1`);

        const memoryUsage = process.memoryUsage();

        return reply.send({
          status: "healthy",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.nodeEnv,
          version: "2.0.0",
          database: { status: "connected" },
          memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          },
        });
      } catch (error) {
        return reply.status(503).send({
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });

    // Ready check
    app.get("/ready", async (_request, reply) => {
      try {
        const db = getDatabase();
        await db.execute(sql`SELECT 1`);
        return reply.send({
          status: "ready",
          timestamp: new Date().toISOString(),
        });
      } catch (_error) {
        return reply.status(503).send({
          status: "not ready",
          reason: "Database not available",
        });
      }
    });

    // Version info
    app.get("/version", async (_request, reply) => {
      return reply.send({
        version: "2.0.0",
        name: "Content Management System Backend",
        environment: config.nodeEnv,
        node: process.version,
        timestamp: new Date().toISOString(),
      });
    });

    // Metrics
    app.get("/metrics", async (_request, reply) => {
      const memoryUsage = process.memoryUsage();
      return reply.send({
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
        process: {
          pid: process.pid,
          platform: process.platform,
          arch: process.arch,
        },
      });
    });

    logger.info("✅ Monitoring configured");
  } catch (error) {
    logger.error("❌ Monitoring configuration failed:", error);
    throw error;
  }
};

/**
 * Configure error handling
 */
const configureErrorHandling = async (app: FastifyInstance): Promise<void> => {
  try {
    logger.info("⚠️ Setting up error handling...");

    // Request logging
    app.addHook("onRequest", async (request) => {
      (request as any).startTime = Date.now();
    });

    app.addHook("onResponse", async (request, _reply) => {
      const responseTime =
        Date.now() - ((request as any).startTime || Date.now());

      if (responseTime > 1000) {
        request.log.warn(
          `Slow request: ${request.method} ${request.url} - ${responseTime}ms`
        );
      }
    });

    // Error handler
    const errorHandler = createErrorHandler(
      {
        logErrors: true,
        includeStackTrace: config.isDevelopment,
        sanitizeErrors: config.isProduction,
      },
      logger
    );

    app.setErrorHandler(errorHandler);

    // 404 handler
    app.setNotFoundHandler(async (request, reply) => {
      return reply.status(404).send({
        error: "Not Found",
        message: `Route ${request.method} ${request.url} not found`,
        timestamp: new Date().toISOString(),
      });
    });

    logger.info("✅ Error handling configured");
  } catch (error) {
    logger.error("❌ Error handling configuration failed:", error);
    throw error;
  }
};

/**
 * Create and configure the main Fastify application
 */
export const createApp = async (): Promise<FastifyInstance> => {
  const startTime = Date.now();

  logger.info("🏗️ Initializing CMS Backend Application...");

  // Fastify server options
  const serverOptions: FastifyServerOptions = {
    logger: config.isDevelopment
      ? {
          level: config.monitoring?.logLevel || "info",
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss",
            },
          },
        }
      : {
          level: config.monitoring?.logLevel || "info",
        },
    trustProxy: config.isProduction,
    bodyLimit: config.upload?.maxFileSize || 10485760,
    ignoreTrailingSlash: true,
    genReqId: () =>
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
  };

  const app: FastifyInstance = fastify(serverOptions);

  try {
    // Initialize database
    await initializeDatabase();

    // Initialize services
    initializeServices();

    // Configure core plugins
    await configureCorePlugins(app);

    // Configure JWT
    await configureJWT(app);

    // Configure file upload
    await configureFileUpload(app);

    // Configure documentation
    await configureDocumentation(app);

    // Register API routes
    await registerAPIRoutes(app);

    // Configure monitoring
    await configureMonitoring(app);

    // Configure error handling
    await configureErrorHandling(app);

    const duration = Date.now() - startTime;
    logger.info(`✅ Application initialized successfully in ${duration}ms`);

    return app;
  } catch (error) {
    logger.error("❌ Failed to create application:", error);
    throw error;
  }
};

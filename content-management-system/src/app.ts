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
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import { setupRestApi } from "./api/rest/index.js";
import { createErrorHandler } from "./core/errors/index.js";
import { registerAllServices } from "./core/container/registry.js";

/**
 * Initialize core dependencies
 */
const initializeDependencies = async (): Promise<void> => {
  await initDb();
  await registerAllServices();

  // Verify database connection
  const db = getDatabase();
  await db.execute(sql`SELECT 1`);
};

/**
 * Configure essential plugins
 */
const configurePlugins = async (app: FastifyInstance): Promise<void> => {
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

  // Security & Performance
  await app.register(
    helmet,
    config.isProduction ? {} : { contentSecurityPolicy: false }
  );
  await app.register(compress, { global: true, threshold: 1024 });
  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
  });

  // Authentication
  await app.register(jwt, {
    secret: config.jwt.accessSecret,
    sign: { expiresIn: config.jwt.accessExpiresIn },
    verify: { maxAge: config.jwt.accessExpiresIn },
  });

  // File upload
  await app.register(multipart, {
    limits: { fileSize: config.upload.maxFileSize, files: 5 },
    attachFieldsToBody: "keyValues",
  });
};

/**
 * Configure API documentation
 */
const configureDocumentation = async (app: FastifyInstance): Promise<void> => {
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
        { url: `http://localhost:${config.port}`, description: "Development" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/api/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });
};

/**
 * Configure monitoring endpoints
 */
const configureMonitoring = (app: FastifyInstance): void => {
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
      return reply
        .status(503)
        .send({ status: "not ready", reason: "Database not available" });
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
};

/**
 * Configure error handling
 */
const configureErrorHandling = (app: FastifyInstance): void => {
  // Performance monitoring for slow requests
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
};

/**
 * Create and configure the main Fastify application
 */
export const createApp = async (): Promise<FastifyInstance> => {
  const serverOptions: FastifyServerOptions = {
    logger: config.isDevelopment
      ? {
          level: "warn", // Reduced logging in development
          transport: {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "HH:MM:ss" },
          },
        }
      : { level: config.monitoring?.logLevel || "info" },
    trustProxy: config.isProduction,
    bodyLimit: config.upload?.maxFileSize || 10485760,
    ignoreTrailingSlash: true,
    genReqId: () =>
      `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
  };

  const app: FastifyInstance = fastify(serverOptions);

  try {
    // Initialize dependencies
    await initializeDependencies();

    // Configure plugins
    await configurePlugins(app);

    // Configure documentation
    await configureDocumentation(app);

    // Register API routes
    await app.register(
      async (fastify) => {
        await setupRestApi(fastify);
      },
      { prefix: "/api/v1" }
    );

    // Configure monitoring
    configureMonitoring(app);

    // Configure error handling
    configureErrorHandling(app);

    return app;
  } catch (error) {
    logger.error("Failed to create application:", error);
    throw error;
  }
};

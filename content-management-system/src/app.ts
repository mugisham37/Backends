import fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import compress from "@fastify/compress";
import { config } from "./config";
import { connectDatabase, isDatabaseConnected } from "./db/connection";
import { logger, apiLogger } from "./utils/logger";

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
    // Connect to database
    await connectDatabase();

    // Register compression plugin
    await app.register(compress, {
      global: true,
      encodings: ["gzip", "deflate"],
    });

    // Register security plugins
    await app.register(helmet, {
      contentSecurityPolicy: {
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
      crossOriginEmbedderPolicy: false,
    });

    // Register CORS
    await app.register(cors, {
      origin: config.cors.origin,
      credentials: config.cors.credentials,
      methods: config.cors.methods,
      allowedHeaders: config.cors.allowedHeaders,
    });

    // Register rate limiting
    await app.register(rateLimit, {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.windowMs,
      standardHeaders: config.rateLimit.standardHeaders,
      legacyHeaders: config.rateLimit.legacyHeaders,
      errorResponseBuilder: (_request, context) => ({
        code: 429,
        error: "Too Many Requests",
        message: `Rate limit exceeded, retry in ${context.ttl}ms`,
        date: Date.now(),
        expiresIn: context.ttl,
      }),
    });

    // Health check endpoint
    app.get("/health", async (_request, reply) => {
      const healthStatus = {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env["npm_package_version"] || "1.0.0",
        environment: config.env,
        database: {
          connected: isDatabaseConnected(),
        },
        memory: process.memoryUsage(),
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
      apiLogger.info(
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
      apiLogger.info(
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

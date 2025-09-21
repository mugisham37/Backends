/**
 * Content Management System Backend Server
 * Streamlined server entry point with essential functionality
 */

import "reflect-metadata";
import type { FastifyInstance } from "fastify";
import { createApp } from "./app.js";
import { config } from "./shared/config/env.config.js";
import { logger } from "./shared/utils/logger.js";
import { container } from "tsyringe";
import { closeDatabase } from "./core/database/connection.js";

let server: FastifyInstance | null = null;
let isShuttingDown = false;

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) return;

  isShuttingDown = true;
  logger.info(`Shutting down gracefully (${signal})...`);

  try {
    const cleanup = [];

    if (server) cleanup.push(server.close());
    cleanup.push(closeDatabase());

    await Promise.allSettled(cleanup);

    if (container) container.clearInstances();

    logger.info("Shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("Shutdown error:", error);
    process.exit(1);
  }
};

/**
 * Setup error handlers
 */
const setupErrorHandlers = (): void => {
  process.on("unhandledRejection", (reason: any) => {
    logger.error("Unhandled Promise Rejection:", reason);
    if (config.isProduction) gracefulShutdown("Unhandled Promise Rejection");
  });

  process.on("uncaughtException", (error: Error) => {
    logger.fatal("Uncaught Exception:", error);
    process.exit(1);
  });

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2"));
};

/**
 * Validate required environment variables
 */
const validateEnvironment = (): void => {
  const required = ["DATABASE_URL", "JWT_SECRET"];
  for (const varName of required) {
    if (!process.env[varName]) {
      throw new Error(`Required environment variable ${varName} is not set`);
    }
  }
};

/**
 * Start the server
 */
const startServer = async (): Promise<void> => {
  try {
    setupErrorHandlers();
    validateEnvironment();

    // Set process title
    process.title = `cms-api-${config.nodeEnv}-${process.pid}`;

    logger.info("Starting CMS Backend...");

    server = await createApp();

    const port = config.port;
    const host = config.isProduction ? "0.0.0.0" : "localhost";

    await server.listen({ port, host });

    logger.info(`Server running on http://${host}:${port}`);
    logger.info(`API Documentation: http://${host}:${port}/api/docs`);
    logger.info(`Health Check: http://${host}:${port}/health`);

    // Notify PM2 if running under it
    if (process.send) process.send("ready");
  } catch (error) {
    logger.error("Failed to start server:", error);

    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.message.includes("EADDRINUSE")) {
        logger.error(`Port ${config.port} is already in use`);
      } else if (error.message.includes("database")) {
        logger.error("Database connection failed - check DATABASE_URL");
      } else if (error.message.includes("JWT")) {
        logger.error("JWT configuration error - check JWT_SECRET");
      }
    }

    if (server) {
      try {
        await server.close();
      } catch (closeError) {
        logger.error("Error during cleanup:", closeError);
      }
    }

    process.exit(1);
  }
};

// Start the server
startServer();

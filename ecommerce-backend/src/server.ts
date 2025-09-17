/**
 * Server Entry Point
 * E-commerce Backend Server with PostgreSQL, Drizzle ORM, and Clean Architecture
 */

import { config } from "./shared/config/env.config";
import { logger } from "./shared/utils/logger";
import { createApp } from "./app";
import { closeDatabase } from "./core/database/connection";
import type { FastifyInstance } from "fastify";

// Global error handlers
process.on("unhandledRejection", (err: Error) => {
  logger.error("💥 Unhandled Promise Rejection:", err);
  gracefulShutdown("Unhandled Promise Rejection");
});

process.on("uncaughtException", (err: Error) => {
  logger.error("💥 Uncaught Exception:", err);
  // For uncaught exceptions, exit immediately
  process.exit(1);
});

// Graceful shutdown handler
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`🛑 ${signal} received. Starting graceful shutdown...`);

  try {
    // Close all connections in order
    await Promise.allSettled([closeDatabase()]);

    logger.info("✅ All connections closed successfully");
    process.exit(0);
  } catch (error) {
    logger.error("❌ Error during graceful shutdown:", error);
    process.exit(1);
  }
};

// Signal handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

/**
 * Start the ecommerce backend server
 */
const startServer = async (): Promise<void> => {
  let app: FastifyInstance | null = null;

  try {
    logger.info("🚀 Starting E-commerce Backend Server...");
    logger.info(`📦 Environment: ${config.nodeEnv}`);
    logger.info(`🔧 Node Version: ${process.version}`);

    // Create and configure the application
    logger.info("⚙️ Creating application...");
    app = await createApp();

    if (!app) {
      throw new Error("Failed to create application instance");
    }

    // Start the server
    const port = config.port;
    const host = config.nodeEnv === "production" ? "0.0.0.0" : "localhost";

    await app.listen({ port, host });

    logger.info(`🎉 Server successfully started!`);
    logger.info(`🌐 Server running on: http://${host}:${port}`);
    logger.info(`📋 Health check: http://${host}:${port}/health`);
    logger.info(`📚 API Documentation: http://${host}:${port}/api/docs`);
    logger.info(`🔍 GraphQL Playground: http://${host}:${port}/graphql`);

    // Log available endpoints
    logger.info("📡 Available Endpoints:");
    logger.info("   REST API: /api/v1/*");
    logger.info("   GraphQL: /graphql");
    logger.info("   Health: /health");
    logger.info("   Metrics: /metrics");
  } catch (error) {
    logger.error("💥 Failed to start server:", error);

    // Attempt cleanup if app was created
    if (app) {
      try {
        await app.close();
      } catch (closeError) {
        logger.error(
          "❌ Error closing app during startup failure:",
          closeError
        );
      }
    }

    process.exit(1);
  }
};

/**
 * Handle startup errors with detailed logging
 */
const handleStartupError = (error: Error): void => {
  logger.error("💥 Startup Error Details:");
  logger.error(`   Message: ${error.message}`);
  logger.error(`   Stack: ${error.stack}`);

  if (error.message.includes("EADDRINUSE")) {
    logger.error(`   💡 Port ${config.port} is already in use`);
    logger.error("   Try changing the PORT environment variable");
  }

  if (error.message.includes("ECONNREFUSED")) {
    logger.error("   💡 Database connection refused");
    logger.error("   Check your DATABASE_URL and ensure PostgreSQL is running");
  }

  if (error.message.includes("Redis")) {
    logger.error("   💡 Redis connection failed");
    logger.error("   Check your REDIS_URL and ensure Redis is running");
  }

  process.exit(1);
};

// Start the server with error handling
startServer().catch(handleStartupError);

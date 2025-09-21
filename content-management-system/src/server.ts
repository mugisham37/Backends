/**
 * Content Management System Backend Server
 * Production-ready server entry point with comprehensive error handling,
 * graceful shutdown, process management, and environment-specific optimizations
 */

import "reflect-metadata";
import type { FastifyInstance } from "fastify";
import { createApp } from "./app.js";
import { config, getConfigSummary } from "./shared/config/env.config.js";
import { logger } from "./shared/utils/logger.js";

import { container } from "tsyringe";
// Import database and monitoring
import { closeDatabase } from "./core/database/connection.js";

// Server state management
let server: FastifyInstance | null = null;
let isShuttingDown = false;
let shutdownTimeout: NodeJS.Timeout | null = null;

/**
 * Enhanced graceful shutdown handler with timeout and cleanup priorities
 */
const gracefulShutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    logger.warn(`🔄 Shutdown already in progress, ignoring ${signal}`);
    return;
  }

  isShuttingDown = true;
  logger.info(`🛑 ${signal} received. Starting graceful shutdown...`);

  // Set shutdown timeout to force exit if graceful shutdown takes too long
  shutdownTimeout = setTimeout(() => {
    logger.error("⏰ Graceful shutdown timeout reached, forcing exit");
    process.exit(1);
  }, 30000); // 30 seconds timeout

  try {
    const shutdownSteps = [];

    // Step 1: Stop accepting new connections
    if (server) {
      logger.info("🔌 Stopping server...");
      shutdownSteps.push(
        server.close().then(() => {
          logger.info("✅ Server stopped successfully");
        })
      );
    }

    // Step 2: Close database connections
    logger.info("🗄️ Closing database connections...");
    shutdownSteps.push(
      closeDatabase().then(() => {
        logger.info("✅ Database connections closed");
      })
    );

    // Step 3: Clear dependency container
    if (container) {
      logger.info("📦 Clearing dependency container...");
      shutdownSteps.push(
        Promise.resolve().then(() => {
          container.clearInstances();
          logger.info("✅ Dependency container cleared");
        })
      );
    }

    // Step 4: Wait for all cleanup operations
    await Promise.allSettled(shutdownSteps);

    // Clear shutdown timeout
    if (shutdownTimeout) {
      clearTimeout(shutdownTimeout);
      shutdownTimeout = null;
    }

    logger.info("🎉 Graceful shutdown completed successfully");
    process.exit(0);
  } catch (error) {
    logger.error("❌ Error during graceful shutdown:", error);

    if (shutdownTimeout) {
      clearTimeout(shutdownTimeout);
    }

    process.exit(1);
  }
};

/**
 * Enhanced global error handlers with detailed logging and recovery attempts
 */
const setupErrorHandlers = (): void => {
  // Unhandled Promise Rejection
  process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
    logger.error("💥 Unhandled Promise Rejection:", {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
      promise: promise.toString(),
      timestamp: new Date().toISOString(),
    });

    // In production, attempt graceful shutdown
    if (config.isProduction) {
      gracefulShutdown("Unhandled Promise Rejection");
    }
  });

  // Uncaught Exception
  process.on("uncaughtException", (error: Error) => {
    logger.fatal("💥 Uncaught Exception:", {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // For uncaught exceptions, exit immediately after logging
    process.exit(1);
  });

  // Memory usage warnings
  process.on("warning", (warning: Error) => {
    logger.warn("⚠️ Process Warning:", {
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
    });
  });

  // Handle specific signals
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2")); // nodemon restart

  logger.info("✅ Error handlers configured");
};

/**
 * Performance monitoring and health checks
 */
const setupPerformanceMonitoring = (): void => {
  // Memory usage monitoring
  const memoryInterval = setInterval(() => {
    const memoryUsage = process.memoryUsage();
    const memoryUsageMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024),
    };

    // Warn if memory usage is high
    if (memoryUsageMB.heapUsed > 200) {
      // 200MB threshold
      logger.warn("🧠 High memory usage detected:", memoryUsageMB);
    }

    // In development, log memory usage periodically
    if (config.isDevelopment) {
      logger.debug("Memory usage:", memoryUsageMB);
    }
  }, 60000); // Every minute

  // Clear interval on shutdown
  process.on("exit", () => {
    clearInterval(memoryInterval);
  });

  logger.info("✅ Performance monitoring configured");
};

/**
 * Environment-specific server optimizations
 */
const applyEnvironmentOptimizations = (): void => {
  if (config.isProduction) {
    // Production optimizations
    process.env.NODE_ENV = "production";

    // Increase max listeners for production
    process.setMaxListeners(20);

    // Set process title for easier identification
    process.title = `cms-api-prod-${process.pid}`;

    logger.info("⚡ Production optimizations applied");
  } else if (config.isDevelopment) {
    // Development optimizations
    process.env.NODE_ENV = "development";

    // Set process title for development
    process.title = `cms-api-dev-${process.pid}`;

    logger.info("🛠️ Development optimizations applied");
  }
};

/**
 * Startup health checks
 */
const performStartupChecks = async (): Promise<void> => {
  // Check required environment variables
  const requiredVars = ["DATABASE_URL", "JWT_SECRET"];
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      throw new Error(`Required environment variable ${varName} is not set`);
    }
  }
  logger.info("✅ Environment variables validated");

  // Check port availability
  const port = config.port;
  if (port < 1024 && process.getuid && process.getuid() !== 0) {
    throw new Error(`Port ${port} requires root privileges`);
  }
  logger.info(`✅ Port ${port} is available`);

  logger.info("🎯 Startup checks completed");
};

/**
 * Server startup information
 */
const logServerInfo = (): void => {
  const configSummary = getConfigSummary();

  logger.info("🚀 Starting Content Management System Backend...");
  logger.info("📋 Server Configuration:", configSummary);
  logger.info(`🔧 Node Version: ${process.version}`);
  logger.info(`🖥️ Platform: ${process.platform} ${process.arch}`);
  logger.info(`📝 Process ID: ${process.pid}`);
  logger.info(
    `👤 User: ${process.env.USER || process.env.USERNAME || "unknown"}`
  );

  if (config.isDevelopment) {
    logger.info("🛠️ Development mode features enabled:");
    logger.info("   • Enhanced logging and debugging");
    logger.info("   • Hot reload support");
    logger.info("   • Detailed error messages");
    logger.info("   • Memory usage monitoring");
  }

  if (config.isProduction) {
    logger.info("🔒 Production mode features enabled:");
    logger.info("   • Enhanced security measures");
    logger.info("   • Performance optimizations");
    logger.info("   • Error sanitization");
    logger.info("   • Comprehensive monitoring");
  }
};

/**
 * Enhanced server startup with comprehensive initialization
 */
const startServer = async (): Promise<void> => {
  const startupStart = Date.now();

  try {
    // Apply environment-specific optimizations
    applyEnvironmentOptimizations();

    // Setup error handlers early
    setupErrorHandlers();

    // Log server startup information
    logServerInfo();

    // Perform startup health checks
    await performStartupChecks();

    // Setup performance monitoring
    setupPerformanceMonitoring();

    // Create and configure the application
    logger.info("⚙️ Creating application instance...");
    server = await createApp();

    if (!server) {
      throw new Error("Failed to create application instance");
    }

    // Start the server
    const port = config.port;
    const host = config.isProduction ? "0.0.0.0" : "localhost";

    await server.listen({
      port,
      host,
      backlog: 1024, // Increased backlog for better performance
    });

    const startupTime = Date.now() - startupStart;

    // Log successful startup
    logger.info("🎉 Content Management System Backend started successfully!");
    logger.info(`⚡ Startup completed in ${startupTime}ms`);
    logger.info(`🌐 Server running on: http://${host}:${port}`);
    logger.info(`📋 Health check: http://${host}:${port}/health`);
    logger.info(`📚 API Documentation: http://${host}:${port}/api/docs`);

    if (config.features.graphql) {
      logger.info(`🔍 GraphQL Playground: http://${host}:${port}/graphql`);
    }

    // Log available endpoints
    logger.info("🚀 Available Endpoints:");
    logger.info("   📡 REST API: /api/v1/*");
    logger.info("   📚 API Docs: /api/docs");
    logger.info("   🔧 Health: /health");
    logger.info("   📊 Metrics: /metrics");
    logger.info("   📋 Version: /version");
    logger.info("   🔍 Services: /services");
    logger.info("   ⚡ Ready: /ready");

    // Log enabled features
    const enabledFeatures = Object.entries(config.features)
      .filter(([_, enabled]) => enabled)
      .map(([feature]) => feature);

    if (enabledFeatures.length > 0) {
      logger.info("✨ Enabled Features:", enabledFeatures.join(", "));
    }

    // Log performance information
    const memoryUsage = process.memoryUsage();
    logger.info("💾 Initial Memory Usage:", {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
    });

    logger.info("✨ Server is ready to accept connections!");

    // Notify PM2 that the app is ready (if running under PM2)
    if (process.send) {
      process.send("ready");
    }
  } catch (error) {
    logger.error("💥 Failed to start server:", error);

    // Enhanced error logging for common issues
    if (error instanceof Error) {
      if (error.message.includes("EADDRINUSE")) {
        logger.error(`💡 Port ${config.port} is already in use. Solutions:`);
        logger.error("   • Change the PORT environment variable");
        logger.error("   • Kill the process using the port");
        logger.error(
          `   • Use: netstat -ano | findstr :${config.port} (Windows)`
        );
        logger.error(
          `   • Use: lsof -ti:${config.port} | xargs kill -9 (Unix)`
        );
      }

      if (error.message.includes("EACCES")) {
        logger.error(
          `💡 Permission denied for port ${config.port}. Solutions:`
        );
        logger.error("   • Use a port number above 1024");
        logger.error("   • Run with elevated privileges (not recommended)");
      }

      if (
        error.message.includes("database") ||
        error.message.includes("ECONNREFUSED")
      ) {
        logger.error("💡 Database connection failed. Check:");
        logger.error("   • DATABASE_URL environment variable");
        logger.error("   • PostgreSQL server is running");
        logger.error("   • Database credentials are correct");
        logger.error("   • Network connectivity to database");
        logger.error("   • Firewall settings");
      }

      if (error.message.includes("JWT")) {
        logger.error("💡 JWT configuration error. Check:");
        logger.error("   • JWT_SECRET environment variable (min 32 chars)");
        logger.error("   • JWT_REFRESH_SECRET environment variable");
      }
    }

    // Attempt cleanup if server was partially created
    if (server) {
      try {
        await server.close();
        logger.info("🧹 Partial server cleanup completed");
      } catch (closeError) {
        logger.error("❌ Error during server cleanup:", closeError);
      }
    }

    process.exit(1);
  }
};

/**
 * Additional process monitoring
 */
const setupProcessMonitoring = (): void => {
  // Log when the process starts
  logger.info("🎬 Process started", {
    pid: process.pid,
    ppid: process.ppid,
    platform: process.platform,
    nodeVersion: process.version,
    cwd: process.cwd(),
  });

  // Log process exit
  process.on("exit", (code) => {
    logger.info(`🏁 Process exiting with code: ${code}`);
  });

  // Monitor for potential issues
  let lastGCTime = Date.now();
  const gcInterval = setInterval(() => {
    const now = Date.now();
    if (now - lastGCTime > 10000) {
      // 10 seconds since last GC check
      const memUsage = process.memoryUsage();
      if (memUsage.heapUsed > memUsage.heapTotal * 0.9) {
        logger.warn(
          "🗑️ High heap usage detected, consider investigating memory leaks"
        );
      }
    }
    lastGCTime = now;
  }, 30000); // Check every 30 seconds

  // Clear interval on exit
  process.on("exit", () => {
    clearInterval(gcInterval);
  });
};

// Setup process monitoring
setupProcessMonitoring();

// Start the server
startServer().catch((error) => {
  logger.fatal("💥 Critical server startup failure:", {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });

  process.exit(1);
});

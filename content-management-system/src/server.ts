import "reflect-metadata";
import { createApp } from "./app";
import { config } from "./shared/config";
import { gracefulDatabaseShutdown } from "./core/database/connection";
import { logger } from "./shared/utils/logger";

/**
 * Server startup and lifecycle management
 */
class Server {
  private app: Awaited<ReturnType<typeof createApp>> | null = null;
  private isShuttingDown = false;

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      logger.info("🚀 Starting Content Management System...");
      logger.info(`📊 Environment: ${config.env}`);
      logger.info(`🏠 Node.js Version: ${process.version}`);
      logger.info(`⚡ Process ID: ${process.pid}`);

      // Create and configure the application
      logger.info("🔧 Creating application instance...");
      this.app = await createApp();

      // Start the Fastify server
      logger.info(`🌐 Starting server on port ${config.port}...`);
      const address = await this.app.listen({
        port: config.port,
        host: "0.0.0.0",
      });

      logger.info("✅ Server started successfully!");
      logger.info(`🔗 Server running at: ${address}`);
      logger.info(`📚 API Documentation: ${address}/api/info`);
      logger.info(`🏥 Health Check: ${address}/health`);
      logger.info(`🔍 Ready Check: ${address}/ready`);

      if (config.isDevelopment) {
        logger.info(`🎮 GraphQL Playground: ${address}/graphql`);
        logger.info(`📋 REST API Base: ${address}/api/v1`);
      }

      // Setup graceful shutdown handlers
      this.setupGracefulShutdown();

      // Setup process event handlers
      this.setupProcessHandlers();

      logger.info("🎯 Content Management System is ready to serve requests!");
    } catch (error) {
      logger.error("💥 Failed to start server:", error);
      await this.cleanup();
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    // Handle graceful shutdown
    const gracefulShutdown = async (signal: string): Promise<void> => {
      if (this.isShuttingDown) {
        logger.warn(`🔄 ${signal} received again, forcing shutdown...`);
        process.exit(1);
      }

      this.isShuttingDown = true;
      logger.info(`🛑 ${signal} received. Shutting down gracefully...`);

      try {
        await this.cleanup();
        logger.info("✅ Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        logger.error("❌ Error during shutdown:", error);
        process.exit(1);
      }
    };

    // Register shutdown handlers
    process.on("SIGTERM", () => {
      void gracefulShutdown("SIGTERM");
    });

    process.on("SIGINT", () => {
      void gracefulShutdown("SIGINT");
    });
  }

  /**
   * Setup process event handlers
   */
  private setupProcessHandlers(): void {
    // Handle uncaught exceptions
    process.on("uncaughtException", (err) => {
      logger.error("💥 Uncaught exception:", err);
      void this.gracefulShutdown("Uncaught exception");
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("💥 Unhandled rejection at:", promise, "reason:", reason);
      void this.gracefulShutdown("Unhandled rejection");
    });

    // Handle warnings
    process.on("warning", (warning) => {
      logger.warn("⚠️ Process warning:", {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
      });
    });

    // Handle memory pressure (if available)
    if (process.listenerCount && process.listenerCount("SIGUSR2") === 0) {
      process.on("SIGUSR2", () => {
        logger.info("📊 Memory usage:", process.memoryUsage());
      });
    }
  }

  /**
   * Graceful shutdown method
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn(`🔄 ${signal} received again, forcing shutdown...`);
      process.exit(1);
    }

    this.isShuttingDown = true;
    logger.info(`🛑 ${signal} received. Shutting down gracefully...`);

    try {
      await this.cleanup();
      logger.info("✅ Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      logger.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    const cleanupTasks: Promise<void>[] = [];

    // Close the Fastify server
    if (this.app) {
      logger.info("📡 Closing Fastify server...");
      cleanupTasks.push(
        this.app
          .close()
          .then(() => {
            logger.info("✅ Fastify server closed");
          })
          .catch((error) => {
            logger.error("❌ Error closing Fastify server:", error);
          })
      );
    }

    // Close database connections
    logger.info("🗄️ Closing database connections...");
    cleanupTasks.push(
      gracefulDatabaseShutdown()
        .then(() => {
          logger.info("✅ Database connections closed");
        })
        .catch((error) => {
          logger.error("❌ Error closing database:", error);
        })
    );

    // Wait for all cleanup tasks with timeout
    try {
      await Promise.race([
        Promise.all(cleanupTasks),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Cleanup timeout")), 10000)
        ),
      ]);
    } catch (error) {
      logger.error("⏰ Cleanup timeout or error:", error);
      throw error;
    }
  }
}

/**
 * Main server startup function
 */
async function startServer(): Promise<void> {
  const server = new Server();
  await server.start();
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void startServer().catch((error) => {
    logger.error("💥 Fatal error starting server:", error);
    process.exit(1);
  });
}

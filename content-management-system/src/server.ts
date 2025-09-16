import { createApp } from "./app";
import { config } from "./shared/config";
import { closeDatabase } from "./core/database/connection";
import { logger } from "./shared/utils/logger";

async function startServer(): Promise<void> {
  let app: Awaited<ReturnType<typeof createApp>> | null = null;

  try {
    // Create and configure the application
    app = await createApp();

    // Start the Fastify server
    const address = await app.listen({
      port: config.port,
      host: "0.0.0.0",
    });

    logger.info(`Server running on ${address}`);
    logger.info(`Environment: ${config.env}`);
    logger.info(`Process ID: ${process.pid}`);

    // Handle graceful shutdown
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received. Shutting down gracefully...`);

      try {
        // Close the server first
        if (app) {
          await app.close();
          logger.info("Fastify server closed");
        }

        // Close database connections
        await closeDatabase();

        logger.info("Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        logger.error("Error during shutdown:", error);
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

    // Handle uncaught exceptions and rejections
    process.on("uncaughtException", (err) => {
      logger.error("Uncaught exception:", err);
      void gracefulShutdown("Uncaught exception");
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled rejection at:", promise, "reason:", reason);
      void gracefulShutdown("Unhandled rejection");
    });

    // Handle warnings
    process.on("warning", (warning) => {
      logger.warn("Process warning:", {
        name: warning.name,
        message: warning.message,
        stack: warning.stack,
      });
    });
  } catch (error) {
    logger.error("Error starting server:", error);

    // Attempt cleanup
    if (app) {
      try {
        await app.close();
      } catch (closeError) {
        logger.error(
          "Error closing server during startup failure:",
          closeError
        );
      }
    }

    try {
      await closeDatabase();
    } catch (dbError) {
      logger.error("Error closing database during startup failure:", dbError);
    }

    process.exit(1);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  void startServer();
}

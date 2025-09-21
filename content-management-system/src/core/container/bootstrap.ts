/**
 * Application Bootstrap
 *
 * This module handles the initialization of the dependency injection container
 * and application startup sequence.
 */

import { FastifyInstance } from "fastify";
import "reflect-metadata";
import { config } from "../../shared/config";
import { logger } from "../../shared/utils/logger";
import { TOKENS, containerConfig, getContainer } from "./index";
import { registerAllServices, registerTestServices } from "./registry";

/**
 * Application bootstrap class
 */
export class ApplicationBootstrap {
  private static instance: ApplicationBootstrap;
  private isInitialized = false;
  private app?: FastifyInstance;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ApplicationBootstrap {
    if (!ApplicationBootstrap.instance) {
      ApplicationBootstrap.instance = new ApplicationBootstrap();
    }
    return ApplicationBootstrap.instance;
  }

  /**
   * Initialize the application
   */
  async initialize(app?: FastifyInstance): Promise<void> {
    if (this.isInitialized) {
      logger.warn("Application already initialized");
      return;
    }

    logger.info("Initializing application...");

    try {
      // Store app reference
      if (app) {
        this.app = app;
      }

      // Initialize dependency injection container
      await this.initializeContainer();

      // Run post-construction initialization
      await this.runPostConstruction();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      this.isInitialized = true;
      logger.info("Application initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize application:", error);
      throw error;
    }
  }

  /**
   * Initialize the DI container
   */
  private async initializeContainer(): Promise<void> {
    logger.info("Initializing dependency injection container...");

    try {
      // Register services based on environment
      if (config.env === "test") {
        await registerTestServices();
      } else {
        registerAllServices();
      }

      logger.info("Dependency injection container initialized");
    } catch (error) {
      logger.error("Failed to initialize DI container:", error);
      throw error;
    }
  }

  /**
   * Run post-construction initialization for all services
   */
  private async runPostConstruction(): Promise<void> {
    logger.info("Running post-construction initialization...");

    const container = getContainer();
    const serviceTokens = Object.values(TOKENS);

    for (const token of serviceTokens) {
      try {
        const service = container.resolve<any>(token);

        // Check if service has post-construct methods
        const postConstructMethods =
          Reflect.getMetadata("lifecycle:postConstruct", service.constructor) ||
          [];

        for (const methodName of postConstructMethods) {
          if (typeof service[methodName] === "function") {
            logger.debug(
              `Running post-construct method ${methodName} for ${token}`
            );
            await service[methodName]();
          }
        }
      } catch (error: unknown) {
        // Service might not be registered or might not exist
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.debug(`Skipping post-construct for ${token}: ${errorMessage}`);
      }
    }

    logger.info("Post-construction initialization completed");
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Run pre-destroy methods
        await this.runPreDestroy();

        // Close Fastify app
        if (this.app) {
          await this.app.close();
          logger.info("Fastify server closed");
        }

        // Clear container
        containerConfig.reset();
        logger.info("Container cleared");

        logger.info("Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        logger.error("Error during shutdown:", error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught exception:", error);
      shutdown("uncaughtException");
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled promise rejection:", { reason, promise });
      shutdown("unhandledRejection");
    });
  }

  /**
   * Run pre-destroy methods for all services
   */
  private async runPreDestroy(): Promise<void> {
    logger.info("Running pre-destroy cleanup...");

    const container = getContainer();
    const serviceTokens = Object.values(TOKENS);

    for (const token of serviceTokens) {
      try {
        const service = container.resolve<any>(token);

        // Check if service has pre-destroy methods
        const preDestroyMethods =
          Reflect.getMetadata("lifecycle:preDestroy", service.constructor) ||
          [];

        for (const methodName of preDestroyMethods) {
          if (typeof service[methodName] === "function") {
            logger.debug(
              `Running pre-destroy method ${methodName} for ${token}`
            );
            await service[methodName]();
          }
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.debug(`Skipping pre-destroy for ${token}: ${errorMessage}`);
      }
    }

    logger.info("Pre-destroy cleanup completed");
  }

  /**
   * Get application status
   */
  getStatus(): {
    initialized: boolean;
    containerReady: boolean;
    serviceCount: number;
  } {
    return {
      initialized: this.isInitialized,
      containerReady: containerConfig.isReady(),
      serviceCount: containerConfig.getServiceCount(),
    };
  }

  /**
   * Health check for the application
   */
  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    services: Record<string, "up" | "down">;
    timestamp: string;
  }> {
    const services: Record<string, "up" | "down"> = {};
    let overallStatus: "healthy" | "unhealthy" = "healthy";

    // Check critical services
    const criticalServices = [
      TOKENS.Database,
      TOKENS.RedisClient,
      TOKENS.AuthService,
    ];

    for (const token of criticalServices) {
      try {
        const service = getContainer().resolve<any>(token);

        // If service has a health check method, use it
        if (typeof service.healthCheck === "function") {
          const isHealthy = await service.healthCheck();
          services[token] = isHealthy ? "up" : "down";
          if (!isHealthy) overallStatus = "unhealthy";
        } else {
          // Service exists and can be resolved
          services[token] = "up";
        }
      } catch (_error) {
        services[token] = "down";
        overallStatus = "unhealthy";
      }
    }

    return {
      status: overallStatus,
      services,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset the application (useful for testing)
   */
  async reset(): Promise<void> {
    logger.info("Resetting application...");

    await this.runPreDestroy();
    containerConfig.reset();
    this.isInitialized = false;

    logger.info("Application reset completed");
  }
}

/**
 * Export the bootstrap instance
 */
export const bootstrap = ApplicationBootstrap.getInstance();

/**
 * Convenience function to initialize the application
 */
export async function initializeApplication(
  app?: FastifyInstance
): Promise<void> {
  await bootstrap.initialize(app);
}

/**
 * Convenience function to get application status
 */
export function getApplicationStatus() {
  return bootstrap.getStatus();
}

/**
 * Convenience function for health check
 */
export async function performHealthCheck() {
  return await bootstrap.healthCheck();
}

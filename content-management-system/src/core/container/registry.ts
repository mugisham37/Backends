/**
 * Service Registry
 *
 * This module handles the registration of all services, repositories, and dependencies
 * in the dependency injection container.
 */

import { config } from "../../shared/config";
import { logger } from "../../shared/utils/logger";
import { TOKENS, containerConfig } from "./index";

// Import database connection
import { db } from "../database/connection";

// Import Redis client (will be created when needed)
import Redis from "ioredis";
import { vi } from "vitest";

/**
 * Register core infrastructure services
 */
export function registerInfrastructure(): void {
  logger.info("Registering infrastructure services...");

  // Register configuration
  containerConfig.registerInstance(TOKENS.Config, config);

  // Register logger
  containerConfig.registerInstance(TOKENS.Logger, logger);

  // Register database connection
  containerConfig.registerInstance(TOKENS.Database, db);

  // Register Redis client factory
  containerConfig.registerFactory(TOKENS.RedisClient, () => {
    const redisOptions: Record<string, any> = {
      db: config.redis.db,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      enableReadyCheck: false,
      lazyConnect: true,
    };

    // Only add password if it's defined
    if (config.redis.password) {
      redisOptions.password = config.redis.password;
    }

    return new Redis(config.redis.uri, redisOptions);
  });

  logger.info("Infrastructure services registered");
}

/**
 * Register repository services
 */
export function registerRepositories(): void {
  logger.info("Registering repository services...");

  // Import repositories dynamically to avoid circular dependencies
  const repositories = [
    {
      token: TOKENS.UserRepository,
      path: "../../modules/auth/auth.repository",
    },
    {
      token: TOKENS.TenantRepository,
      path: "../../modules/tenant/tenant.repository",
    },
    {
      token: TOKENS.ContentRepository,
      path: "../../modules/content/content.repository",
    },
    {
      token: TOKENS.MediaRepository,
      path: "../../modules/media/media.repository",
    },
  ];

  for (const repo of repositories) {
    try {
      // Dynamic import to avoid circular dependencies
      import(repo.path)
        .then((module) => {
          const RepositoryClass = module.default || Object.values(module)[0];
          containerConfig.register(repo.token, RepositoryClass as any);
          logger.debug(`Registered repository: ${repo.token}`);
        })
        .catch((error) => {
          logger.warn(
            `Failed to register repository ${repo.token}:`,
            error.message
          );
        });
    } catch (_error) {
      logger.warn(`Repository ${repo.token} not found, skipping...`);
    }
  }

  logger.info("Repository services registered");
}

/**
 * Register business services
 */
export function registerServices(): void {
  logger.info("Registering business services...");

  // Import services dynamically to avoid circular dependencies
  const services = [
    { token: TOKENS.AuthService, path: "../../modules/auth/auth.service" },
    {
      token: TOKENS.TenantService,
      path: "../../modules/tenant/tenant.service",
    },
    {
      token: TOKENS.ContentService,
      path: "../../modules/content/content.service",
    },
    { token: TOKENS.MediaService, path: "../../modules/media/media.service" },
    {
      token: TOKENS.SearchService,
      path: "../../modules/search/search.service",
    },
    { token: TOKENS.CacheService, path: "../../modules/cache/cache.service" },
    {
      token: TOKENS.WebhookService,
      path: "../../modules/webhook/webhook.service",
    },
    { token: TOKENS.AuditService, path: "../../modules/audit/audit.service" },
  ];

  for (const service of services) {
    try {
      // Dynamic import to avoid circular dependencies
      import(service.path)
        .then((module) => {
          const ServiceClass = module.default || Object.values(module)[0];
          containerConfig.register(service.token, ServiceClass as any);
          logger.debug(`Registered service: ${service.token}`);
        })
        .catch((error) => {
          logger.warn(
            `Failed to register service ${service.token}:`,
            error.message
          );
        });
    } catch (_error) {
      logger.warn(`Service ${service.token} not found, skipping...`);
    }
  }

  logger.info("Business services registered");
}

/**
 * Register background job services
 */
export function registerJobServices(): void {
  logger.info("Registering job services...");

  // Register Bull Queue factory
  containerConfig.registerFactory(TOKENS.BullQueue, (container) => {
    const { Queue } = require("bullmq");
    const redis = container.resolve(TOKENS.RedisClient);

    return new Queue("default", {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    });
  });

  logger.info("Job services registered");
}

/**
 * Register all services in the correct order
 */
export function registerAllServices(): void {
  logger.info("Starting service registration...");

  try {
    // Register in dependency order
    registerInfrastructure();
    registerRepositories();
    registerServices();
    registerJobServices();

    // Configure the container
    containerConfig.configure();

    logger.info("All services registered successfully");
  } catch (error) {
    logger.error("Failed to register services:", error);
    throw error;
  }
}

/**
 * Register services for testing environment
 */
export function registerTestServices(): void {
  logger.info("Registering test services...");

  // Reset container first
  containerConfig.reset();

  // Register minimal services for testing
  registerInfrastructure();

  // Register mock services
  containerConfig.registerInstance(TOKENS.RedisClient, {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
  });

  // Configure the container
  containerConfig.configure();

  logger.info("Test services registered");
}

/**
 * Get service registration status
 */
export function getRegistrationStatus(): {
  configured: boolean;
  serviceCount: number;
  services: string[];
} {
  return {
    configured: containerConfig.isReady(),
    serviceCount: containerConfig.getServiceCount(),
    services: Object.values(TOKENS),
  };
}

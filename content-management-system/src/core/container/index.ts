/**
 * Dependency Injection Container
 *
 * This module sets up and configures the tsyringe dependency injection container
 * for the application. It provides centralized service registration and resolution.
 */

import "reflect-metadata";
import { DependencyContainer, container } from "tsyringe";
import { logger } from "../../shared/utils/logger";

/**
 * Service registration tokens
 */
export const TOKENS = {
  // Database
  Database: "Database",

  // Repositories
  UserRepository: "UserRepository",
  TenantRepository: "TenantRepository",
  ContentRepository: "ContentRepository",
  MediaRepository: "MediaRepository",

  // Services
  AuthService: "AuthService",
  TenantService: "TenantService",
  ContentService: "ContentService",
  MediaService: "MediaService",
  SearchService: "SearchService",
  CacheService: "CacheService",
  QueueService: "QueueService",
  WebhookService: "WebhookService",
  AuditService: "AuditService",
  ApiKeyService: "ApiKeyService",
  PerformanceMonitorService: "PerformanceMonitorService",

  // External services
  RedisClient: "RedisClient",
  BullQueue: "BullQueue",

  // Configuration
  Config: "Config",
  Logger: "Logger",
} as const;

/**
 * Service registration interface
 */
export interface ServiceRegistration {
  token: string;
  implementation: any;
  singleton?: boolean;
}

/**
 * Container configuration class
 */
export class ContainerConfig {
  private static instance: ContainerConfig;
  private registrations: ServiceRegistration[] = [];
  private isConfigured = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ContainerConfig {
    if (!ContainerConfig.instance) {
      ContainerConfig.instance = new ContainerConfig();
    }
    return ContainerConfig.instance;
  }

  /**
   * Register a service
   */
  register<T>(
    token: string,
    implementation: new (..._args: any[]) => T,
    singleton = true
  ): this {
    this.registrations.push({
      token,
      implementation,
      singleton,
    });
    return this;
  }

  /**
   * Register a singleton instance
   */
  registerInstance<T>(token: string, instance: T): this {
    container.registerInstance(token, instance);
    return this;
  }

  /**
   * Register a factory function
   */
  registerFactory<T>(
    token: string,
    factory: (container: DependencyContainer) => T
  ): this {
    container.register(token, {
      useFactory: factory,
    });
    return this;
  }

  /**
   * Configure all registered services
   */
  configure(): void {
    if (this.isConfigured) {
      logger.warn("Container already configured, skipping...");
      return;
    }

    logger.info("Configuring dependency injection container...");

    try {
      // Register all services
      for (const registration of this.registrations) {
        if (registration.singleton) {
          container.registerSingleton(
            registration.token,
            registration.implementation
          );
        } else {
          container.register(registration.token, registration.implementation);
        }

        logger.debug(`Registered service: ${registration.token}`);
      }

      this.isConfigured = true;
      logger.info(
        `Successfully configured ${this.registrations.length} services`
      );
    } catch (error) {
      logger.error("Failed to configure container:", error);
      throw error;
    }
  }

  /**
   * Reset container configuration (useful for testing)
   */
  reset(): void {
    container.clearInstances();
    this.registrations = [];
    this.isConfigured = false;
    logger.debug("Container configuration reset");
  }

  /**
   * Check if container is configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Get registered service count
   */
  getServiceCount(): number {
    return this.registrations.length;
  }
}

/**
 * Get the configured container instance
 */
export function getContainer(): DependencyContainer {
  return container;
}

/**
 * Resolve a service from the container
 */
export function resolve<T>(token: string): T {
  try {
    return container.resolve<T>(token);
  } catch (error) {
    logger.error(`Failed to resolve service: ${token}`, error);
    throw new Error(`Service not found: ${token}`);
  }
}

/**
 * Check if a service is registered
 */
export function isRegistered(token: string): boolean {
  try {
    container.resolve(token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Injectable decorator for services
 */
export function Injectable(token?: string) {
  return <T extends new (..._args: any[]) => any>(constructor: T) => {
    // Register the class as injectable
    if (token) {
      container.registerSingleton(token, constructor);
    }
    return constructor;
  };
}

/**
 * Inject decorator for constructor parameters
 */
export function Inject(token: string) {
  return (
    target: any,
    _propertyKey: string | symbol | undefined,
    parameterIndex: number
  ) => {
    // This is handled by tsyringe's inject decorator
    const existingTokens =
      Reflect.getMetadata("design:paramtypes", target) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata("design:paramtypes", existingTokens, target);
  };
}

/**
 * Export the container configuration instance
 */
export const containerConfig = ContainerConfig.getInstance();

/**
 * Export tsyringe decorators for convenience
 */
export { injectable, inject, singleton, scoped, Lifecycle } from "tsyringe";

/**
 * Export custom decorators
 */
export * from "./decorators";

/**
 * Export registry functions
 */
export * from "./registry";

/**
 * Export test utilities
 */
export * from "./test-container";

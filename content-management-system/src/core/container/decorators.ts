/**
 * Dependency Injection Decorators
 *
 * This module provides custom decorators for dependency injection
 * that work with tsyringe and provide additional functionality.
 */

import { injectable, inject, singleton } from "tsyringe";
import { logger } from "../../utils/logger";

/**
 * Service decorator that marks a class as injectable and optionally registers it
 */
export function Service(_token?: string, isSingleton = true) {
  return function <T extends new (...args: any[]) => any>(constructor: T): any {
    // Apply injectable decorator first
    injectable()(constructor);

    // Apply singleton decorator if requested
    if (isSingleton) {
      singleton()(constructor);
    }

    return constructor;
  };
}

/**
 * Repository decorator for data access layer classes
 */
export function Repository(token?: string) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    // Repositories are always singletons
    return Service(token, true)(constructor);
  };
}

/**
 * Controller decorator for API controllers
 */
export function Controller(prefix?: string) {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    // Controllers are always singletons
    const decoratedClass = Service(undefined, true)(constructor);

    // Store route prefix metadata
    if (prefix) {
      Reflect.defineMetadata("route:prefix", prefix, decoratedClass);
    }

    return decoratedClass;
  };
}

/**
 * Middleware decorator for Fastify middleware
 */
export function Middleware() {
  return function <T extends new (...args: any[]) => any>(constructor: T) {
    return Service(undefined, true)(constructor);
  };
}

/**
 * Enhanced Inject decorator with validation
 */
export function Inject(token: string, optional = false) {
  return function (
    target: any,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ) {
    // Apply tsyringe inject decorator
    inject(token)(target, propertyKey, parameterIndex);

    // Store metadata for validation
    const existingTokens = Reflect.getMetadata("inject:tokens", target) || [];
    existingTokens[parameterIndex] = { token, optional };
    Reflect.defineMetadata("inject:tokens", existingTokens, target);
  };
}

/**
 * InjectLogger decorator for automatic logger injection
 */
export function InjectLogger() {
  return function (
    target: any,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ) {
    inject("Logger")(target, propertyKey, parameterIndex);
  };
}

/**
 * InjectConfig decorator for automatic configuration injection
 */
export function InjectConfig() {
  return function (
    target: any,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ) {
    inject("Config")(target, propertyKey, parameterIndex);
  };
}

/**
 * InjectDatabase decorator for automatic database injection
 */
export function InjectDatabase() {
  return function (
    target: any,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ) {
    inject("Database")(target, propertyKey, parameterIndex);
  };
}

/**
 * Lazy injection decorator for circular dependency resolution
 */
export function InjectLazy(token: string) {
  return function (target: any, propertyKey: string) {
    // Create a getter that resolves the dependency lazily
    Object.defineProperty(target, propertyKey, {
      get: function () {
        if (!this[`_${propertyKey}`]) {
          try {
            const { container } = require("tsyringe");
            this[`_${propertyKey}`] = container.resolve(token);
          } catch (error) {
            logger.error(`Failed to lazily inject ${token}:`, error);
            throw error;
          }
        }
        return this[`_${propertyKey}`];
      },
      configurable: true,
      enumerable: true,
    });
  };
}

/**
 * PostConstruct decorator for initialization methods
 */
export function PostConstruct() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    // Store metadata about post-construct methods
    const existingMethods =
      Reflect.getMetadata("lifecycle:postConstruct", target.constructor) || [];
    existingMethods.push(propertyKey);
    Reflect.defineMetadata(
      "lifecycle:postConstruct",
      existingMethods,
      target.constructor
    );

    return descriptor;
  };
}

/**
 * PreDestroy decorator for cleanup methods
 */
export function PreDestroy() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    // Store metadata about pre-destroy methods
    const existingMethods =
      Reflect.getMetadata("lifecycle:preDestroy", target.constructor) || [];
    existingMethods.push(propertyKey);
    Reflect.defineMetadata(
      "lifecycle:preDestroy",
      existingMethods,
      target.constructor
    );

    return descriptor;
  };
}

/**
 * Conditional injection decorator
 */
export function InjectIf(token: string, condition: () => boolean) {
  return function (
    target: any,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ) {
    if (condition()) {
      inject(token)(target, propertyKey, parameterIndex);
    }
  };
}

/**
 * Profile decorator for performance monitoring
 */
export function Profile(name?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const profileName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;
        logger.debug(`Profile [${profileName}]: ${duration}ms`);
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        logger.debug(`Profile [${profileName}]: ${duration}ms (error)`);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Retry decorator for automatic retry logic
 */
export function Retry(attempts = 3, delay = 1000) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      let lastError: Error;

      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error as Error;

          if (attempt === attempts) {
            logger.error(
              `Method ${propertyKey} failed after ${attempts} attempts:`,
              error
            );
            throw error;
          }

          logger.warn(
            `Method ${propertyKey} failed (attempt ${attempt}/${attempts}), retrying in ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      throw lastError!;
    };

    return descriptor;
  };
}

/**
 * Validate decorator for input validation
 */
export function ValidateInput(schema: any) {
  return function (
    _target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Validate input using the provided schema
      try {
        const validatedArgs = schema.parse(args[0]);
        return await originalMethod.apply(this, [
          validatedArgs,
          ...args.slice(1),
        ]);
      } catch (error) {
        logger.error(`Validation failed for ${propertyKey}:`, error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Transaction decorator for database transactions
 */
export function Transactional() {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // This would integrate with the database transaction system
      // For now, just call the original method
      return await originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

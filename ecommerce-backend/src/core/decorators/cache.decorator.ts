import {
  cacheService,
  type CacheOptions,
} from "../../modules/cache/cache.service.js";
import {
  multiLevelCache,
  type CacheStrategy,
  CacheStrategies,
} from "../../modules/cache/cache.strategies.js";

/**
 * Cache decorator options
 */
export interface CacheDecoratorOptions extends CacheOptions {
  strategy?: CacheStrategy;
  keyGenerator?: (...args: any[]) => string;
  condition?: (...args: any[]) => boolean;
  multiLevel?: boolean;
}

/**
 * Method decorator for caching return values
 */
export function Cache(options: CacheDecoratorOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const {
        strategy = CacheStrategies.API_RESPONSE,
        keyGenerator,
        condition,
        multiLevel = false,
        ttl = strategy.ttl,
        prefix = strategy.prefix,
        tags = strategy.tags,
      } = options;

      // Check condition if provided
      if (condition && !condition.apply(this, args)) {
        return originalMethod.apply(this, args);
      }

      // Generate cache key
      const cacheKey = keyGenerator
        ? keyGenerator.apply(this, args)
        : generateDefaultKey(target.constructor.name, propertyKey, args);

      try {
        if (multiLevel) {
          // Use multi-level cache
          return await multiLevelCache.get(
            cacheKey,
            () => originalMethod.apply(this, args),
            { ...strategy, ttl, prefix, tags }
          );
        } else {
          // Use Redis cache only
          return await cacheService.getOrSet(
            cacheKey,
            () => originalMethod.apply(this, args),
            { ttl, prefix, tags }
          );
        }
      } catch (error) {
        console.error(`Cache decorator error for ${propertyKey}:`, error);
        // Fallback to original method if caching fails
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * Class decorator for caching all methods
 */
export function CacheClass(options: CacheDecoratorOptions = {}) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    const prototype = constructor.prototype;
    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== "constructor" && typeof prototype[name] === "function"
    );

    methodNames.forEach((methodName) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
      if (descriptor) {
        Cache(options)(prototype, methodName, descriptor);
        Object.defineProperty(prototype, methodName, descriptor);
      }
    });

    return constructor;
  };
}

/**
 * Cache invalidation decorator
 */
export function CacheInvalidate(options: {
  keys?: string[];
  patterns?: string[];
  tags?: string[];
  keyGenerator?: (...args: any[]) => string[];
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      try {
        const { keys = [], patterns = [], tags = [], keyGenerator } = options;

        // Generate dynamic keys if keyGenerator is provided
        const dynamicKeys = keyGenerator ? keyGenerator.apply(this, args) : [];
        const allKeys = [...keys, ...dynamicKeys];

        // Invalidate specific keys
        for (const key of allKeys) {
          await cacheService.delete(key);
        }

        // Invalidate by patterns
        for (const pattern of patterns) {
          await cacheService.deletePattern(pattern);
        }

        // Invalidate by tags
        if (tags.length > 0) {
          await cacheService.invalidateByTags(tags);
        }
      } catch (error) {
        console.error(`Cache invalidation error for ${propertyKey}:`, error);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Cache warming decorator
 */
export function CacheWarm(options: {
  strategy?: CacheStrategy;
  keyGenerator: (...args: any[]) => string;
  warmupData?: any[];
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    // Add warmup method to the class
    const warmupMethodName = `warmup${
      propertyKey.charAt(0).toUpperCase() + propertyKey.slice(1)
    }`;

    target[warmupMethodName] = async function () {
      const {
        strategy = CacheStrategies.API_RESPONSE,
        keyGenerator,
        warmupData = [],
      } = options;

      console.log(`Warming up cache for ${propertyKey}...`);

      try {
        for (const data of warmupData) {
          const key = keyGenerator(data);
          await multiLevelCache.get(
            key,
            () => originalMethod.apply(this, [data]),
            strategy
          );
        }
        console.log(`Cache warmup completed for ${propertyKey}`);
      } catch (error) {
        console.error(`Cache warmup failed for ${propertyKey}:`, error);
      }
    };

    return descriptor;
  };
}

/**
 * Rate limiting with cache decorator
 */
export function RateLimit(options: {
  maxRequests: number;
  windowMs: number;
  keyGenerator?: (...args: any[]) => string;
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const { maxRequests, windowMs, keyGenerator } = options;

      // Generate rate limit key
      const rateLimitKey = keyGenerator
        ? `ratelimit:${keyGenerator.apply(this, args)}`
        : `ratelimit:${target.constructor.name}:${propertyKey}`;

      try {
        // Get current count
        const current = (await cacheService.get<number>(rateLimitKey)) || 0;

        if (current >= maxRequests) {
          throw new Error(`Rate limit exceeded for ${propertyKey}`);
        }

        // Increment counter
        await cacheService.increment(rateLimitKey);

        // Set TTL if this is the first request
        if (current === 0) {
          await cacheService.extendTTL(
            rateLimitKey,
            Math.ceil(windowMs / 1000)
          );
        }

        return await originalMethod.apply(this, args);
      } catch (error) {
        if (error.message.includes("Rate limit exceeded")) {
          throw error;
        }
        console.error(`Rate limit decorator error for ${propertyKey}:`, error);
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

/**
 * Memoization decorator (in-memory caching)
 */
export function Memoize(ttlMs: number = 300000) {
  // 5 minutes default
  const cache = new Map<string, { value: any; expiry: number }>();

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const key = `${target.constructor.name}:${propertyKey}:${JSON.stringify(
        args
      )}`;
      const cached = cache.get(key);

      if (cached && Date.now() < cached.expiry) {
        return cached.value;
      }

      const result = originalMethod.apply(this, args);

      // Handle both sync and async results
      if (result instanceof Promise) {
        return result.then((value) => {
          cache.set(key, { value, expiry: Date.now() + ttlMs });
          return value;
        });
      } else {
        cache.set(key, { value: result, expiry: Date.now() + ttlMs });
        return result;
      }
    };

    return descriptor;
  };
}

/**
 * Generate default cache key
 */
function generateDefaultKey(
  className: string,
  methodName: string,
  args: any[]
): string {
  const argsHash =
    args.length > 0
      ? Buffer.from(JSON.stringify(args)).toString("base64")
      : "noargs";
  return `${className}:${methodName}:${argsHash}`;
}

/**
 * Utility functions for cache decorators
 */
export const CacheDecoratorUtils = {
  /**
   * Create a key generator for user-specific caching
   */
  userKeyGenerator:
    (userId: string) =>
    (methodName: string, ...args: any[]) =>
      `user:${userId}:${methodName}:${Buffer.from(
        JSON.stringify(args)
      ).toString("base64")}`,

  /**
   * Create a key generator for entity-specific caching
   */
  entityKeyGenerator:
    (entityType: string) =>
    (id: string, ...args: any[]) =>
      `${entityType}:${id}:${Buffer.from(JSON.stringify(args)).toString(
        "base64"
      )}`,

  /**
   * Create a condition for caching only successful results
   */
  successCondition: (result: any) => result !== null && result !== undefined,

  /**
   * Create a condition for caching based on user role
   */
  roleCondition: (allowedRoles: string[]) => (user: any) =>
    user && allowedRoles.includes(user.role),
};

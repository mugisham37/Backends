import "reflect-metadata";
import type { Result } from "../types";

/**
 * Metadata keys for caching decorators
 */
export const CACHE_METADATA_KEY = Symbol("cache");
export const CACHE_INVALIDATE_KEY = Symbol("cache_invalidate");

/**
 * Cache metadata interface
 */
export interface CacheMetadata {
  key?: string | undefined;
  ttl?: number | undefined;
  tags?: string[] | undefined;
  condition?: string | undefined;
  keyGenerator?: ((...args: any[]) => string) | undefined;
  serialize?: boolean | undefined;
  compress?: boolean | undefined;
}

/**
 * Cache invalidation metadata
 */
export interface CacheInvalidateMetadata {
  keys?: string[] | undefined;
  tags?: string[] | undefined;
  pattern?: string | undefined;
  condition?: string | undefined;
}

/**
 * Cache options
 */
export interface CacheOptions {
  defaultTtl?: number | undefined;
  keyPrefix?: string | undefined;
  serialize?: boolean | undefined;
  compress?: boolean | undefined;
  enabled?: boolean | undefined;
}

/**
 * Decorator to cache method results
 * @param options Cache configuration options
 */
export function Cache(options: CacheMetadata = {}): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor
  ) {
    const metadata: CacheMetadata = {
      ttl: 300, // 5 minutes default
      serialize: true,
      compress: false,
      ...options,
    };

    Reflect.defineMetadata(CACHE_METADATA_KEY, metadata, target, propertyKey);
  };
}

/**
 * Decorator to cache method results with a specific TTL
 * @param ttl Time to live in seconds
 * @param key Optional cache key
 */
export function CacheTTL(ttl: number, key?: string): MethodDecorator {
  return Cache({ ttl, key });
}

/**
 * Decorator to cache method results for a short duration (1 minute)
 * @param key Optional cache key
 */
export function CacheShort(key?: string): MethodDecorator {
  return Cache({ ttl: 60, key });
}

/**
 * Decorator to cache method results for a medium duration (5 minutes)
 * @param key Optional cache key
 */
export function CacheMedium(key?: string): MethodDecorator {
  return Cache({ ttl: 300, key });
}

/**
 * Decorator to cache method results for a long duration (1 hour)
 * @param key Optional cache key
 */
export function CacheLong(key?: string): MethodDecorator {
  return Cache({ ttl: 3600, key });
}

/**
 * Decorator to cache method results with tags for group invalidation
 * @param tags Cache tags for group invalidation
 * @param ttl Optional TTL override
 */
export function CacheWithTags(tags: string[], ttl?: number): MethodDecorator {
  return Cache({ tags, ttl });
}

/**
 * Decorator to invalidate cache entries
 * @param options Cache invalidation options
 */
export function CacheInvalidate(
  options: CacheInvalidateMetadata = {}
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor
  ) {
    Reflect.defineMetadata(CACHE_INVALIDATE_KEY, options, target, propertyKey);
  };
}

/**
 * Decorator to invalidate cache by keys
 * @param keys Cache keys to invalidate
 */
export function CacheInvalidateKeys(...keys: string[]): MethodDecorator {
  return CacheInvalidate({ keys });
}

/**
 * Decorator to invalidate cache by tags
 * @param tags Cache tags to invalidate
 */
export function CacheInvalidateTags(...tags: string[]): MethodDecorator {
  return CacheInvalidate({ tags });
}

/**
 * Decorator to invalidate cache by pattern
 * @param pattern Cache key pattern to invalidate
 */
export function CacheInvalidatePattern(pattern: string): MethodDecorator {
  return CacheInvalidate({ pattern });
}

/**
 * Decorator to clear all cache
 */
export function CacheClear(): MethodDecorator {
  return CacheInvalidate({ pattern: "*" });
}

/**
 * Cache key generators
 */
export class CacheKeyGenerator {
  /**
   * Generate cache key from method name and arguments
   */
  static fromMethodAndArgs(
    className: string,
    methodName: string,
    args: any[]
  ): string {
    const argsHash = this.hashArgs(args);
    return `${className}:${methodName}:${argsHash}`;
  }

  /**
   * Generate cache key from user context
   */
  static fromUser(userId: string, action: string, ...params: any[]): string {
    const paramsHash = this.hashArgs(params);
    return `user:${userId}:${action}:${paramsHash}`;
  }

  /**
   * Generate cache key from tenant context
   */
  static fromTenant(
    tenantId: string,
    action: string,
    ...params: any[]
  ): string {
    const paramsHash = this.hashArgs(params);
    return `tenant:${tenantId}:${action}:${paramsHash}`;
  }

  /**
   * Generate cache key for list operations
   */
  static forList(
    entity: string,
    filters: Record<string, any> = {},
    pagination: { page?: number; limit?: number } = {}
  ): string {
    const filterHash = this.hashArgs([filters, pagination]);
    return `list:${entity}:${filterHash}`;
  }

  /**
   * Generate cache key for entity by ID
   */
  static forEntity(entity: string, id: string): string {
    return `entity:${entity}:${id}`;
  }

  /**
   * Generate cache key for search results
   */
  static forSearch(
    query: string,
    filters: Record<string, any> = {},
    pagination: { page?: number; limit?: number } = {}
  ): string {
    const searchHash = this.hashArgs([query, filters, pagination]);
    return `search:${searchHash}`;
  }

  /**
   * Hash arguments to create a consistent key
   */
  private static hashArgs(args: any[]): string {
    try {
      const serialized = JSON.stringify(args, this.replacer);
      return this.simpleHash(serialized);
    } catch {
      return this.simpleHash(String(args));
    }
  }

  /**
   * JSON replacer to handle circular references and functions
   */
  private static replacer(key: string, value: any): any {
    if (typeof value === "function") {
      return "[Function]";
    }
    if (typeof value === "object" && value !== null) {
      if (value.constructor && value.constructor.name !== "Object") {
        return `[${value.constructor.name}]`;
      }
    }
    return value;
  }

  /**
   * Simple hash function for cache keys
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString(36);

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Ensure we get a positive number and add length for better distribution
    return Math.abs(hash).toString(36) + str.length.toString(36);
  }
}

/**
 * Cache utilities
 */
export class CacheUtils {
  /**
   * Get cache metadata from a method
   */
  static getCacheMetadata(
    target: any,
    propertyKey: string | symbol
  ): CacheMetadata | undefined {
    return Reflect.getMetadata(CACHE_METADATA_KEY, target, propertyKey);
  }

  /**
   * Get cache invalidation metadata from a method
   */
  static getCacheInvalidateMetadata(
    target: any,
    propertyKey: string | symbol
  ): CacheInvalidateMetadata | undefined {
    return Reflect.getMetadata(CACHE_INVALIDATE_KEY, target, propertyKey);
  }

  /**
   * Check if method has caching enabled
   */
  static isCacheEnabled(target: any, propertyKey: string | symbol): boolean {
    const metadata = this.getCacheMetadata(target, propertyKey);
    return metadata !== undefined;
  }

  /**
   * Check if method has cache invalidation
   */
  static hasCacheInvalidation(
    target: any,
    propertyKey: string | symbol
  ): boolean {
    const metadata = this.getCacheInvalidateMetadata(target, propertyKey);
    return metadata !== undefined;
  }

  /**
   * Generate cache key for a method call
   */
  static generateCacheKey(
    target: any,
    propertyKey: string | symbol,
    args: any[],
    metadata?: CacheMetadata
  ): string {
    const cacheMetadata =
      metadata || this.getCacheMetadata(target, propertyKey);

    if (!cacheMetadata) {
      throw new Error("No cache metadata found");
    }

    // Use custom key if provided
    if (cacheMetadata.key) {
      return cacheMetadata.key;
    }

    // Use custom key generator if provided
    if (cacheMetadata.keyGenerator) {
      return cacheMetadata.keyGenerator(...args);
    }

    // Default key generation
    const className = target.constructor.name;
    const methodName = String(propertyKey);
    return CacheKeyGenerator.fromMethodAndArgs(className, methodName, args);
  }

  /**
   * Check if cache condition is met
   */
  static shouldCache(
    condition: string | undefined,
    args: any[],
    result?: any
  ): boolean {
    if (!condition) return true;

    try {
      // Simple condition evaluation
      // In a real implementation, you might want to use a more sophisticated
      // expression evaluator or template engine
      if (condition === "success" && result) {
        return (result as any).success === true;
      }

      if (condition === "not_empty" && result) {
        return result !== null && result !== undefined;
      }

      if (condition.startsWith("args.")) {
        const argIndex = parseInt(condition.split(".")[1] || "0");
        return Boolean(args[argIndex]);
      }

      return true;
    } catch {
      return true;
    }
  }

  /**
   * Serialize data for caching
   */
  static serialize(data: any, compress = false): string {
    try {
      const serialized = JSON.stringify(data);

      if (compress && serialized.length > 1000) {
        // In a real implementation, you would use a compression library
        // For now, we'll just return the serialized data
        return serialized;
      }

      return serialized;
    } catch {
      return String(data);
    }
  }

  /**
   * Deserialize cached data
   */
  static deserialize(data: string): any {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }

  /**
   * Create cache tags from method arguments
   */
  static createTagsFromArgs(args: any[], tagTemplate?: string[]): string[] {
    if (!tagTemplate) return [];

    return tagTemplate.map((template) => {
      let tag = template;

      // Replace placeholders with actual values
      args.forEach((arg, index) => {
        tag = tag.replace(`{${index}}`, String(arg));

        if (typeof arg === "object" && arg !== null) {
          Object.keys(arg).forEach((key) => {
            tag = tag.replace(`{${index}.${key}}`, String(arg[key]));
          });
        }
      });

      return tag;
    });
  }

  /**
   * Validate cache configuration
   */
  static validateCacheConfig(metadata: CacheMetadata): Result<void, Error> {
    if (metadata.ttl !== undefined && metadata.ttl < 0) {
      return {
        success: false,
        error: new Error("Cache TTL must be non-negative"),
      };
    }

    if (
      metadata.tags &&
      metadata.tags.some((tag) => !tag || typeof tag !== "string")
    ) {
      return {
        success: false,
        error: new Error("Cache tags must be non-empty strings"),
      };
    }

    return { success: true, data: undefined };
  }
}

/**
 * Cache decorator factory for common patterns
 */
export class CacheDecorators {
  /**
   * Cache user-specific data
   */
  static forUser(ttl = 300): MethodDecorator {
    return Cache({
      ttl,
      keyGenerator: (...args) => {
        const userId = args[0]?.id || args[0];
        return CacheKeyGenerator.fromUser(userId, "data", ...args.slice(1));
      },
      tags: ["user"],
    });
  }

  /**
   * Cache tenant-specific data
   */
  static forTenant(ttl = 600): MethodDecorator {
    return Cache({
      ttl,
      keyGenerator: (...args) => {
        const tenantId = args[0]?.tenantId || args[0];
        return CacheKeyGenerator.fromTenant(tenantId, "data", ...args.slice(1));
      },
      tags: ["tenant"],
    });
  }

  /**
   * Cache entity by ID
   */
  static forEntity(entityName: string, ttl = 300): MethodDecorator {
    return Cache({
      ttl,
      keyGenerator: (...args) => {
        const id = args[0];
        return CacheKeyGenerator.forEntity(entityName, id);
      },
      tags: [entityName],
    });
  }

  /**
   * Cache list results
   */
  static forList(entityName: string, ttl = 180): MethodDecorator {
    return Cache({
      ttl,
      keyGenerator: (...args) => {
        const [filters, pagination] = args;
        return CacheKeyGenerator.forList(entityName, filters, pagination);
      },
      tags: [entityName, "list"],
    });
  }

  /**
   * Cache search results
   */
  static forSearch(ttl = 120): MethodDecorator {
    return Cache({
      ttl,
      keyGenerator: (...args) => {
        const [query, filters, pagination] = args;
        return CacheKeyGenerator.forSearch(query, filters, pagination);
      },
      tags: ["search"],
    });
  }
}

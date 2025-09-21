import type { ZodSchema } from "zod";
import { ValidationError } from "../errors/validation.error.ts";

/**
 * Validation decorator for service methods
 *
 * Provides runtime validation for service method parameters and return values
 * using Zod schemas. This ensures type safety at the service layer.
 */

export interface ValidationConfig {
  input?: ZodSchema;
  output?: ZodSchema;
  skipValidation?: boolean;
}

/**
 * Type definitions for validation metadata
 */
export interface ValidationMetadata {
  input?: ZodSchema;
  output?: ZodSchema;
  skipValidation?: boolean;
  target: any;
  propertyKey: string;
}

export interface ParamValidationMetadata {
  schema: ZodSchema;
  paramIndex: number;
  target: any;
  propertyKey: string;
}

export interface ValidationOptions {
  skipValidation?: boolean;
  customErrorMessage?: string;
  throwOnError?: boolean;
}

/**
 * Method decorator for validating service method inputs and outputs
 */
export function Validate(config: ValidationConfig) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Skip validation if explicitly disabled
      if (config.skipValidation) {
        return originalMethod.apply(this, args);
      }

      // Validate input parameters
      if (config.input) {
        try {
          // For single parameter methods, validate the first argument
          // For multiple parameters, validate the entire args array
          const inputData = args.length === 1 ? args[0] : args;
          const validatedInput = config.input.parse(inputData);

          // Replace args with validated data
          if (args.length === 1) {
            args[0] = validatedInput;
          } else {
            args.splice(0, args.length, ...validatedInput);
          }
        } catch (error: any) {
          throw new ValidationError(
            `Input validation failed for ${target.constructor.name}.${propertyKey}`,
            error
          );
        }
      }

      // Execute the original method
      const result = await originalMethod.apply(this, args);

      // Validate output if schema is provided
      if (config.output) {
        try {
          const validatedOutput = config.output.parse(result);
          return validatedOutput;
        } catch (error: any) {
          // Log the validation error but don't expose internal details
          console.error(
            `Output validation failed for ${target.constructor.name}.${propertyKey}:`,
            error
          );

          throw new ValidationError(
            `Output validation failed for ${target.constructor.name}.${propertyKey}`,
            error
          );
        }
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Class decorator for validating all methods in a service class
 */
export function ValidateClass(defaultConfig: ValidationConfig = {}) {
  return <T extends { new (...args: any[]): {} }>(constructor: T) => {
    const prototype = constructor.prototype;
    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== "constructor" && typeof prototype[name] === "function"
    );

    methodNames.forEach((methodName) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
      if (descriptor && typeof descriptor.value === "function") {
        // Apply default validation to all methods
        Validate(defaultConfig)(prototype, methodName, descriptor);
        Object.defineProperty(prototype, methodName, descriptor);
      }
    });

    return constructor;
  };
}

/**
 * Parameter decorator for validating specific parameters
 */
export function ValidateParam(schema: ZodSchema, paramIndex = 0) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Validate specific parameter
      if (args[paramIndex] !== undefined) {
        try {
          args[paramIndex] = schema.parse(args[paramIndex]);
        } catch (error: any) {
          throw new ValidationError(
            `Parameter validation failed for ${target.constructor.name}.${propertyKey} at index ${paramIndex}`,
            error
          );
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Body validation decorator for HTTP request bodies
 */
export function ValidateBody(schema: ZodSchema) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Assume body is the first parameter for REST endpoints
      if (args[0] !== undefined) {
        try {
          args[0] = schema.parse(args[0]);
        } catch (error: any) {
          throw new ValidationError(
            `Request body validation failed for ${target.constructor.name}.${propertyKey}`,
            error
          );
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Query parameters validation decorator
 */
export function ValidateQuery(schema: ZodSchema) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Assume query is the second parameter after body
      const queryIndex = 1;
      if (args[queryIndex] !== undefined) {
        try {
          args[queryIndex] = schema.parse(args[queryIndex]);
        } catch (error: any) {
          throw new ValidationError(
            `Query parameters validation failed for ${target.constructor.name}.${propertyKey}`,
            error
          );
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * URL parameters validation decorator
 */
export function ValidateParams(schema: ZodSchema) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Assume params is the third parameter after body and query
      const paramsIndex = 2;
      if (args[paramsIndex] !== undefined) {
        try {
          args[paramsIndex] = schema.parse(args[paramsIndex]);
        } catch (error: any) {
          throw new ValidationError(
            `URL parameters validation failed for ${target.constructor.name}.${propertyKey}`,
            error
          );
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Headers validation decorator
 */
export function ValidateHeaders(schema: ZodSchema) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Assume headers is the fourth parameter
      const headersIndex = 3;
      if (args[headersIndex] !== undefined) {
        try {
          args[headersIndex] = schema.parse(args[headersIndex]);
        } catch (error: any) {
          throw new ValidationError(
            `Headers validation failed for ${target.constructor.name}.${propertyKey}`,
            error
          );
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Response validation decorator
 */
export function ValidateResponse(schema: ZodSchema) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);

      try {
        return schema.parse(result);
      } catch (error: any) {
        throw new ValidationError(
          `Response validation failed for ${target.constructor.name}.${propertyKey}`,
          error
        );
      }
    };

    return descriptor;
  };
}

/**
 * Validation metadata for reflection
 */
export const VALIDATION_METADATA_KEY = Symbol("validation");
export const PARAM_VALIDATION_KEY = Symbol("param_validation");

/**
 * Utility function to create validation schemas for common patterns
 */
export const ValidationSchemas = {
  /**
   * Create a schema for paginated queries
   */
  paginatedQuery: (additionalFields?: Record<string, ZodSchema>) => {
    const { z } = require("zod");
    const base = z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      sortBy: z.string().optional(),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
    });

    return additionalFields ? base.extend(additionalFields) : base;
  },

  /**
   * Create a schema for ID parameters
   */
  idParam: () => {
    const { z } = require("zod");
    return z.string().uuid("Invalid ID format");
  },

  /**
   * Create a schema for search queries
   */
  searchQuery: () => {
    const { z } = require("zod");
    return z.object({
      search: z.string().optional(),
      filter: z.record(z.any()).optional(),
    });
  },

  /**
   * Create a Result type schema for service responses
   */
  result: <T extends ZodSchema, E extends ZodSchema>(
    dataSchema: T,
    errorSchema?: E
  ) => {
    const { z } = require("zod");
    const errorSchemaDefault = z.object({
      code: z.string(),
      message: z.string(),
      cause: z.any().optional(),
    });

    return z.union([
      z.object({
        success: z.literal(true),
        data: dataSchema,
      }),
      z.object({
        success: z.literal(false),
        error: errorSchema || errorSchemaDefault,
      }),
    ]);
  },
};

// Export as CommonSchemas for backward compatibility
export const CommonSchemas = ValidationSchemas;

/**
 * Validation utilities for common operations
 */
export const ValidationUtils = {
  /**
   * Extract validation metadata from a target
   */
  getValidationMetadata: (target: any, propertyKey?: string) => {
    if (propertyKey) {
      return Reflect.getMetadata(VALIDATION_METADATA_KEY, target, propertyKey);
    }
    return Reflect.getMetadata(VALIDATION_METADATA_KEY, target);
  },

  /**
   * Set validation metadata on a target
   */
  setValidationMetadata: (
    config: ValidationConfig,
    target: any,
    propertyKey?: string
  ) => {
    if (propertyKey) {
      Reflect.defineMetadata(
        VALIDATION_METADATA_KEY,
        config,
        target,
        propertyKey
      );
    } else {
      Reflect.defineMetadata(VALIDATION_METADATA_KEY, config, target);
    }
  },

  /**
   * Check if a target has validation metadata
   */
  hasValidationMetadata: (target: any, propertyKey?: string) => {
    if (propertyKey) {
      return Reflect.hasMetadata(VALIDATION_METADATA_KEY, target, propertyKey);
    }
    return Reflect.hasMetadata(VALIDATION_METADATA_KEY, target);
  },

  /**
   * Get all validation metadata for a class
   */
  getAllValidationMetadata: (target: any) => {
    const methodNames = Object.getOwnPropertyNames(target.prototype).filter(
      (name) =>
        name !== "constructor" && typeof target.prototype[name] === "function"
    );

    const metadata: Record<string, any> = {};
    methodNames.forEach((methodName) => {
      const methodMetadata = Reflect.getMetadata(
        VALIDATION_METADATA_KEY,
        target.prototype,
        methodName
      );
      if (methodMetadata) {
        metadata[methodName] = methodMetadata;
      }
    });

    return metadata;
  },
};

/**
 * Common validators for frequently used patterns
 */
export const CommonValidators = {
  /**
   * Create validator for UUID strings
   */
  uuid: () => {
    const { z } = require("zod");
    return z.string().uuid("Invalid UUID format");
  },

  /**
   * Create validator for email addresses
   */
  email: () => {
    const { z } = require("zod");
    return z.string().email("Invalid email format");
  },

  /**
   * Create validator for pagination parameters
   */
  pagination: () => {
    const { z } = require("zod");
    return z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
    });
  },

  /**
   * Create validator for date strings
   */
  dateString: () => {
    const { z } = require("zod");
    return z.string().datetime("Invalid date format");
  },

  /**
   * Create validator for positive integers
   */
  positiveInt: () => {
    const { z } = require("zod");
    return z.number().int().positive("Must be a positive integer");
  },

  /**
   * Create validator for non-empty strings
   */
  nonEmptyString: () => {
    const { z } = require("zod");
    return z.string().min(1, "String cannot be empty");
  },
};

/**
 * Store validation metadata for runtime inspection
 */
export function getValidationMetadata(target: any, propertyKey?: string) {
  if (propertyKey) {
    return Reflect.getMetadata(VALIDATION_METADATA_KEY, target, propertyKey);
  }
  return Reflect.getMetadata(VALIDATION_METADATA_KEY, target);
}

/**
 * Set validation metadata
 */
export function setValidationMetadata(
  config: ValidationConfig,
  target: any,
  propertyKey?: string
) {
  if (propertyKey) {
    Reflect.defineMetadata(
      VALIDATION_METADATA_KEY,
      config,
      target,
      propertyKey
    );
  } else {
    Reflect.defineMetadata(VALIDATION_METADATA_KEY, config, target);
  }
}

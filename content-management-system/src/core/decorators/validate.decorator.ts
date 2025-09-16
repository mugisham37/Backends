import type { ZodSchema } from "zod";
import { ValidationError } from "../errors/validation.error.js";

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

/**
 * Validation metadata for reflection
 */
export const VALIDATION_METADATA_KEY = Symbol("validation");

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

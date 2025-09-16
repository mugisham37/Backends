import { z } from "zod";
import { FastifyRequest, FastifyReply } from "fastify";
import { AppError } from "../errors/app-error.js";

// Validation target types
export type ValidationTarget = "body" | "params" | "query" | "headers";

// Validation decorator options
export interface ValidateOptions {
  target: ValidationTarget;
  schema: z.ZodSchema;
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

// Validation decorator for route handlers
export function Validate(options: ValidateOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (
      request: FastifyRequest,
      reply: FastifyReply
    ) {
      try {
        const dataToValidate = getValidationData(request, options.target);

        // Validate the data using Zod
        const validatedData = options.schema.parse(dataToValidate);

        // Replace the original data with validated data
        setValidationData(request, options.target, validatedData);

        // Call the original method
        return await originalMethod.call(this, request, reply);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new AppError(
            "Validation failed",
            400,
            "VALIDATION_ERROR",
            formatZodErrors(error)
          );
        }
        throw error;
      }
    };

    return descriptor;
  };
}

// Validation middleware factory
export function createValidationMiddleware(options: ValidateOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const dataToValidate = getValidationData(request, options.target);

      // Validate the data using Zod
      const validatedData = options.schema.parse(dataToValidate);

      // Replace the original data with validated data
      setValidationData(request, options.target, validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError(
          "Validation failed",
          400,
          "VALIDATION_ERROR",
          formatZodErrors(error)
        );
      }
      throw error;
    }
  };
}

// Validation helper functions
function getValidationData(
  request: FastifyRequest,
  target: ValidationTarget
): any {
  switch (target) {
    case "body":
      return request.body;
    case "params":
      return request.params;
    case "query":
      return request.query;
    case "headers":
      return request.headers;
    default:
      throw new Error(`Invalid validation target: ${target}`);
  }
}

function setValidationData(
  request: FastifyRequest,
  target: ValidationTarget,
  data: any
): void {
  switch (target) {
    case "body":
      request.body = data;
      break;
    case "params":
      request.params = data;
      break;
    case "query":
      request.query = data;
      break;
    case "headers":
      request.headers = data;
      break;
    default:
      throw new Error(`Invalid validation target: ${target}`);
  }
}

// Format Zod errors for API response
function formatZodErrors(error: z.ZodError) {
  return error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
    code: err.code,
    received: err.code === "invalid_type" ? (err as any).received : undefined,
    expected: err.code === "invalid_type" ? (err as any).expected : undefined,
  }));
}

// Validation schemas for common use cases
export const validateBody = (schema: z.ZodSchema) =>
  createValidationMiddleware({ target: "body", schema });

export const validateParams = (schema: z.ZodSchema) =>
  createValidationMiddleware({ target: "params", schema });

export const validateQuery = (schema: z.ZodSchema) =>
  createValidationMiddleware({ target: "query", schema });

export const validateHeaders = (schema: z.ZodSchema) =>
  createValidationMiddleware({ target: "headers", schema });

// Async validation for complex scenarios
export async function validateAsync<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  options?: {
    stripUnknown?: boolean;
    abortEarly?: boolean;
  }
): Promise<T> {
  try {
    return await schema.parseAsync(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(
        "Validation failed",
        400,
        "VALIDATION_ERROR",
        formatZodErrors(error)
      );
    }
    throw error;
  }
}

// Validation result type
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

// Safe validation that returns result instead of throwing
export function validateSafe<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

// Transform and validate data
export function transformAndValidate<T, U>(
  inputSchema: z.ZodSchema<T>,
  outputSchema: z.ZodSchema<U>,
  transformer: (data: T) => U | Promise<U>
) {
  return async (data: unknown): Promise<U> => {
    // First validate input
    const validatedInput = await validateAsync(inputSchema, data);

    // Transform the data
    const transformedData = await transformer(validatedInput);

    // Validate the output
    return await validateAsync(outputSchema, transformedData);
  };
}

// Conditional validation
export function validateConditional<T>(
  condition: (data: any) => boolean,
  schema: z.ZodSchema<T>,
  fallbackSchema?: z.ZodSchema<T>
) {
  return (data: unknown): T => {
    if (condition(data)) {
      return schema.parse(data);
    }

    if (fallbackSchema) {
      return fallbackSchema.parse(data);
    }

    throw new AppError(
      "Validation condition not met",
      400,
      "VALIDATION_CONDITION_FAILED"
    );
  };
}

// Batch validation for arrays
export async function validateBatch<T>(
  schema: z.ZodSchema<T>,
  items: unknown[],
  options?: {
    continueOnError?: boolean;
    maxErrors?: number;
  }
): Promise<{
  validItems: T[];
  errors: Array<{
    index: number;
    errors: Array<{
      field: string;
      message: string;
      code: string;
    }>;
  }>;
}> {
  const validItems: T[] = [];
  const errors: Array<{
    index: number;
    errors: Array<{
      field: string;
      message: string;
      code: string;
    }>;
  }> = [];

  for (let i = 0; i < items.length; i++) {
    const result = validateSafe(schema, items[i]);

    if (result.success && result.data) {
      validItems.push(result.data);
    } else if (result.errors) {
      errors.push({
        index: i,
        errors: result.errors,
      });

      // Stop if we've hit the max errors limit
      if (options?.maxErrors && errors.length >= options.maxErrors) {
        break;
      }

      // Stop if we shouldn't continue on error
      if (!options?.continueOnError) {
        break;
      }
    }
  }

  return { validItems, errors };
}

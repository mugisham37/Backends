import "reflect-metadata";
import { z, ZodSchema, ZodError } from "zod";
import { ValidationError } from "../errors";
import type { Result } from "../types";

/**
 * Metadata keys for validation decorators
 */
export const VALIDATION_METADATA_KEY = Symbol("validation");
export const PARAM_VALIDATION_KEY = Symbol("param_validation");

/**
 * Validation metadata interface
 */
export interface ValidationMetadata {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
  headers?: ZodSchema;
  response?: ZodSchema;
}

/**
 * Parameter validation metadata
 */
export interface ParamValidationMetadata {
  index: number;
  schema: ZodSchema;
  source: "body" | "params" | "query" | "headers" | "custom";
}

/**
 * Validation options
 */
export interface ValidationOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
  allowUnknown?: boolean;
}

/**
 * Decorator to validate request data using Zod schemas
 * @param schemas Validation schemas for different parts of the request
 * @param options Validation options
 */
export function Validate(
  schemas: ValidationMetadata,
  options: ValidationOptions = {}
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor
  ) {
    const metadata = {
      ...schemas,
      options,
    };
    Reflect.defineMetadata(
      VALIDATION_METADATA_KEY,
      metadata,
      target,
      propertyKey
    );
  };
}

/**
 * Decorator to validate request body
 * @param schema Zod schema for request body
 * @param options Validation options
 */
export function ValidateBody<T>(
  schema: ZodSchema<T>,
  options: ValidationOptions = {}
): MethodDecorator {
  return Validate({ body: schema }, options);
}

/**
 * Decorator to validate request parameters
 * @param schema Zod schema for request parameters
 * @param options Validation options
 */
export function ValidateParams<T>(
  schema: ZodSchema<T>,
  options: ValidationOptions = {}
): MethodDecorator {
  return Validate({ params: schema }, options);
}

/**
 * Decorator to validate query parameters
 * @param schema Zod schema for query parameters
 * @param options Validation options
 */
export function ValidateQuery<T>(
  schema: ZodSchema<T>,
  options: ValidationOptions = {}
): MethodDecorator {
  return Validate({ query: schema }, options);
}

/**
 * Decorator to validate request headers
 * @param schema Zod schema for request headers
 * @param options Validation options
 */
export function ValidateHeaders<T>(
  schema: ZodSchema<T>,
  options: ValidationOptions = {}
): MethodDecorator {
  return Validate({ headers: schema }, options);
}

/**
 * Decorator to validate response data
 * @param schema Zod schema for response data
 * @param options Validation options
 */
export function ValidateResponse<T>(
  schema: ZodSchema<T>,
  options: ValidationOptions = {}
): MethodDecorator {
  return Validate({ response: schema }, options);
}

/**
 * Decorator to validate a specific method parameter
 * @param schema Zod schema for the parameter
 * @param source Source of the parameter data
 */
export function ValidateParam<T>(
  schema: ZodSchema<T>,
  source: "body" | "params" | "query" | "headers" | "custom" = "custom"
): ParameterDecorator {
  return function (
    target: any,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ) {
    if (!propertyKey) return;

    const existingMetadata: ParamValidationMetadata[] =
      Reflect.getMetadata(PARAM_VALIDATION_KEY, target, propertyKey) || [];

    existingMetadata.push({
      index: parameterIndex,
      schema,
      source,
    });

    Reflect.defineMetadata(
      PARAM_VALIDATION_KEY,
      existingMetadata,
      target,
      propertyKey
    );
  };
}

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  // ID validation
  id: z.string().uuid("Invalid ID format"),

  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).optional(),
  }),

  // Sorting
  sort: z.object({
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  }),

  // Search
  search: z.object({
    query: z.string().min(1).optional(),
    filters: z.record(z.unknown()).optional(),
  }),

  // Date range
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  }),

  // Email
  email: z.string().email("Invalid email format"),

  // Password
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/\d/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character"
    ),

  // URL
  url: z.string().url("Invalid URL format"),

  // Slug
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format"),

  // Status
  contentStatus: z.enum(["draft", "published", "archived"]),

  // Role
  userRole: z.enum(["admin", "editor", "author", "viewer"]),

  // File upload
  fileUpload: z.object({
    filename: z.string().min(1),
    mimeType: z.string().min(1),
    size: z
      .number()
      .int()
      .min(1)
      .max(10 * 1024 * 1024), // 10MB max
  }),

  // Metadata
  metadata: z.record(z.unknown()).optional(),

  // Tags
  tags: z.array(z.string().min(1)).default([]),
};

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Get validation metadata from a method
   */
  static getValidationMetadata(
    target: any,
    propertyKey: string | symbol
  ): (ValidationMetadata & { options?: ValidationOptions }) | undefined {
    return Reflect.getMetadata(VALIDATION_METADATA_KEY, target, propertyKey);
  }

  /**
   * Get parameter validation metadata from a method
   */
  static getParamValidationMetadata(
    target: any,
    propertyKey: string | symbol
  ): ParamValidationMetadata[] {
    return Reflect.getMetadata(PARAM_VALIDATION_KEY, target, propertyKey) || [];
  }

  /**
   * Validate data against a schema
   */
  static validate<T>(
    schema: ZodSchema<T>,
    data: unknown
  ): Result<T, ValidationError> {
    try {
      const result = schema.parse(data);
      return { success: true, data: result };
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = this.zodErrorToValidationError(error);
        return { success: false, error: validationError };
      }
      return {
        success: false,
        error: new ValidationError("Validation failed", undefined, data, error),
      };
    }
  }

  /**
   * Validate data against a schema with safe parsing
   */
  static safeParse<T>(
    schema: ZodSchema<T>,
    data: unknown
  ): z.SafeParseReturnType<unknown, T> {
    return schema.safeParse(data);
  }

  /**
   * Convert ZodError to ValidationError
   */
  static zodErrorToValidationError(zodError: ZodError): ValidationError {
    const errors = zodError.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
      code: err.code,
      value: undefined, // ZodIssue doesn't have input property
    }));

    if (errors.length === 1) {
      const error = errors[0]!;
      return ValidationError.forField(error.field, error.message, error.value);
    }

    return new ValidationError(
      `Multiple validation errors: ${errors
        .map((e) => `${e.field}: ${e.message}`)
        .join("; ")}`,
      undefined,
      undefined,
      zodError,
      { errors }
    );
  }

  /**
   * Validate request data based on metadata
   */
  static validateRequest(
    request: any,
    metadata: ValidationMetadata & { options?: ValidationOptions }
  ): Result<
    { body?: any; params?: any; query?: any; headers?: any },
    ValidationError
  > {
    const results: any = {};
    const errors: ValidationError[] = [];

    // Validate body
    if (metadata.body && request.body !== undefined) {
      const result = this.validate(metadata.body, request.body);
      if (result.success) {
        results.body = result.data;
      } else {
        errors.push(result.error);
      }
    }

    // Validate params
    if (metadata.params && request.params !== undefined) {
      const result = this.validate(metadata.params, request.params);
      if (result.success) {
        results.params = result.data;
      } else {
        errors.push(result.error);
      }
    }

    // Validate query
    if (metadata.query && request.query !== undefined) {
      const result = this.validate(metadata.query, request.query);
      if (result.success) {
        results.query = result.data;
      } else {
        errors.push(result.error);
      }
    }

    // Validate headers
    if (metadata.headers && request.headers !== undefined) {
      const result = this.validate(metadata.headers, request.headers);
      if (result.success) {
        results.headers = result.data;
      } else {
        errors.push(result.error);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        error:
          errors.length === 1 ? errors[0]! : ValidationError.multiple(errors),
      };
    }

    return { success: true, data: results };
  }

  /**
   * Create a validation schema for list requests
   */
  static createListSchema<T extends Record<string, any>>(
    filterSchema?: ZodSchema<T>
  ): ZodSchema<{
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    search?: string;
    filters?: T;
  }> {
    return z.object({
      ...CommonSchemas.pagination.shape,
      ...CommonSchemas.sort.shape,
      search: z.string().optional(),
      filters: filterSchema ? filterSchema.optional() : z.unknown().optional(),
    });
  }

  /**
   * Create a validation schema for create requests
   */
  static createCreateSchema<T>(dataSchema: ZodSchema<T>): ZodSchema<T> {
    return dataSchema;
  }

  /**
   * Create a validation schema for update requests
   */
  static createUpdateSchema<T>(
    dataSchema: ZodSchema<T>
  ): ZodSchema<Partial<T>> {
    // For generic ZodSchema, we need to handle partial differently
    if ("partial" in dataSchema && typeof dataSchema.partial === "function") {
      return (dataSchema as any).partial();
    }
    // Fallback for schemas that don't support partial
    return dataSchema.optional() as any;
  }
}

/**
 * Pre-built validation decorators for common use cases
 */
export const CommonValidators = {
  /**
   * Validate ID parameter
   */
  ValidateId: ValidateParams(z.object({ id: CommonSchemas.id })),

  /**
   * Validate pagination query
   */
  ValidatePagination: ValidateQuery(CommonSchemas.pagination),

  /**
   * Validate search query
   */
  ValidateSearch: ValidateQuery(CommonSchemas.search),

  /**
   * Validate email in body
   */
  ValidateEmail: ValidateBody(z.object({ email: CommonSchemas.email })),

  /**
   * Validate password in body
   */
  ValidatePassword: ValidateBody(
    z.object({ password: CommonSchemas.password })
  ),
};

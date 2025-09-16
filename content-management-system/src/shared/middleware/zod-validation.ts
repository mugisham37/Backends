import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodError, ZodSchema } from "zod";

/**
 * Enhanced Zod validation middleware for Fastify with comprehensive error handling
 */

export interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  querystring?: ZodSchema;
  headers?: ZodSchema;
  response?: Record<number, ZodSchema>;
}

export interface ValidationOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
  allowUnknown?: boolean;
  coerceTypes?: boolean;
}

export const zodValidation = (
  schemas: ValidationSchemas,
  _options: ValidationOptions = {}
) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const validationErrors: ValidationError[] = [];

    try {
      // Validate request body
      if (schemas.body) {
        const bodyResult = schemas.body.safeParse(request.body);
        if (!bodyResult.success) {
          validationErrors.push(...formatZodErrors(bodyResult.error, "body"));
        } else {
          request.body = bodyResult.data;
        }
      }

      // Validate request params
      if (schemas.params) {
        const paramsResult = schemas.params.safeParse(request.params);
        if (!paramsResult.success) {
          validationErrors.push(
            ...formatZodErrors(paramsResult.error, "params")
          );
        } else {
          request.params = paramsResult.data;
        }
      }

      // Validate query parameters
      if (schemas.querystring) {
        const queryResult = schemas.querystring.safeParse(request.query);
        if (!queryResult.success) {
          validationErrors.push(...formatZodErrors(queryResult.error, "query"));
        } else {
          request.query = queryResult.data;
        }
      }

      // Validate headers
      if (schemas.headers) {
        const headersResult = schemas.headers.safeParse(request.headers);
        if (!headersResult.success) {
          validationErrors.push(
            ...formatZodErrors(headersResult.error, "headers")
          );
        } else {
          // Don't override headers completely, just validate
          Object.assign(request.headers, headersResult.data);
        }
      }

      // If there are validation errors, return them
      if (validationErrors.length > 0) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: validationErrors,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // Store validation schemas for response validation
      if (schemas.response) {
        request.validationSchemas = schemas;
      }
    } catch (error) {
      request.log.error(`Validation middleware error: ${error}`);
      // Throw the error instead of sending response directly
      const validationError = new Error("Internal validation error");
      (validationError as any).statusCode = 500;
      throw validationError;
    }
  };
};

/**
 * Response validation middleware
 */
export const validateResponse = (
  statusCode: number,
  responseSchema: ZodSchema
) => {
  return async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
    try {
      const result = responseSchema.safeParse(payload);
      if (!result.success) {
        request.log.error(
          `Response validation failed: Status: ${statusCode}, Errors: ${JSON.stringify(
            result.error.errors
          )}, Payload: ${JSON.stringify(payload)}`
        );

        // In development, return validation errors
        if (process.env["NODE_ENV"] === "development") {
          return reply.status(500).send({
            success: false,
            error: {
              code: "RESPONSE_VALIDATION_ERROR",
              message: "Response validation failed",
              details: formatZodErrors(result.error, "response"),
            },
            timestamp: new Date().toISOString(),
          });
        }

        // In production, log error but return generic error
        return reply.status(500).send({
          success: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred",
          },
          timestamp: new Date().toISOString(),
        });
      }

      return result.data;
    } catch (error) {
      request.log.error(`Response validation middleware error: ${error}`);
      throw error;
    }
  };
};

/**
 * Helper function to create validation preHandler
 */
export const validate = (
  schemas: ValidationSchemas,
  options?: ValidationOptions
) => {
  return zodValidation(schemas, options);
};

/**
 * Helper function to create endpoint validation with both request and response validation
 */
export const validateEndpoint = (
  schemas: ValidationSchemas,
  options?: ValidationOptions
) => {
  const requestValidation = zodValidation(schemas, options);

  return {
    preHandler: requestValidation,
    responseValidation: schemas.response ? validateResponse : undefined,
  };
};

/**
 * Format Zod errors into a consistent structure
 */
function formatZodErrors(error: ZodError, section: string): ValidationError[] {
  return error.errors.map((err) => ({
    section,
    field: err.path.length > 0 ? err.path.join(".") : section,
    message: err.message,
    code: err.code,
    received: "received" in err ? err.received : undefined,
    expected: "expected" in err ? err.expected : undefined,
  }));
}

/**
 * Validation error structure
 */
export interface ValidationError {
  section: string;
  field: string;
  message: string;
  code: string;
  received?: any;
  expected?: any;
}

/**
 * Validation error response type
 */
export interface ValidationErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: ValidationError[];
  };
  timestamp: string;
}

/**
 * Extend FastifyRequest to include validation schemas
 */
declare module "fastify" {
  interface FastifyRequest {
    validationSchemas?: ValidationSchemas;
  }
}

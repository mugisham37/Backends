import type { FastifyRequest, FastifyReply } from "fastify";
import type { ZodSchema, ZodError } from "zod";

/**
 * Zod validation middleware for Fastify
 */

export interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  querystring?: ZodSchema;
  headers?: ZodSchema;
}

export const zodValidation = (schemas: ValidationSchemas) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate request body
      if (schemas.body && request.body) {
        request.body = schemas.body.parse(request.body);
      }

      // Validate request params
      if (schemas.params && request.params) {
        request.params = schemas.params.parse(request.params);
      }

      // Validate query parameters
      if (schemas.querystring && request.query) {
        request.query = schemas.querystring.parse(request.query);
      }

      // Validate headers
      if (schemas.headers && request.headers) {
        request.headers = schemas.headers.parse(request.headers);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") {
        const zodError = error as ZodError;
        const validationErrors = zodError.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          code: err.code,
        }));

        return reply.status(400).send({
          error: "Validation Error",
          message: "Request validation failed",
          details: validationErrors,
          timestamp: new Date().toISOString(),
        });
      }

      // Re-throw unexpected errors
      throw error;
    }
  };
};

/**
 * Helper function to create validation preHandler
 */
export const validate = (schemas: ValidationSchemas) => {
  return zodValidation(schemas);
};

/**
 * Validation error response type
 */
export interface ValidationErrorResponse {
  error: string;
  message: string;
  details: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  timestamp: string;
}

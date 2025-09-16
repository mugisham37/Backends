import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";

/**
 * Validation Plugin for Fastify
 *
 * Provides Zod-based validation middleware for request validation.
 */
async function validationPlugin(fastify: FastifyInstance) {
  // Register validation decorator
  fastify.decorate("validate", (schema: z.ZodSchema) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Validate request body, query, and params
        const validationData = {
          body: request.body,
          query: request.query,
          params: request.params,
        };

        const result = schema.safeParse(validationData);

        if (!result.success) {
          return reply.status(400).send({
            error: "Validation Error",
            message: "Request validation failed",
            details: result.error.errors.map((err) => ({
              path: err.path.join("."),
              message: err.message,
              code: err.code,
            })),
            timestamp: new Date().toISOString(),
          });
        }

        // Attach validated data to request
        request.validated = result.data;
      } catch (error) {
        request.log.error(`Validation error: ${error}`);
        return reply.status(400).send({
          error: "Validation Error",
          message: "Request validation failed",
          timestamp: new Date().toISOString(),
        });
      }
    };
  });
}

// Declare the validate decorator type
declare module "fastify" {
  interface FastifyInstance {
    validate: (
      schema: z.ZodSchema
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    validated?: any;
  }
}

export default fp(validationPlugin, {
  name: "fastify-validation",
});

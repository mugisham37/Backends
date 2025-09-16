import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { graphqlApiPlugin } from "./graphql/plugin";
import { restApiPlugin } from "./rest/plugin";

/**
 * Unified API Gateway Plugin
 *
 * This plugin creates a single entry point for both REST and GraphQL APIs
 * with proper request routing, transformation, and versioning support.
 */
export const apiGatewayPlugin: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Add API gateway hooks for request/response transformation
  fastify.addHook("onRequest", async (request, reply) => {
    // Add request ID for tracing
    const requestId =
      request.headers["x-request-id"] ||
      `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    request.headers["x-request-id"] = requestId;
    reply.header("x-request-id", requestId);

    // Add API version header
    reply.header("x-api-version", "v1");

    // Log API gateway request
    request.log.info(
      {
        requestId,
        method: request.method,
        url: request.url,
        userAgent: request.headers["user-agent"],
        ip: request.ip,
      },
      "API Gateway - Request received"
    );
  });

  fastify.addHook("onResponse", async (request, reply) => {
    // Log API gateway response
    request.log.info(
      {
        requestId: request.headers["x-request-id"],
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "API Gateway - Response sent"
    );
  });

  // Register REST API with versioning
  await fastify.register(restApiPlugin, {
    prefix: "/api/v1",
  });

  // Register GraphQL API
  await fastify.register(graphqlApiPlugin, {
    prefix: "/graphql",
  });

  // API Gateway health check
  fastify.get("/api/health", async (_request, reply) => {
    return reply.status(200).send({
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "v1",
      services: {
        rest: "available",
        graphql: "available",
      },
    });
  });

  // API Gateway info endpoint
  fastify.get("/api/info", async (_request, reply) => {
    return reply.status(200).send({
      name: "Content Management System API",
      version: "1.0.0",
      description: "Unified API Gateway for REST and GraphQL endpoints",
      endpoints: {
        rest: {
          base: "/api/v1",
          documentation: "/api/v1/docs",
        },
        graphql: {
          endpoint: "/graphql",
          playground: "/graphql/playground",
        },
      },
      timestamp: new Date().toISOString(),
    });
  });
};

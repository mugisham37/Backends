import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import mercurius from "mercurius";
import { buildSchema } from "./schema/index";
import { buildResolvers } from "./resolvers/index";
import { buildContext } from "./context";

/**
 * GraphQL API Plugin for Fastify using Mercurius
 *
 * Provides GraphQL endpoint with subscriptions, DataLoader integration,
 * and proper authentication context.
 */
export const graphqlApiPlugin: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  // Register Mercurius GraphQL plugin
  await fastify.register(mercurius, {
    schema: buildSchema(),
    resolvers: buildResolvers(),
    context: buildContext,
    subscription: true,
    graphiql: fastify.config.NODE_ENV === "development" ? "playground" : false,
    ide: fastify.config.NODE_ENV === "development",
    path: "/",
    errorFormatter: (execution, context) => {
      // Custom error formatting
      const { errors } = execution;

      if (!errors) return execution;

      const formattedErrors = errors.map((error) => {
        // Log the error
        context.reply.log.error(
          {
            message: error.message,
            path: error.path,
            extensions: error.extensions,
          },
          "GraphQL Error"
        );

        // In production, don't expose internal server errors
        if (
          fastify.config.NODE_ENV === "production" &&
          error.extensions?.code === "INTERNAL_SERVER_ERROR"
        ) {
          return {
            message: "Internal server error",
            path: error.path,
            extensions: {
              code: "INTERNAL_SERVER_ERROR",
            },
          };
        }

        return error;
      });

      return {
        ...execution,
        errors: formattedErrors,
      };
    },
  });

  // GraphQL health check
  fastify.get("/health", async (request, reply) => {
    return reply.status(200).send({
      status: "healthy",
      service: "graphql",
      timestamp: new Date().toISOString(),
      endpoint: "/graphql",
      playground:
        fastify.config.NODE_ENV === "development"
          ? "/graphql/playground"
          : null,
    });
  });
};

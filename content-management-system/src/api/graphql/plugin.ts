import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import mercurius from "mercurius";
import { buildContext } from "./context";
import { buildResolvers } from "./resolvers/index";
import { buildSchema } from "./schema/index";

// Extend FastifyInstance to include redis property
declare module "fastify" {
  interface FastifyInstance {
    redis?: any;
  }
}

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
  await fastify.register(mercurius as any, {
    schema: buildSchema(),
    resolvers: buildResolvers(),
    context: buildContext,
    subscription: {
      emitter: fastify.redis || undefined,
      verifyClient: (info: any, next: any) => {
        // Verify WebSocket connection for subscriptions
        const token = info.req.headers.authorization?.replace("Bearer ", "");
        if (token) {
          // Add token validation logic here if needed
          next(true);
        } else {
          next(false, 401, "Unauthorized");
        }
      },
    },
    graphiql: process.env.NODE_ENV === "development" ? "playground" : false,
    ide: process.env.NODE_ENV === "development",
    path: "/",
    errorFormatter: (execution: any, context: any) => {
      // Custom error formatting
      const { errors } = execution;

      if (!errors) return execution;

      const formattedErrors = errors.map((error: any) => {
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
          process.env.NODE_ENV === "production" &&
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
  fastify.get("/health", async (_request, reply) => {
    return reply.status(200).send({
      status: "healthy",
      service: "graphql",
      timestamp: new Date().toISOString(),
      endpoint: "/graphql",
      playground:
        process.env.NODE_ENV === "development" ? "/graphql/playground" : null,
      subscriptions: "enabled",
      dataLoaders: "enabled",
    });
  });
};

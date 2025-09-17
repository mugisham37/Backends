/**
 * GraphQL API entry point
 * Sets up Apollo Server with schema-first approach
 */

import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { GraphQLFormattedError, GraphQLError } from "graphql";
import {
  ApolloServerPlugin,
  GraphQLRequestContext,
  GraphQLRequestListener,
} from "@apollo/server";
import { typeDefs } from "./schema/index.js";
import { resolvers } from "./resolvers/index.js";
import { createContext, GraphQLContext } from "./context.js";
import { formatError as customFormatError } from "../../shared/utils/graphql-error.utils.js";

// Create Apollo Server instance
export const createGraphQLServer = () => {
  return new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    formatError: (
      formattedError: GraphQLFormattedError,
      error: unknown
    ): GraphQLFormattedError => {
      return customFormatError(error as GraphQLError);
    },
    introspection: process.env.NODE_ENV !== "production",
    plugins: [
      // Add custom plugins for logging, caching, etc.
      {
        async requestDidStart(): Promise<
          GraphQLRequestListener<GraphQLContext>
        > {
          return {
            async didResolveOperation(
              requestContext: GraphQLRequestContext<GraphQLContext>
            ) {
              console.log(
                `GraphQL Operation: ${requestContext.request.operationName}`
              );
            },
            async didEncounterErrors(
              requestContext: GraphQLRequestContext<GraphQLContext>
            ) {
              console.error(
                "GraphQL errors:",
                requestContext.errors?.map(
                  (error: GraphQLError) => error.message
                )
              );
            },
          };
        },
      } as ApolloServerPlugin<GraphQLContext>,
    ],
  });
};

// Start standalone GraphQL server (for development)
export const startGraphQLServer = async (port: number = 4000) => {
  const server = createGraphQLServer();

  const { url } = await startStandaloneServer(server, {
    listen: { port },
    context: createContext,
  });

  console.log(`🚀 GraphQL Server ready at ${url}`);
  console.log(`📊 GraphQL Playground available at ${url}`);

  return server;
};

export { typeDefs, resolvers };

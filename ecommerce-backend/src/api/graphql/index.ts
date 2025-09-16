/**
 * GraphQL API entry point
 * Sets up Apollo Server with schema-first approach
 */

import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { typeDefs } from "./schema/index.js";
import { resolvers } from "./resolvers/index.js";
import { createContext, GraphQLContext } from "./context.js";
import { formatError } from "../../shared/utils/graphql-error.utils.js";

// Create Apollo Server instance
export const createGraphQLServer = () => {
  return new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    formatError,
    introspection: process.env.NODE_ENV !== "production",
    plugins: [
      // Add custom plugins for logging, caching, etc.
      {
        requestDidStart() {
          return {
            didResolveOperation(requestContext) {
              console.log(
                `GraphQL Operation: ${requestContext.request.operationName}`
              );
            },
            didEncounterErrors(requestContext) {
              console.error(
                "GraphQL errors:",
                requestContext.errors?.map((error) => error.message)
              );
            },
          };
        },
      },
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

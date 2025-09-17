/**
 * GraphQL API setup for Fastify with Mercurius
 *
 * This file provides the main GraphQL functionality using Mercurius
 * instead of Apollo Server, which is more appropriate for Fastify.
 */

// Re-export the main GraphQL plugin
export { graphqlApiPlugin } from "./plugin";

// Re-export GraphQL utilities
export { buildContext, type GraphQLContext } from "./context";
export { buildResolvers } from "./resolvers/index";
export { buildSchema } from "./schema/index";
export { createDataLoaders, type DataLoaders } from "./dataloaders/index";

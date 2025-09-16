import type { GraphQLContext } from "../context";

export const userResolvers = {
  Query: {
    // User queries are handled through the main resolvers
    // Individual user data is loaded via DataLoaders
  },

  Mutation: {
    // User mutations would go here if needed
    // Currently handled through auth and tenant services
  },
};

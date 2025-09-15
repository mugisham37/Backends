import type { GraphQLContext } from "../context";

export const authResolvers = {
  Query: {
    me: async (parent: any, args: any, context: GraphQLContext) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }
      return context.user;
    },
  },

  Mutation: {
    login: async (parent: any, { input }: any, context: GraphQLContext) => {
      const result = await context.dataSources.authService.authenticate(input);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    logout: async (parent: any, args: any, context: GraphQLContext) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      // Implement logout logic
      return true;
    },

    refreshToken: async (
      parent: any,
      { refreshToken }: any,
      context: GraphQLContext
    ) => {
      const result = await context.dataSources.authService.refreshToken(
        refreshToken
      );

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
  },
};

import type { GraphQLContext } from "../context";

export const searchResolvers = {
  Query: {
    search: async (_parent: any, { input }: any, context: GraphQLContext) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const searchParams = {
        ...input,
        tenantId: context.user.tenantId, // Scope search to user's tenant
      };

      const result =
        await context.dataSources.searchService.search(searchParams);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      // Calculate pagination info
      const page = input.page || 1;
      const limit = input.limit || 20;
      const total = result.data.total;
      const hasMore = page * limit < total;

      return {
        items: result.data.hits,
        total,
        page,
        limit,
        hasMore,
      };
    },
  },
};

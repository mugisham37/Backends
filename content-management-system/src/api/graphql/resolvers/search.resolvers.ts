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

      return {
        items: result.data.items,
        total: result.data.total,
        page: input.page || 1,
        limit: input.limit || 20,
        hasMore: result.data.hasMore,
      };
    },
  },
};

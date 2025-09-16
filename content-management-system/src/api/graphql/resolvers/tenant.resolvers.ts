import type { GraphQLContext } from "../context";

export const tenantResolvers = {
  Query: {
    tenant: async (_parent: any, { id }: any, context: GraphQLContext) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const result = await context.dataSources.tenantService.getTenant(id);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    tenants: async (
      _parent: any,
      { page, limit }: any,
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const result = await context.dataSources.tenantService.getUserTenants(
        context.user.id
      );

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
  },

  Mutation: {
    createTenant: async (
      _parent: any,
      { input }: any,
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const result =
        await context.dataSources.tenantService.createTenant(input);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    updateTenant: async (
      _parent: any,
      { id, input }: any,
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const result = await context.dataSources.tenantService.updateTenant(
        id,
        input
      );

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    deleteTenant: async (
      _parent: any,
      { id }: any,
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const result = await context.dataSources.tenantService.deleteTenant(id);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return true;
    },
  },
};

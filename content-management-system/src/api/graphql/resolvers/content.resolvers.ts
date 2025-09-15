import type { GraphQLContext } from "../context";

export const contentResolvers = {
  Query: {
    content: async (
      parent: any,
      { id, version }: any,
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const result = await context.dataSources.contentService.getContent(
        id,
        version
      );

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    contents: async (
      parent: any,
      { page, limit, status, authorId }: any,
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      // Implement content listing with filters
      const result =
        await context.dataSources.contentService.getContentsByTenant(
          context.user.tenantId,
          { page, limit, status, authorId }
        );

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    contentVersions: async (
      parent: any,
      { contentId }: any,
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const result =
        await context.dataSources.contentService.getContentVersions(contentId);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
  },

  Mutation: {
    createContent: async (
      parent: any,
      { input }: any,
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const contentData = {
        ...input,
        authorId: context.user.id,
        tenantId: context.user.tenantId,
      };

      const result = await context.dataSources.contentService.createContent(
        contentData
      );

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    updateContent: async (
      parent: any,
      { id, input }: any,
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const result = await context.dataSources.contentService.updateContent(
        id,
        input
      );

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    deleteContent: async (
      parent: any,
      { id }: any,
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const result = await context.dataSources.contentService.deleteContent(id);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return true;
    },

    publishContent: async (
      parent: any,
      { id }: any,
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const result = await context.dataSources.contentService.publishContent(
        id
      );

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    unpublishContent: async (
      parent: any,
      { id }: any,
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const updateResult =
        await context.dataSources.contentService.updateContent(id, {
          status: "DRAFT",
        });

      if (!updateResult.success) {
        throw new Error(updateResult.error.message);
      }

      return updateResult.data;
    },
  },

  Subscription: {
    contentCreated: {
      subscribe: async (
        parent: any,
        { tenantId }: any,
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new Error("Authentication required");
        }

        // Return subscription iterator for content creation events
        return context.reply.graphql.pubsub.asyncIterator(
          `CONTENT_CREATED_${tenantId || context.user.tenantId}`
        );
      },
    },

    contentUpdated: {
      subscribe: async (
        parent: any,
        { contentId }: any,
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new Error("Authentication required");
        }

        return context.reply.graphql.pubsub.asyncIterator(
          `CONTENT_UPDATED_${contentId}`
        );
      },
    },

    contentPublished: {
      subscribe: async (
        parent: any,
        { tenantId }: any,
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new Error("Authentication required");
        }

        return context.reply.graphql.pubsub.asyncIterator(
          `CONTENT_PUBLISHED_${tenantId || context.user.tenantId}`
        );
      },
    },
  },
};

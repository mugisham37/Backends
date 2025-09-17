import type { GraphQLContext } from "../context";

export const contentResolvers = {
  Query: {
    content: async (
      _parent: any,
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
      _parent: any,
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
          {
            where: { status, authorId },
            pagination: { page, limit },
          }
        );

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    contentVersions: async (
      _parent: any,
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
      _parent: any,
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
      _parent: any,
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
      _parent: any,
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
      _parent: any,
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
      _parent: any,
      { id }: any,
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const updateResult =
        await context.dataSources.contentService.updateContent(id, {
          status: "draft",
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
        _parent: any,
        { tenantId }: any,
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new Error("Authentication required");
        }

        // Return subscription iterator for content creation events
        return context.pubsub.asyncIterator(
          `CONTENT_CREATED_${tenantId || context.user.tenantId}`
        );
      },
    },

    contentUpdated: {
      subscribe: async (
        _parent: any,
        { contentId }: any,
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new Error("Authentication required");
        }

        return context.pubsub.asyncIterator(`CONTENT_UPDATED_${contentId}`);
      },
    },

    contentPublished: {
      subscribe: async (
        _parent: any,
        { tenantId }: any,
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new Error("Authentication required");
        }

        return context.pubsub.asyncIterator(
          `CONTENT_PUBLISHED_${tenantId || context.user.tenantId}`
        );
      },
    },
  },
};

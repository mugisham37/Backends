import type { GraphQLContext } from "../context";

export const mediaResolvers = {
  Query: {
    media: async (_parent: any, { id }: any, context: GraphQLContext) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const result = await context.dataSources.mediaService.getFile(id);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    mediaFiles: async (
      _parent: any,
      { page, limit, mimeType }: any,
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      // Implement media listing with filters
      const result = await context.dataSources.mediaService.getMediaByTenant(
        context.user.tenantId,
        {
          where: { mimeType },
          pagination: { page, limit },
        }
      );

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },
  },

  Mutation: {
    uploadMedia: async (
      _parent: any,
      { file, metadata }: any,
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const mediaData = {
        file,
        metadata: {
          ...metadata,
          uploadedBy: context.user.id,
          tenantId: context.user.tenantId,
        },
      };

      const result = await context.dataSources.mediaService.uploadFile(
        mediaData.file,
        mediaData.metadata
      );

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return result.data;
    },

    deleteMedia: async (_parent: any, { id }: any, context: GraphQLContext) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }

      const result = await context.dataSources.mediaService.deleteFile(id);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      return true;
    },
  },

  Subscription: {
    mediaUploaded: {
      subscribe: async (
        _parent: any,
        { tenantId }: any,
        context: GraphQLContext
      ) => {
        if (!context.user) {
          throw new Error("Authentication required");
        }

        return context.pubsub.asyncIterator(
          `MEDIA_UPLOADED_${tenantId || context.user.tenantId}`
        );
      },
    },
  },
};

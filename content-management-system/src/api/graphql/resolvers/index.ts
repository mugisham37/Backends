import type { IResolvers } from "mercurius";
import { authResolvers } from "./auth.resolvers";
import { tenantResolvers } from "./tenant.resolvers";
import { contentResolvers } from "./content.resolvers";
import { mediaResolvers } from "./media.resolvers";
import { searchResolvers } from "./search.resolvers";
import { userResolvers } from "./user.resolvers";
import { webhookResolvers } from "./webhook.resolvers";
import { workflowResolvers } from "./workflow.resolvers";
import { contentTypeResolvers } from "./content-type.resolvers";

/**
 * GraphQL Resolvers Builder
 *
 * Combines all resolver modules into a single resolver map
 * for the GraphQL schema.
 */
export const buildResolvers = (): IResolvers => {
  return {
    // Scalar resolvers
    DateTime: {
      serialize: (value: Date) => value.toISOString(),
      parseValue: (value: string) => new Date(value),
      parseLiteral: (ast: any) => new Date(ast.value),
    },

    JSON: {
      serialize: (value: any) => value,
      parseValue: (value: any) => value,
      parseLiteral: (ast: any) => JSON.parse(ast.value),
    },

    // Union type resolvers
    SearchItem: {
      __resolveType: (obj: any) => {
        if (obj.title && obj.body !== undefined) return "Content";
        if (obj.filename && obj.mimeType) return "Media";
        if (obj.email && obj.role) return "User";
        return null;
      },
    },

    // Root resolvers
    Query: {
      ...authResolvers.Query,
      ...tenantResolvers.Query,
      ...contentResolvers.Query,
      ...mediaResolvers.Query,
      ...searchResolvers.Query,
      ...userResolvers.Query,
      ...webhookResolvers.Query,
      ...workflowResolvers.Query,
      ...contentTypeResolvers.Query,
    },

    Mutation: {
      ...authResolvers.Mutation,
      ...tenantResolvers.Mutation,
      ...contentResolvers.Mutation,
      ...mediaResolvers.Mutation,
      ...userResolvers.Mutation,
      ...webhookResolvers.Mutation,
      ...workflowResolvers.Mutation,
      ...contentTypeResolvers.Mutation,
    },

    Subscription: {
      ...contentResolvers.Subscription,
      ...mediaResolvers.Subscription,
    },

    // Type resolvers for relationships using DataLoaders
    User: {
      tenant: async (parent: any, args: any, context: any) => {
        if (!parent.tenantId) return null;
        return context.loaders.tenantLoader.load(parent.tenantId);
      },
    },

    Tenant: {
      users: async (parent: any, args: any, context: any) => {
        return context.loaders.usersByTenantLoader.load(parent.id);
      },
      contents: async (parent: any, args: any, context: any) => {
        return context.loaders.contentsByTenantLoader.load(parent.id);
      },
    },

    Content: {
      tenant: async (parent: any, args: any, context: any) => {
        return context.loaders.tenantLoader.load(parent.tenantId);
      },
      author: async (parent: any, args: any, context: any) => {
        return context.loaders.userLoader.load(parent.authorId);
      },
      versions: async (parent: any, args: any, context: any) => {
        return context.loaders.contentVersionsLoader.load(parent.id);
      },
    },

    ContentVersion: {
      content: async (parent: any, args: any, context: any) => {
        return context.loaders.contentLoader.load(parent.contentId);
      },
    },

    Media: {
      tenant: async (parent: any, args: any, context: any) => {
        return context.loaders.tenantLoader.load(parent.tenantId);
      },
      uploader: async (parent: any, args: any, context: any) => {
        return context.loaders.userLoader.load(parent.uploadedBy);
      },
    },
  };
};

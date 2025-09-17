import { container } from "tsyringe";
import type { CacheController } from "../../../modules/cache/cache.controller";
import type { GraphQLContext } from "../context";

/**
 * GraphQL Resolvers for Cache Module
 *
 * Handles cache operations and management through GraphQL API.
 */

export const cacheResolvers = {
  Query: {
    /**
     * Get cache statistics
     */
    cacheStats: async (
      _parent: any,
      args: { detailed?: boolean },
      context: GraphQLContext
    ) => {
      const cacheController =
        container.resolve<CacheController>("CacheController");

      // Mock request/reply for controller method
      const mockRequest = {
        query: { detailed: args.detailed?.toString() },
      } as any;
      const mockReply = {
        send: (data: any) => data,
        code: () => mockReply,
      } as any;

      return cacheController.getCacheStats(mockRequest, mockReply);
    },

    /**
     * Get cache health status
     */
    cacheHealth: async (_parent: any, _args: any, context: GraphQLContext) => {
      const cacheController =
        container.resolve<CacheController>("CacheController");

      const mockRequest = {} as any;
      const mockReply = {
        send: (data: any) => data,
        code: () => mockReply,
      } as any;

      return cacheController.getCacheHealth(mockRequest, mockReply);
    },

    /**
     * Get session data
     */
    session: async (
      _parent: any,
      args: { sessionId: string },
      context: GraphQLContext
    ) => {
      const cacheController =
        container.resolve<CacheController>("CacheController");

      const mockRequest = {
        params: { sessionId: args.sessionId },
      } as any;
      const mockReply = {
        send: (data: any) => data,
        code: () => mockReply,
      } as any;

      return cacheController.getSession(mockRequest, mockReply);
    },

    /**
     * Get cache value by key
     */
    cacheValue: async (
      _parent: any,
      args: { key: string; namespace?: string },
      context: GraphQLContext
    ) => {
      const cacheController =
        container.resolve<CacheController>("CacheController");

      const mockRequest = {
        params: { key: args.key },
        query: { namespace: args.namespace },
      } as any;
      const mockReply = {
        send: (data: any) => data,
        code: () => mockReply,
      } as any;

      return cacheController.getCache(mockRequest, mockReply);
    },
  },

  Mutation: {
    /**
     * Set cache value
     */
    setCacheValue: async (
      _parent: any,
      args: {
        input: {
          key: string;
          value: any;
          ttl?: number;
          namespace?: string;
          tags?: string[];
        };
      },
      context: GraphQLContext
    ) => {
      const cacheController =
        container.resolve<CacheController>("CacheController");

      if (!context.user?.id) {
        throw new Error("Authentication required");
      }

      const mockRequest = {
        body: args.input,
      } as any;
      const mockReply = {
        send: (data: any) => data,
        code: () => mockReply,
      } as any;

      return cacheController.setCache(mockRequest, mockReply);
    },

    /**
     * Delete cache value
     */
    deleteCacheValue: async (
      _parent: any,
      args: { key: string; namespace?: string },
      context: GraphQLContext
    ) => {
      const cacheController =
        container.resolve<CacheController>("CacheController");

      if (!context.user?.id) {
        throw new Error("Authentication required");
      }

      const mockRequest = {
        params: { key: args.key },
        query: { namespace: args.namespace },
      } as any;
      const mockReply = {
        send: (data: any) => data,
        code: () => mockReply,
      } as any;

      return cacheController.deleteCache(mockRequest, mockReply);
    },

    /**
     * Create session
     */
    createSession: async (
      _parent: any,
      args: {
        input: {
          sessionId: string;
          data: Record<string, any>;
          options?: {
            sliding: boolean;
            secure: boolean;
            ttl?: number;
          };
        };
      },
      context: GraphQLContext
    ) => {
      const cacheController =
        container.resolve<CacheController>("CacheController");

      if (!context.user?.id) {
        throw new Error("Authentication required");
      }

      const mockRequest = {
        body: args.input,
      } as any;
      const mockReply = {
        send: (data: any) => data,
        code: () => mockReply,
      } as any;

      return cacheController.createSession(mockRequest, mockReply);
    },

    /**
     * Update session
     */
    updateSession: async (
      _parent: any,
      args: {
        sessionId: string;
        input: {
          data: Record<string, any>;
          extendTtl: boolean;
        };
      },
      context: GraphQLContext
    ) => {
      const cacheController =
        container.resolve<CacheController>("CacheController");

      if (!context.user?.id) {
        throw new Error("Authentication required");
      }

      const mockRequest = {
        params: { sessionId: args.sessionId },
        body: args.input,
      } as any;
      const mockReply = {
        send: (data: any) => data,
        code: () => mockReply,
      } as any;

      return cacheController.updateSession(mockRequest, mockReply);
    },

    /**
     * Delete session
     */
    deleteSession: async (
      _parent: any,
      args: { sessionId: string },
      context: GraphQLContext
    ) => {
      const cacheController =
        container.resolve<CacheController>("CacheController");

      if (!context.user?.id) {
        throw new Error("Authentication required");
      }

      const mockRequest = {
        params: { sessionId: args.sessionId },
      } as any;
      const mockReply = {
        send: (data: any) => data,
        code: () => mockReply,
      } as any;

      return cacheController.deleteSession(mockRequest, mockReply);
    },

    /**
     * Clear cache
     */
    clearCache: async (
      _parent: any,
      args: { namespace?: string },
      context: GraphQLContext
    ) => {
      const cacheController =
        container.resolve<CacheController>("CacheController");

      if (!context.user?.permissions?.includes("cache:admin")) {
        throw new Error("Insufficient permissions");
      }

      const mockRequest = {
        body: { namespace: args.namespace },
      } as any;
      const mockReply = {
        send: (data: any) => data,
        code: () => mockReply,
      } as any;

      return cacheController.clearCache(mockRequest, mockReply);
    },
  },
};

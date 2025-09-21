import type { FastifyReply, FastifyRequest } from "fastify";
import { container } from "tsyringe";
import type {
  IAuthService,
  IContentService,
  IMediaService,
  ISearchService,
  ITenantService,
  IUserService,
} from "../../core/types/service.types";
import { type DataLoaders, createDataLoaders } from "./dataloaders";

/**
 * Simple in-memory pubsub implementation
 * In production, you'd want to use Redis or another message broker
 */
class SimplePubSub {
  private subscribers = new Map<string, Set<(data: any) => void>>();

  publish(topic: string, payload: any): void {
    const callbacks = this.subscribers.get(topic);
    if (callbacks) {
      callbacks.forEach((callback) => callback(payload));
    }
  }

  asyncIterator(topic: string): any {
    // Simple implementation - in production use proper async iterator
    return {
      [Symbol.asyncIterator]: async function* () {
        // This is a basic implementation
        // In production, you'd implement proper async iteration
        yield { topic, data: {} };
      },
    };
  }

  subscribe(topic: string, callback: (data: any) => void): () => void {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    this.subscribers.get(topic)?.add(callback);

    return () => {
      this.subscribers.get(topic)?.delete(callback);
    };
  }
}

const globalPubSub = new SimplePubSub();

/**
 * GraphQL Context Builder
 *
 * Creates the context object for GraphQL resolvers with authenticated user,
 * data sources, DataLoaders for N+1 prevention, and request/response objects.
 */
export interface GraphQLContext {
  user?: any;
  request: FastifyRequest;
  reply: FastifyReply;
  pubsub: SimplePubSub;
  dataSources: {
    authService: IAuthService;
    tenantService: ITenantService;
    contentService: IContentService;
    mediaService: IMediaService;
    searchService: ISearchService;
    userService: IUserService;
  };
  loaders: DataLoaders;
}

export const buildContext = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<GraphQLContext> => {
  // Extract user from authentication
  let user = null;
  const authHeader = request.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7);
      const authService = container.resolve<IAuthService>("AuthService");
      const result = await authService.validateToken(token);

      if (result.success) {
        user = result.data;
      }
    } catch (error) {
      // Log authentication error but don't fail the request
      request.log.warn("GraphQL authentication failed:", error as any);
    }
  }

  // Resolve services from DI container
  const dataSources = {
    authService: container.resolve<IAuthService>("AuthService"),
    tenantService: container.resolve<ITenantService>("TenantService"),
    contentService: container.resolve<IContentService>("ContentService"),
    mediaService: container.resolve<IMediaService>("MediaService"),
    searchService: container.resolve<ISearchService>("SearchService"),
    userService: container.resolve<IUserService>("UserService"),
  };

  return {
    user,
    request,
    reply,
    pubsub: globalPubSub,
    dataSources,
    loaders: createDataLoaders(),
  };
};

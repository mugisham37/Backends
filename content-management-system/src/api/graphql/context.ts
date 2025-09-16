import type { FastifyRequest, FastifyReply } from "fastify";
import { container } from "tsyringe";
import type { IAuthService } from "../../core/types/service.types";
import { createDataLoaders, type DataLoaders } from "./dataloaders";

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
  dataSources: {
    authService: IAuthService;
    tenantService: any;
    contentService: any;
    mediaService: any;
    searchService: any;
    userService: any;
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

  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7);
      const authService = container.resolve<IAuthService>("AuthService");
      const result = await authService.validateToken(token);

      if (result.success) {
        user = result.data;
      }
    } catch (error) {
      // Log authentication error but don't fail the request
      request.log.warn("GraphQL authentication failed:", error);
    }
  }

  // Resolve services from DI container
  const dataSources = {
    authService: container.resolve("AuthService"),
    tenantService: container.resolve("TenantService"),
    contentService: container.resolve("ContentService"),
    mediaService: container.resolve("MediaService"),
    searchService: container.resolve("SearchService"),
    userService: container.resolve("UserService"),
  };

  return {
    user,
    request,
    reply,
    dataSources,
    loaders: createDataLoaders(),
  };
};

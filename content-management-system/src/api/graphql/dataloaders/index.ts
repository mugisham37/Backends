import DataLoader from "dataloader";
import { container } from "tsyringe";
import type {
  IUserService,
  ITenantService,
  IContentService,
  IMediaService,
} from "../../../core/types/service.types";

/**
 * DataLoader Factory
 *
 * Creates DataLoader instances for efficient batch loading
 * and N+1 query prevention in GraphQL resolvers.
 */
export interface DataLoaders {
  userLoader: DataLoader<string, any>;
  tenantLoader: DataLoader<string, any>;
  contentLoader: DataLoader<string, any>;
  mediaLoader: DataLoader<string, any>;
  contentVersionsLoader: DataLoader<string, any[]>;
  usersByTenantLoader: DataLoader<string, any[]>;
  contentsByTenantLoader: DataLoader<string, any[]>;
  mediaByTenantLoader: DataLoader<string, any[]>;
}

export const createDataLoaders = (): DataLoaders => {
  const userService = container.resolve<IUserService>("UserService");
  const tenantService = container.resolve<ITenantService>("TenantService");
  const contentService = container.resolve<IContentService>("ContentService");
  const mediaService = container.resolve<IMediaService>("MediaService");

  return {
    // User DataLoader
    userLoader: new DataLoader(async (userIds: readonly string[]) => {
      const users = await Promise.all(
        userIds.map(async (id) => {
          const result = await userService.getUser(id);
          return result.success ? result.data : null;
        })
      );
      return users;
    }),

    // Tenant DataLoader
    tenantLoader: new DataLoader(async (tenantIds: readonly string[]) => {
      const tenants = await Promise.all(
        tenantIds.map(async (id) => {
          const result = await tenantService.getTenant(id);
          return result.success ? result.data : null;
        })
      );
      return tenants;
    }),

    // Content DataLoader
    contentLoader: new DataLoader(async (contentIds: readonly string[]) => {
      const contents = await Promise.all(
        contentIds.map(async (id) => {
          const result = await contentService.getContent(id);
          return result.success ? result.data : null;
        })
      );
      return contents;
    }),

    // Media DataLoader
    mediaLoader: new DataLoader(async (mediaIds: readonly string[]) => {
      const mediaFiles = await Promise.all(
        mediaIds.map(async (id) => {
          const result = await mediaService.getFile(id);
          return result.success ? result.data : null;
        })
      );
      return mediaFiles;
    }),

    // Content Versions DataLoader
    contentVersionsLoader: new DataLoader(
      async (contentIds: readonly string[]) => {
        const versions = await Promise.all(
          contentIds.map(async (id) => {
            const result = await contentService.getContentVersions(id);
            return result.success ? result.data : [];
          })
        );
        return versions;
      }
    ),

    // Users by Tenant DataLoader
    usersByTenantLoader: new DataLoader(
      async (tenantIds: readonly string[]) => {
        const usersByTenant = await Promise.all(
          tenantIds.map(async (tenantId) => {
            const result = await userService.getUsersByTenant(tenantId);
            return result.success ? result.data : [];
          })
        );
        return usersByTenant;
      }
    ),

    // Contents by Tenant DataLoader
    contentsByTenantLoader: new DataLoader(
      async (tenantIds: readonly string[]) => {
        const contentsByTenant = await Promise.all(
          tenantIds.map(async (tenantId) => {
            const result = await contentService.getContentsByTenant(tenantId);
            return result.success ? result.data : [];
          })
        );
        return contentsByTenant;
      }
    ),

    // Media by Tenant DataLoader
    mediaByTenantLoader: new DataLoader(
      async (tenantIds: readonly string[]) => {
        const mediaByTenant = await Promise.all(
          tenantIds.map(async (tenantId) => {
            const result = await mediaService.getMediaByTenant(tenantId);
            return result.success ? result.data : [];
          })
        );
        return mediaByTenant;
      }
    ),
  };
};

import { container } from "tsyringe";
import { UserRepository } from "./user.repository.js";
import { TenantRepository } from "./tenant.repository.js";
import { ContentRepository } from "./content.repository.js";
import { MediaRepository } from "./media.repository.js";
import { REPOSITORY_TOKENS } from "./index.js";

/**
 * Register all repositories with the dependency injection container
 */
export const registerRepositories = (): void => {
  // Register repositories as singletons
  container.registerSingleton(REPOSITORY_TOKENS.UserRepository, UserRepository);
  container.registerSingleton(
    REPOSITORY_TOKENS.TenantRepository,
    TenantRepository
  );
  container.registerSingleton(
    REPOSITORY_TOKENS.ContentRepository,
    ContentRepository
  );
  container.registerSingleton(
    REPOSITORY_TOKENS.MediaRepository,
    MediaRepository
  );
};

/**
 * Get repository instances from the container
 */
export const getRepositories = () => ({
  userRepository: container.resolve<UserRepository>(
    REPOSITORY_TOKENS.UserRepository
  ),
  tenantRepository: container.resolve<TenantRepository>(
    REPOSITORY_TOKENS.TenantRepository
  ),
  contentRepository: container.resolve<ContentRepository>(
    REPOSITORY_TOKENS.ContentRepository
  ),
  mediaRepository: container.resolve<MediaRepository>(
    REPOSITORY_TOKENS.MediaRepository
  ),
});

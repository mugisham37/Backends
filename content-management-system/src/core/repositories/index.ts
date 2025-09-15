// Base repository classes
export { BaseRepository } from "./base.repository.js";
export { TenantBaseRepository } from "./tenant-base.repository.js";
export { SoftDeleteBaseRepository } from "./soft-delete-base.repository.js";

// Specific repository implementations
export { UserRepository } from "./user.repository.js";
export { TenantRepository } from "./tenant.repository.js";
export { ContentRepository } from "./content.repository.js";
export { MediaRepository } from "./media.repository.js";

// Repository interfaces (re-exported from types)
export type {
  IRepository,
  ITenantRepository,
  ISoftDeleteRepository,
} from "../types/database.types.js";

// Repository registration for dependency injection
export const REPOSITORY_TOKENS = {
  UserRepository: "UserRepository",
  TenantRepository: "TenantRepository",
  ContentRepository: "ContentRepository",
  MediaRepository: "MediaRepository",
} as const;

// Repository registry
export {
  registerRepositories,
  getRepositories,
} from "./repository.registry.js";

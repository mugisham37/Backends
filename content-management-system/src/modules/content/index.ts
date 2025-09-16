export { ContentService } from "./content.service";
export { ContentController } from "./content.controller";

// Export types from content.types (these are the main domain types)
export type {
  Content,
  CreateContentData,
  UpdateContentData,
  ContentMetadata,
  ContentStatus,
  ContentVersion,
  ContentFilter,
  ContentSearchOptions,
} from "./content.types";

// Export schemas and schema-derived types with prefixed names to avoid conflicts
export {
  createContentSchema,
  updateContentSchema,
  contentQuerySchema,
  contentVersionQuerySchema,
  publishContentSchema,
  contentSchema,
  contentWithAuthorSchema,
  contentVersionSchema,
  contentStatsSchema,
  contentResponseSchema,
  contentListResponseSchema,
  contentVersionsResponseSchema,
  contentStatsResponseSchema,
  createContentEndpoint,
  updateContentEndpoint,
  getContentEndpoint,
  listContentEndpoint,
  publishContentEndpoint,
} from "./content.schemas";

export type {
  CreateContentRequest,
  UpdateContentRequest,
  ContentQueryParams,
  ContentVersionQuery,
  PublishContentRequest,
  ContentWithAuthor,
  ContentStats,
  ContentResponse,
  ContentListResponse,
  ContentVersionsResponse,
  ContentStatsResponse,
} from "./content.schemas";

// Note: Content and ContentVersion from schemas are not exported to avoid conflicts
// Use the domain types from content.types instead

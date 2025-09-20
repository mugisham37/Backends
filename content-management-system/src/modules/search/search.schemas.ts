import { z } from "zod";
import {
  successResponseSchema,
  uuidSchema,
} from "../../shared/validators/common.schemas";

/**
 * Zod validation schemas for search management endpoints
 */

// Search result item types
export const searchItemTypeSchema = z.enum([
  "content",
  "media",
  "user",
  "tenant",
]);

// Search filter schema
export const searchFilterSchema = z.object({
  type: z.array(searchItemTypeSchema).optional(),
  tenantId: uuidSchema.optional(),
  authorId: uuidSchema.optional(),
  status: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  mimeType: z.string().optional(),
  contentTypeId: uuidSchema.optional(),
  locale: z.string().optional(),
});

// Main search query schema
export const searchQueryRequestSchema = z.object({
  query: z
    .string()
    .min(1, "Search query is required")
    .max(500, "Search query must be less than 500 characters"),
  filters: searchFilterSchema.optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  highlight: z.boolean().default(true),
  facets: z.array(z.string()).optional(),
  boost: z.record(z.string(), z.number()).optional(),
});

// Content search specific schema
export const contentSearchSchema = z.object({
  query: z.string().default(""),
  contentTypeId: uuidSchema.optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  locale: z.string().optional(),
  fields: z.array(z.string()).optional(),
  from: z.number().int().min(0).default(0),
  size: z.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
  filters: z.record(z.any()).optional(),
});

// Media search schema
export const mediaSearchSchema = z.object({
  query: z.string().default(""),
  type: z.enum(["image", "video", "audio", "document", "other"]).optional(),
  mimeType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  from: z.number().int().min(0).default(0),
  size: z.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// User search schema
export const userSearchSchema = z.object({
  query: z.string().default(""),
  role: z.enum(["admin", "editor", "author", "viewer"]).optional(),
  isActive: z.boolean().optional(),
  tenantId: uuidSchema.optional(),
  from: z.number().int().min(0).default(0),
  size: z.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// Index document schema
export const indexDocumentSchema = z.object({
  id: uuidSchema,
  type: searchItemTypeSchema,
  title: z
    .string()
    .min(1, "Title is required")
    .max(500, "Title must be less than 500 characters"),
  content: z.string(),
  metadata: z.record(z.any()),
  tenantId: uuidSchema,
  authorId: uuidSchema.optional(),
  status: z.string().optional(),
  tags: z.array(z.string()).optional(),
  locale: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// Bulk index schema
export const bulkIndexSchema = z.object({
  documents: z
    .array(indexDocumentSchema)
    .min(1, "At least one document is required"),
  index: z.string().optional(),
});

// Delete from index schema
export const deleteFromIndexSchema = z.object({
  id: uuidSchema,
  type: searchItemTypeSchema,
});

// Bulk delete from index schema
export const bulkDeleteFromIndexSchema = z.object({
  items: z.array(deleteFromIndexSchema).min(1, "At least one item is required"),
});

// Reindex schema
export const reindexSchema = z.object({
  type: searchItemTypeSchema.optional(),
  tenantId: uuidSchema.optional(),
  batchSize: z.number().int().min(1).max(1000).default(100),
  force: z.boolean().default(false),
});

// Search configuration schema
export const searchConfigSchema = z.object({
  indexName: z.string().min(1, "Index name is required"),
  batchSize: z.number().int().min(1).max(1000).default(100),
  maxResults: z.number().int().min(1).max(10000).default(1000),
  highlightFields: z.array(z.string()).default(["title", "content"]),
  facetFields: z.array(z.string()).default(["type", "status", "tags"]),
  boostFields: z.record(z.string(), z.number()).default({
    title: 2.0,
    content: 1.0,
  }),
  analyzer: z.string().default("standard"),
  maxClauseCount: z.number().int().min(1).default(1024),
});

// Search aggregation schema
export const searchAggregationSchema = z.object({
  field: z.string(),
  type: z.enum(["terms", "range", "date_histogram"]),
  size: z.number().int().min(1).max(100).default(10),
  ranges: z
    .array(
      z.object({
        from: z.number().optional(),
        to: z.number().optional(),
        key: z.string().optional(),
      })
    )
    .optional(),
  interval: z.string().optional(),
});

// Response schemas
export const searchResultItemSchema = z.object({
  id: uuidSchema,
  type: searchItemTypeSchema,
  title: z.string(),
  content: z.string(),
  excerpt: z.string().optional(),
  url: z.string().optional(),
  metadata: z.record(z.any()),
  score: z.number(),
  highlights: z.record(z.array(z.string())).optional(),
});

export const searchResultSchema = z.object({
  items: z.array(searchResultItemSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  hasMore: z.boolean(),
  took: z.number(), // Search time in milliseconds
  facets: z.record(z.any()).optional(),
  suggestions: z.array(z.string()).optional(),
});

export const searchStatsSchema = z.object({
  totalDocuments: z.number(),
  indexSize: z.number(),
  lastIndexed: z.string().datetime(),
  searchesPerDay: z.number(),
  topQueries: z.array(
    z.object({
      query: z.string(),
      count: z.number(),
    })
  ),
  averageResponseTime: z.number(),
  indexHealth: z.enum(["green", "yellow", "red"]),
});

export const indexStatusSchema = z.object({
  name: z.string(),
  health: z.enum(["green", "yellow", "red"]),
  status: z.enum(["open", "close"]),
  documentCount: z.number(),
  storeSizeBytes: z.number(),
  lastIndexedAt: z.string().datetime().nullable(),
});

export const searchSuggestionSchema = z.object({
  query: z.string(),
  type: z.enum(["completion", "phrase", "term"]).default("completion"),
  size: z.number().int().min(1).max(20).default(5),
  field: z.string().optional(),
});

export const suggestionResultSchema = z.object({
  text: z.string(),
  score: z.number(),
  highlighted: z.string().optional(),
});

// Search analytics schema
export const searchAnalyticsSchema = z.object({
  query: z.string(),
  resultsCount: z.number(),
  clickedResults: z.array(z.string()),
  timestamp: z.string().datetime(),
  userId: uuidSchema.optional(),
  sessionId: z.string().optional(),
  userAgent: z.string().optional(),
});

// Response schemas
export const searchResultResponseSchema =
  successResponseSchema(searchResultSchema);
export const searchStatsResponseSchema =
  successResponseSchema(searchStatsSchema);
export const indexStatusResponseSchema = successResponseSchema(
  z.array(indexStatusSchema)
);
export const suggestionResultResponseSchema = successResponseSchema(
  z.array(suggestionResultSchema)
);
export const searchConfigResponseSchema =
  successResponseSchema(searchConfigSchema);
export const indexOperationResponseSchema = successResponseSchema(
  z.object({
    success: z.boolean(),
    indexed: z.number(),
    failed: z.number(),
    took: z.number(),
  })
);

// Endpoint schemas
export const searchEndpoint = {
  body: z.void(),
  query: searchQueryRequestSchema,
  params: z.void(),
  headers: z.void(),
};

export const searchContentEndpoint = {
  body: z.void(),
  query: contentSearchSchema,
  params: z.void(),
  headers: z.void(),
};

export const searchMediaEndpoint = {
  body: z.void(),
  query: mediaSearchSchema,
  params: z.void(),
  headers: z.void(),
};

export const searchUsersEndpoint = {
  body: z.void(),
  query: userSearchSchema,
  params: z.void(),
  headers: z.void(),
};

export const indexDocumentEndpoint = {
  body: indexDocumentSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const bulkIndexEndpoint = {
  body: bulkIndexSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const deleteFromIndexEndpoint = {
  body: deleteFromIndexSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const bulkDeleteFromIndexEndpoint = {
  body: bulkDeleteFromIndexSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const reindexEndpoint = {
  body: reindexSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const getSearchStatsEndpoint = {
  body: z.void(),
  query: z.object({
    period: z.enum(["day", "week", "month"]).default("day"),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
  params: z.void(),
  headers: z.void(),
};

export const getSuggestionsEndpoint = {
  body: z.void(),
  query: searchSuggestionSchema,
  params: z.void(),
  headers: z.void(),
};

export const updateSearchConfigEndpoint = {
  body: searchConfigSchema.partial(),
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const trackSearchAnalyticsEndpoint = {
  body: searchAnalyticsSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

// Type exports
export type SearchItemType = z.infer<typeof searchItemTypeSchema>;
export type SearchFilter = z.infer<typeof searchFilterSchema>;
export type SearchQueryRequest = z.infer<typeof searchQueryRequestSchema>;
export type ContentSearchRequest = z.infer<typeof contentSearchSchema>;
export type MediaSearchRequest = z.infer<typeof mediaSearchSchema>;
export type UserSearchRequest = z.infer<typeof userSearchSchema>;
export type IndexDocument = z.infer<typeof indexDocumentSchema>;
export type BulkIndexRequest = z.infer<typeof bulkIndexSchema>;
export type DeleteFromIndexRequest = z.infer<typeof deleteFromIndexSchema>;
export type BulkDeleteFromIndexRequest = z.infer<
  typeof bulkDeleteFromIndexSchema
>;
export type ReindexRequest = z.infer<typeof reindexSchema>;
export type SearchConfig = z.infer<typeof searchConfigSchema>;
export type SearchAggregation = z.infer<typeof searchAggregationSchema>;
export type SearchResultItem = z.infer<typeof searchResultItemSchema>;
export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchStats = z.infer<typeof searchStatsSchema>;
export type IndexStatus = z.infer<typeof indexStatusSchema>;
export type SearchSuggestion = z.infer<typeof searchSuggestionSchema>;
export type SuggestionResult = z.infer<typeof suggestionResultSchema>;
export type SearchAnalytics = z.infer<typeof searchAnalyticsSchema>;
export type SearchResultResponse = z.infer<typeof searchResultResponseSchema>;
export type SearchStatsResponse = z.infer<typeof searchStatsResponseSchema>;
export type IndexStatusResponse = z.infer<typeof indexStatusResponseSchema>;
export type SuggestionResultResponse = z.infer<
  typeof suggestionResultResponseSchema
>;
export type SearchConfigResponse = z.infer<typeof searchConfigResponseSchema>;

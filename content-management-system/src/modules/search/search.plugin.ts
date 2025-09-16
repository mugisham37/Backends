import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { SearchController } from "./search.controller";

// Define route types
interface SearchContentQuery {
  q?: string;
  type?: string;
  status?: string;
  page?: string;
  limit?: string;
  tenantId?: string;
  authorId?: string;
  tags?: string[];
  categories?: string[];
  dateFrom?: string;
  dateTo?: string;
}

interface SearchMediaQuery {
  q?: string;
  type?: string;
  mimeType?: string;
  page?: string;
  limit?: string;
  tenantId?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
}

interface SuggestionsQuery {
  q: string;
  tenantId?: string;
  limit?: string;
}

interface ReindexParams {
  tenantId: string;
}

interface AnalyticsQuery {
  tenantId?: string;
}

/**
 * Search plugin for Fastify
 * Registers all search-related routes
 */
export const searchPlugin: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  const searchController = new SearchController();

  // Search routes
  fastify.route<{ Querystring: SearchContentQuery }>({
    method: "GET",
    url: "/search",
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: "object",
        properties: {
          q: { type: "string", minLength: 1 },
          type: { type: "string", enum: ["content", "media", "all"] },
          status: { type: "string" },
          page: { type: "string", pattern: "^[1-9]\\d*$" },
          limit: { type: "string", pattern: "^[1-9]\\d*$" },
          tenantId: { type: "string", format: "uuid" },
          authorId: { type: "string", format: "uuid" },
          tags: {
            oneOf: [
              { type: "string" },
              { type: "array", items: { type: "string" } },
            ],
          },
          categories: {
            oneOf: [
              { type: "string" },
              { type: "array", items: { type: "string" } },
            ],
          },
          dateFrom: { type: "string", format: "date-time" },
          dateTo: { type: "string", format: "date-time" },
        },
        required: ["q"],
      },
    },
    handler: searchController.searchContent,
  });

  // Media search
  fastify.route<{ Querystring: SearchMediaQuery }>({
    method: "GET",
    url: "/search/media",
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: "object",
        properties: {
          q: { type: "string" },
          type: { type: "string" },
          mimeType: { type: "string" },
          page: { type: "string", pattern: "^[1-9]\\d*$" },
          limit: { type: "string", pattern: "^[1-9]\\d*$" },
          tenantId: { type: "string", format: "uuid" },
          tags: {
            oneOf: [
              { type: "string" },
              { type: "array", items: { type: "string" } },
            ],
          },
          dateFrom: { type: "string", format: "date-time" },
          dateTo: { type: "string", format: "date-time" },
        },
      },
    },
    handler: searchController.searchMedia,
  });

  // Search suggestions
  fastify.route<{ Querystring: SuggestionsQuery }>({
    method: "GET",
    url: "/search/suggestions",
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: "object",
        properties: {
          q: { type: "string", minLength: 1 },
          tenantId: { type: "string", format: "uuid" },
          limit: { type: "string", pattern: "^[1-9]\\d*$" },
        },
        required: ["q"],
      },
    },
    handler: searchController.getSuggestions,
  });

  // Reindex tenant
  fastify.route<{ Params: ReindexParams }>({
    method: "POST",
    url: "/search/reindex/:tenantId",
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: "object",
        properties: {
          tenantId: { type: "string", format: "uuid" },
        },
        required: ["tenantId"],
      },
    },
    handler: searchController.reindexTenant,
  });

  // Search analytics
  fastify.route<{ Querystring: AnalyticsQuery }>({
    method: "GET",
    url: "/search/analytics",
    preHandler: [fastify.authenticate],
    schema: {
      querystring: {
        type: "object",
        properties: {
          tenantId: { type: "string", format: "uuid" },
        },
      },
    },
    handler: searchController.getAnalytics,
  });
};

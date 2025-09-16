import type { FastifyRequest, FastifyReply } from "fastify";
import { container } from "tsyringe";
import type { SearchService } from "./search.service";

export class SearchController {
  private searchService: SearchService;

  constructor() {
    this.searchService = container.resolve<SearchService>("SearchService");
  }

  /**
   * Search content
   */
  public searchContent = async (
    request: FastifyRequest<{
      Querystring: {
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
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const {
        q = "",
        type = "content",
        status,
        page = "1",
        limit = "20",
        tenantId,
        authorId,
        tags,
        categories,
        dateFrom,
        dateTo,
      } = request.query;

      const filters: any = {};
      if (status) filters.status = status;
      if (authorId) filters.authorId = authorId;
      if (tags) filters.tags = Array.isArray(tags) ? tags : [tags];
      if (categories)
        filters.categories = Array.isArray(categories)
          ? categories
          : [categories];
      if (dateFrom && dateTo) {
        filters.dateRange = {
          start: new Date(dateFrom),
          end: new Date(dateTo),
        };
      }

      const searchOptions = {
        ...(tenantId ? { tenantId } : {}),
        type: type as "content" | "media" | "all",
        ...(Object.keys(filters).length > 0 ? { filters } : {}),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
        },
        highlight: true,
      };

      const result = await this.searchService.performSearch(q, searchOptions);

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error.message,
        });
      }

      return reply.status(200).send({
        success: true,
        data: {
          items: result.data.results.map((r) => r.document),
          total: result.data.total,
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: result.data.pagination
            ? result.data.pagination.hasNext
            : false,
          searchTime: result.data.searchTime,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: "Search failed",
      });
    }
  };

  /**
   * Search media
   */
  public searchMedia = async (
    request: FastifyRequest<{
      Querystring: {
        q?: string;
        type?: string;
        mimeType?: string;
        page?: string;
        limit?: string;
        tenantId?: string;
        tags?: string[];
        dateFrom?: string;
        dateTo?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const {
        q = "",
        type,
        page = "1",
        limit = "20",
        tenantId,
        tags,
        dateFrom,
        dateTo,
      } = request.query;

      const filters: any = {};
      if (type) filters.mediaType = type;
      if (tags) filters.tags = Array.isArray(tags) ? tags : [tags];
      if (dateFrom && dateTo) {
        filters.dateRange = {
          start: new Date(dateFrom),
          end: new Date(dateTo),
        };
      }

      const searchOptions = {
        ...(tenantId ? { tenantId } : {}),
        type: "media" as const,
        ...(Object.keys(filters).length > 0 ? { filters } : {}),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
        },
        highlight: true,
      };

      const result = await this.searchService.performSearch(q, searchOptions);

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error.message,
        });
      }

      return reply.status(200).send({
        success: true,
        data: {
          items: result.data.results.map((r) => r.document),
          total: result.data.total,
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: result.data.pagination
            ? result.data.pagination.hasNext
            : false,
          searchTime: result.data.searchTime,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: "Media search failed",
      });
    }
  };

  /**
   * Get search suggestions
   */
  public getSuggestions = async (
    request: FastifyRequest<{
      Querystring: {
        q: string;
        tenantId?: string;
        limit?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { q, tenantId, limit = "5" } = request.query;

      const result = await this.searchService.getSuggestions(
        q,
        tenantId,
        parseInt(limit)
      );

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error.message,
        });
      }

      return reply.status(200).send({
        success: true,
        data: result.data,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: "Failed to get suggestions",
      });
    }
  };

  /**
   * Reindex tenant data
   */
  public reindexTenant = async (
    request: FastifyRequest<{
      Params: { tenantId: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { tenantId } = request.params;

      const result = await this.searchService.reindexTenant(tenantId);

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error.message,
        });
      }

      return reply.status(200).send({
        success: true,
        message: `Reindexing started for tenant: ${tenantId}`,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: "Failed to start reindexing",
      });
    }
  };

  /**
   * Get search analytics
   */
  public getAnalytics = async (
    request: FastifyRequest<{
      Querystring: {
        tenantId?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { tenantId } = request.query;

      const result = await this.searchService.getSearchAnalytics(tenantId);

      if (!result.success) {
        return reply.status(500).send({
          success: false,
          error: result.error.message,
        });
      }

      return reply.status(200).send({
        success: true,
        data: result.data,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: "Failed to get analytics",
      });
    }
  };
}

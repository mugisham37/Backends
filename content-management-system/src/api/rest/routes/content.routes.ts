import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { container } from "tsyringe";
import type { IContentService } from "../../../modules/content/content.types";
import { validate } from "../../../shared/middleware/zod-validation";
import {
  type ContentParams,
  type ContentQueryParams,
  type ContentVersionQuery,
  type CreateContentRequest,
  type UpdateContentRequest,
  contentParamsSchema,
  contentQuerySchema,
  contentVersionQuerySchema,
  createContentSchema,
  updateContentSchema,
} from "../../../modules/content/content.schemas";

/**
 * Content Management REST Routes
 *
 * Handles content CRUD operations, versioning, and publishing.
 */
export const contentRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  const contentService = container.resolve<IContentService>("ContentService");

  // Get all content with pagination and filters
  fastify.get(
    "/",
    {
      preHandler: [
        fastify.authenticate,
        validate({ querystring: contentQuerySchema }),
      ],
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  items: { type: "array" },
                  total: { type: "number" },
                  page: { type: "number" },
                  limit: { type: "number" },
                  hasMore: { type: "boolean" },
                },
              },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { page, limit, status, authorId, search, tags, sortBy, sortOrder } =
        request.query as ContentQueryParams;
      const user = request.user as any;

      const result = await contentService.getContentsByTenant(user.tenantId, {
        page,
        limit,
        status,
        authorId,
        search,
        tags: tags ? tags.split(",") : undefined,
        sortBy,
        sortOrder,
      });

      if (!result.success) {
        return reply.status(500).send({
          error: "Content Retrieval Failed",
          message: result.error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Get specific content by ID
  fastify.get(
    "/:id",
    {
      preHandler: [
        fastify.authenticate,
        validate({
          params: contentParamsSchema,
          querystring: contentVersionQuerySchema,
        }),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as ContentParams;
      const { version } = request.query as ContentVersionQuery;

      const result = await contentService.getContent(id, version?.toString());

      if (!result.success) {
        const statusCode = result.error.code === "NOT_FOUND" ? 404 : 500;
        return reply.status(statusCode).send({
          error: "Content Not Found",
          message: result.error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Create new content
  fastify.post(
    "/",
    {
      preHandler: [
        fastify.authenticate,
        validate({ body: createContentSchema }),
      ],
    },
    async (request, reply) => {
      const contentData = request.body as CreateContentRequest;
      const user = request.user as any;

      const createData = {
        ...contentData,
        authorId: user.id,
        tenantId: user.tenantId,
      };

      const result = await contentService.createContent(createData);

      if (!result.success) {
        return reply.status(400).send({
          error: "Content Creation Failed",
          message: result.error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(201).send({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Update content
  fastify.put(
    "/:id",
    {
      preHandler: [
        fastify.authenticate,
        validate({
          params: contentParamsSchema,
          body: updateContentSchema,
        }),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as ContentParams;
      const updateData = request.body as UpdateContentRequest;

      const result = await contentService.updateContent(id, updateData);

      if (!result.success) {
        const statusCode = result.error.code === "NOT_FOUND" ? 404 : 400;
        return reply.status(statusCode).send({
          error: "Content Update Failed",
          message: result.error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Delete content
  fastify.delete(
    "/:id",
    {
      preHandler: [
        fastify.authenticate,
        validate({ params: contentParamsSchema }),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as ContentParams;

      const result = await contentService.deleteContent(id);

      if (!result.success) {
        const statusCode = result.error.code === "NOT_FOUND" ? 404 : 500;
        return reply.status(statusCode).send({
          error: "Content Deletion Failed",
          message: result.error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        success: true,
        message: "Content deleted successfully",
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Publish content
  fastify.post(
    "/:id/publish",
    {
      preHandler: [
        fastify.authenticate,
        validate({ params: contentParamsSchema }),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as ContentParams;

      const result = await contentService.publishContent(id);

      if (!result.success) {
        const statusCode = result.error.code === "NOT_FOUND" ? 404 : 400;
        return reply.status(statusCode).send({
          error: "Content Publishing Failed",
          message: result.error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Get content versions
  fastify.get(
    "/:id/versions",
    {
      preHandler: [
        fastify.authenticate,
        validate({ params: contentParamsSchema }),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as ContentParams;

      const result = await contentService.getContentVersions(id);

      if (!result.success) {
        return reply.status(500).send({
          error: "Version Retrieval Failed",
          message: result.error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        success: true,
        data: result.data,
        timestamp: new Date().toISOString(),
      });
    }
  );
};

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { container } from "tsyringe";
import type { IContentService } from "../../../core/types/service.types";

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
      preHandler: [fastify.authenticate],
      schema: {
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
            status: {
              type: "string",
              enum: ["draft", "published", "archived"],
            },
            authorId: { type: "string" },
          },
        },
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
      const { page, limit, status, authorId } = request.query as any;
      const user = request.user as any;

      const result = await contentService.getContentsByTenant(user.tenantId, {
        page,
        limit,
        status,
        authorId,
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
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            version: { type: "integer", minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { version } = request.query as { version?: number };

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
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["title", "slug"],
          properties: {
            title: { type: "string", minLength: 1, maxLength: 255 },
            slug: { type: "string", minLength: 1, maxLength: 255 },
            body: { type: "string" },
            status: {
              type: "string",
              enum: ["draft", "published"],
              default: "draft",
            },
          },
        },
      },
    },
    async (request, reply) => {
      const contentData = request.body as any;
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
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            title: { type: "string", minLength: 1, maxLength: 255 },
            slug: { type: "string", minLength: 1, maxLength: 255 },
            body: { type: "string" },
            status: {
              type: "string",
              enum: ["draft", "published", "archived"],
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const updateData = request.body as any;

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
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

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
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

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
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

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

import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { container } from "tsyringe";
import {
  type CdnOptions,
  type ImageTransform,
  type MediaParams,
  type MediaQueryParams,
  cdnOptionsSchema,
  imageTransformSchema,
  mediaParamsSchema,
  mediaQuerySchema,
} from "../../../modules/media/media.schemas";
import type { IMediaService } from "../../../modules/media/media.types";
import { validate } from "../../../shared/middleware/zod-validation";

/**
 * Media Management REST Routes
 *
 * Handles file uploads, processing, and CDN integration.
 */
export const mediaRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  const mediaService = container.resolve<IMediaService>("MediaService");

  // Get all media with pagination and filters
  fastify.get(
    "/",
    {
      preHandler: [
        fastify.authenticate,
        validate({ querystring: mediaQuerySchema }),
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
      const { page, limit, type, search, tags, sortBy, sortOrder } =
        request.query as MediaQueryParams;
      const user = request.user as any;

      const result = await mediaService.getMediaByTenant(user.tenantId, {
        page,
        limit,
        type,
        search,
        tags: tags ? tags.split(",") : undefined,
        sortBy,
        sortOrder,
      });

      if (!result.success) {
        return reply.status(500).send({
          error: "Media Retrieval Failed",
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

  // Upload media file
  fastify.post(
    "/upload",
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  filename: { type: "string" },
                  url: { type: "string" },
                  size: { type: "number" },
                  mimetype: { type: "string" },
                },
              },
              timestamp: { type: "string" },
            },
          },
          400: { $ref: "error" },
        },
      },
    },
    async (request, reply) => {
      try {
        const data = await request.file();

        if (!data) {
          return reply.status(400).send({
            error: "File Upload Failed",
            message: "No file provided",
            timestamp: new Date().toISOString(),
          });
        }

        const user = request.user as any;
        const buffer = await data.toBuffer();

        const getFieldValue = (field: any) => {
          if (Array.isArray(field)) {
            return field[0]?.value;
          }
          return field?.value;
        };

        const metadata = {
          filename: data.filename,
          mimetype: data.mimetype,
          size: buffer.length,
          alt: getFieldValue(data.fields?.alt),
          caption: getFieldValue(data.fields?.caption),
          tags: data.fields?.tags
            ? JSON.parse(getFieldValue(data.fields.tags) || "[]")
            : undefined,
          metadata: data.fields?.metadata
            ? JSON.parse(getFieldValue(data.fields.metadata) || "{}")
            : undefined,
        };

        const result = await mediaService.uploadFile(
          {
            buffer,
            filename: data.filename,
            mimetype: data.mimetype,
          },
          {
            ...metadata,
            tenantId: user.tenantId,
            uploadedBy: user.id,
          }
        );

        if (!result.success) {
          return reply.status(400).send({
            error: "File Upload Failed",
            message: result.error.message,
            timestamp: new Date().toISOString(),
          });
        }

        return reply.status(201).send({
          success: true,
          data: result.data,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        return reply.status(500).send({
          error: "Upload Processing Failed",
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // Get specific media file
  fastify.get(
    "/:id",
    {
      preHandler: [
        fastify.authenticate,
        validate({ params: mediaParamsSchema }),
      ],
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
              timestamp: { type: "string" },
            },
          },
          404: { $ref: "error" },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as MediaParams;
      const user = request.user as any;

      // Get all media for the tenant and find the specific one
      const mediaResult = await (mediaService as any).getMediaByTenant(
        user.tenantId,
        {}
      );

      if (!mediaResult.success) {
        return reply.status(500).send({
          error: "Media Retrieval Failed",
          message: mediaResult.error.message,
          timestamp: new Date().toISOString(),
        });
      }

      // Find the specific media item
      const media = mediaResult.data.items.find((item: any) => item.id === id);

      if (!media) {
        return reply.status(404).send({
          error: "Media Not Found",
          message: "Media file not found",
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        success: true,
        data: media,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Delete media file
  fastify.delete(
    "/:id",
    {
      preHandler: [
        fastify.authenticate,
        validate({ params: mediaParamsSchema }),
      ],
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              timestamp: { type: "string" },
            },
          },
          404: { $ref: "error" },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as MediaParams;
      const user = request.user as any;

      // Use the original MediaService through the adapter
      const result = await (mediaService as any).mediaService.deleteMedia(
        id,
        user.tenantId,
        user.id
      );

      if (!result.success) {
        const statusCode = result.error.code === "NOT_FOUND" ? 404 : 500;
        return reply.status(statusCode).send({
          error: "Media Deletion Failed",
          message: result.error.message,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.status(200).send({
        success: true,
        message: "Media file deleted successfully",
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Process image transformations
  fastify.post(
    "/:id/transform",
    {
      preHandler: [
        fastify.authenticate,
        validate({
          params: mediaParamsSchema,
          body: imageTransformSchema,
        }),
      ],
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
              timestamp: { type: "string" },
            },
          },
          400: { $ref: "error" },
          404: { $ref: "error" },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as MediaParams;
      const transformations = request.body as ImageTransform;

      const result = await mediaService.processImage(id, [transformations]);

      if (!result.success) {
        const statusCode =
          (result.error as any)?.code === "NOT_FOUND" ? 404 : 400;
        return reply.status(statusCode).send({
          error: "Image Processing Failed",
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

  // Generate CDN URL
  fastify.post(
    "/:id/cdn-url",
    {
      preHandler: [
        fastify.authenticate,
        validate({
          params: mediaParamsSchema,
          body: cdnOptionsSchema,
        }),
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
                  url: { type: "string" },
                  expires: { type: "string" },
                },
              },
              timestamp: { type: "string" },
            },
          },
          404: { $ref: "error" },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as MediaParams;
      const options = request.body as CdnOptions;

      const result = await mediaService.generateCdnUrl(id, options);

      if (!result.success) {
        const statusCode =
          (result.error as any)?.code === "NOT_FOUND" ? 404 : 500;
        return reply.status(statusCode).send({
          error: "CDN URL Generation Failed",
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

  // Get media metadata
  fastify.get(
    "/:id/metadata",
    {
      preHandler: [
        fastify.authenticate,
        validate({ params: mediaParamsSchema }),
      ],
    },
    async (request, reply) => {
      const { id } = request.params as MediaParams;
      const user = request.user as any;

      // Get all media for the tenant and find the specific one
      const mediaResult = await (mediaService as any).getMediaByTenant(
        user.tenantId,
        {}
      );

      if (!mediaResult.success) {
        return reply.status(500).send({
          error: "Media Retrieval Failed",
          message: mediaResult.error.message,
          timestamp: new Date().toISOString(),
        });
      }

      // Find the specific media item
      const media = mediaResult.data.items.find((item: any) => item.id === id);

      if (!media) {
        return reply.status(404).send({
          error: "Media Not Found",
          message: "Media file not found",
          timestamp: new Date().toISOString(),
        });
      }

      // Return only metadata without file content
      const { url, cdnUrl, ...metadata } = media;

      return reply.status(200).send({
        success: true,
        data: metadata,
        timestamp: new Date().toISOString(),
      });
    }
  );
};

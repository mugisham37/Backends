import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { MultipartFile } from "@fastify/multipart";
import { z } from "zod";
import { UploadService } from "./upload.service.js";
import { StorageService } from "./storage.service.js";
import { AppError } from "../../core/errors/app-error.js";

// Validation schemas
const uploadQuerySchema = z.object({
  folder: z.string().optional(),
  optimize: z.boolean().optional(),
});

const multipleUploadQuerySchema = uploadQuerySchema.extend({
  maxFiles: z.number().min(1).max(20).optional(),
});

const deleteParamsSchema = z.object({
  fileId: z.string().min(1),
});

const getUrlParamsSchema = z.object({
  fileId: z.string().min(1),
});

const getUrlQuerySchema = z.object({
  folder: z.string().optional(),
  expiresIn: z.number().min(60).max(86400).optional(), // 1 minute to 24 hours
});

export interface MediaControllerDependencies {
  uploadService: UploadService;
  storageService: StorageService;
}

export class MediaController {
  constructor(private deps: MediaControllerDependencies) {}

  async register(fastify: FastifyInstance) {
    // Register multipart support
    await fastify.register(import("@fastify/multipart"), {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
        files: 20, // Max 20 files per request
      },
    });

    // Upload single file
    fastify.post(
      "/upload",
      {
        schema: {
          description: "Upload a single file",
          tags: ["Media"],
          querystring: uploadQuerySchema,
          response: {
            200: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                data: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    filename: { type: "string" },
                    originalName: { type: "string" },
                    mimeType: { type: "string" },
                    size: { type: "number" },
                    url: { type: "string" },
                    metadata: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
      this.uploadSingle.bind(this)
    );

    // Upload multiple files
    fastify.post(
      "/upload/multiple",
      {
        schema: {
          description: "Upload multiple files",
          tags: ["Media"],
          querystring: multipleUploadQuerySchema,
          response: {
            200: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                data: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      filename: { type: "string" },
                      originalName: { type: "string" },
                      mimeType: { type: "string" },
                      size: { type: "number" },
                      url: { type: "string" },
                      metadata: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      this.uploadMultiple.bind(this)
    );

    // Delete file
    fastify.delete(
      "/files/:fileId",
      {
        schema: {
          description: "Delete a file",
          tags: ["Media"],
          params: deleteParamsSchema,
          querystring: z.object({
            folder: z.string().optional(),
          }),
          response: {
            200: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                message: { type: "string" },
              },
            },
          },
        },
      },
      this.deleteFile.bind(this)
    );

    // Get file URL (signed URL for private files)
    fastify.get(
      "/files/:fileId/url",
      {
        schema: {
          description: "Get a signed URL for a file",
          tags: ["Media"],
          params: getUrlParamsSchema,
          querystring: getUrlQuerySchema,
          response: {
            200: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                data: {
                  type: "object",
                  properties: {
                    url: { type: "string" },
                    expiresAt: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      this.getFileUrl.bind(this)
    );

    // Upload avatar (specific endpoint with stricter validation)
    fastify.post(
      "/upload/avatar",
      {
        schema: {
          description: "Upload user avatar",
          tags: ["Media"],
          response: {
            200: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                data: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    url: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      this.uploadAvatar.bind(this)
    );

    // Upload product images
    fastify.post(
      "/upload/product-images",
      {
        schema: {
          description: "Upload product images",
          tags: ["Media"],
          querystring: z.object({
            productId: z.string().optional(),
          }),
          response: {
            200: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                data: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      url: { type: "string" },
                      metadata: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      this.uploadProductImages.bind(this)
    );
  }

  private async uploadSingle(
    request: FastifyRequest<{ Querystring: z.infer<typeof uploadQuerySchema> }>,
    reply: FastifyReply
  ) {
    try {
      const file = await request.file();

      if (!file) {
        throw new AppError("No file provided", 400, "NO_FILE");
      }

      const result = await this.deps.uploadService.uploadSingle(file, {
        folder: request.query.folder,
      });

      return reply.code(200).send({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        });
      }

      return reply.code(500).send({
        success: false,
        error: {
          message: "Internal server error",
          code: "INTERNAL_ERROR",
        },
      });
    }
  }

  private async uploadMultiple(
    request: FastifyRequest<{
      Querystring: z.infer<typeof multipleUploadQuerySchema>;
    }>,
    reply: FastifyReply
  ) {
    try {
      const files = request.files();
      const fileArray: MultipartFile[] = [];

      for await (const file of files) {
        fileArray.push(file);
      }

      if (fileArray.length === 0) {
        throw new AppError("No files provided", 400, "NO_FILES");
      }

      const results = await this.deps.uploadService.uploadMultiple(fileArray, {
        folder: request.query.folder,
        maxFiles: request.query.maxFiles,
      });

      return reply.code(200).send({
        success: true,
        data: results,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        });
      }

      return reply.code(500).send({
        success: false,
        error: {
          message: "Internal server error",
          code: "INTERNAL_ERROR",
        },
      });
    }
  }

  private async deleteFile(
    request: FastifyRequest<{
      Params: z.infer<typeof deleteParamsSchema>;
      Querystring: { folder?: string };
    }>,
    reply: FastifyReply
  ) {
    try {
      await this.deps.uploadService.deleteFile(
        request.params.fileId,
        request.query.folder
      );

      return reply.code(200).send({
        success: true,
        message: "File deleted successfully",
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        });
      }

      return reply.code(500).send({
        success: false,
        error: {
          message: "Internal server error",
          code: "INTERNAL_ERROR",
        },
      });
    }
  }

  private async getFileUrl(
    request: FastifyRequest<{
      Params: z.infer<typeof getUrlParamsSchema>;
      Querystring: z.infer<typeof getUrlQuerySchema>;
    }>,
    reply: FastifyReply
  ) {
    try {
      const url = await this.deps.uploadService.getFileUrl(
        request.params.fileId,
        request.query.folder,
        request.query.expiresIn
      );

      const expiresAt = request.query.expiresIn
        ? new Date(Date.now() + request.query.expiresIn * 1000).toISOString()
        : null;

      return reply.code(200).send({
        success: true,
        data: {
          url,
          expiresAt,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        });
      }

      return reply.code(500).send({
        success: false,
        error: {
          message: "Internal server error",
          code: "INTERNAL_ERROR",
        },
      });
    }
  }

  private async uploadAvatar(request: FastifyRequest, reply: FastifyReply) {
    try {
      const file = await request.file();

      if (!file) {
        throw new AppError("No file provided", 400, "NO_FILE");
      }

      // Validate that it's an image
      if (!file.mimetype.startsWith("image/")) {
        throw new AppError(
          "Only image files are allowed for avatars",
          400,
          "INVALID_FILE_TYPE"
        );
      }

      // Create avatar-specific upload service with stricter config
      const avatarUploadService = new UploadService(this.deps.storageService, {
        maxFileSize: 5 * 1024 * 1024, // 5MB max for avatars
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
        imageOptimization: {
          quality: 90,
          maxWidth: 512,
          maxHeight: 512,
          formats: ["webp"],
        },
      });

      const result = await avatarUploadService.uploadSingle(file, {
        folder: "avatars",
      });

      return reply.code(200).send({
        success: true,
        data: {
          id: result.id,
          url: result.url,
        },
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        });
      }

      return reply.code(500).send({
        success: false,
        error: {
          message: "Internal server error",
          code: "INTERNAL_ERROR",
        },
      });
    }
  }

  private async uploadProductImages(
    request: FastifyRequest<{ Querystring: { productId?: string } }>,
    reply: FastifyReply
  ) {
    try {
      const files = request.files();
      const fileArray: MultipartFile[] = [];

      for await (const file of files) {
        // Validate that all files are images
        if (!file.mimetype.startsWith("image/")) {
          throw new AppError(
            `File ${file.filename} is not an image`,
            400,
            "INVALID_FILE_TYPE"
          );
        }
        fileArray.push(file);
      }

      if (fileArray.length === 0) {
        throw new AppError("No image files provided", 400, "NO_FILES");
      }

      // Create product-specific upload service
      const productUploadService = new UploadService(this.deps.storageService, {
        maxFileSize: 10 * 1024 * 1024, // 10MB max for product images
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
        imageOptimization: {
          quality: 85,
          maxWidth: 2048,
          maxHeight: 2048,
          formats: ["webp", "jpeg"],
        },
      });

      const folder = request.query.productId
        ? `products/${request.query.productId}`
        : "products";

      const results = await productUploadService.uploadMultiple(fileArray, {
        folder,
        maxFiles: 10, // Max 10 images per product
      });

      return reply.code(200).send({
        success: true,
        data: results.map((result) => ({
          id: result.id,
          url: result.url,
          metadata: result.metadata,
        })),
      });
    } catch (error) {
      if (error instanceof AppError) {
        return reply.code(error.statusCode).send({
          success: false,
          error: {
            message: error.message,
            code: error.code,
          },
        });
      }

      return reply.code(500).send({
        success: false,
        error: {
          message: "Internal server error",
          code: "INTERNAL_ERROR",
        },
      });
    }
  }
}

import { z } from "zod";
import {
  uuidSchema,
  paginationQuerySchema,
  searchQuerySchema,
  idParamsSchema,
  fileUploadSchema,
  successResponseSchema,
  paginatedResponseSchema,
} from "./common.schemas.js";

/**
 * Zod validation schemas for media management endpoints
 */

export const uploadMediaSchema = fileUploadSchema.extend({
  alt: z
    .string()
    .max(255, "Alt text must be less than 255 characters")
    .optional(),
  caption: z
    .string()
    .max(500, "Caption must be less than 500 characters")
    .optional(),
  tags: z.array(z.string()).optional(),
  folderId: uuidSchema.optional(),
  isPublic: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});

export const updateMediaSchema = z.object({
  filename: z.string().min(1, "Filename is required").optional(),
  alt: z
    .string()
    .max(255, "Alt text must be less than 255 characters")
    .optional(),
  caption: z
    .string()
    .max(500, "Caption must be less than 500 characters")
    .optional(),
  tags: z.array(z.string()).optional(),
  folderId: uuidSchema.optional(),
  isPublic: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

export const mediaQuerySchema = paginationQuerySchema
  .merge(searchQuerySchema)
  .extend({
    type: z.enum(["image", "video", "audio", "document", "other"]).optional(),
    mimetype: z.string().optional(),
    folderId: uuidSchema.optional(),
    isPublic: z.coerce.boolean().optional(),
    tags: z.string().optional(), // Comma-separated tags
    minSize: z.coerce.number().int().min(0).optional(),
    maxSize: z.coerce.number().int().min(0).optional(),
    sortBy: z
      .enum(["createdAt", "updatedAt", "filename", "size", "downloads"])
      .default("createdAt"),
  });

export const bulkDeleteMediaSchema = z.object({
  mediaIds: z.array(uuidSchema).min(1, "At least one media ID is required"),
});

export const createFolderSchema = z.object({
  name: z
    .string()
    .min(1, "Folder name is required")
    .max(255, "Name must be less than 255 characters"),
  parentId: uuidSchema.optional(),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
});

export const imageTransformSchema = z.object({
  width: z.number().int().min(1).max(4000).optional(),
  height: z.number().int().min(1).max(4000).optional(),
  quality: z.number().int().min(1).max(100).optional(),
  format: z.enum(["jpeg", "png", "webp", "avif"]).optional(),
  fit: z.enum(["cover", "contain", "fill", "inside", "outside"]).optional(),
});

export const cdnOptionsSchema = z.object({
  transform: imageTransformSchema.optional(),
  expires: z.number().int().min(1).optional(), // TTL in seconds
  secure: z.boolean().default(true),
});

// Response schemas
export const mediaResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    filename: z.string(),
    originalName: z.string(),
    mimetype: z.string(),
    size: z.number(),
    url: z.string(),
    cdnUrl: z.string().optional(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
    dimensions: z
      .object({
        width: z.number(),
        height: z.number(),
      })
      .optional(),
    tenantId: z.string(),
    uploadedBy: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  timestamp: z.string(),
});

export const mediaListResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    items: z.array(mediaResponseSchema.shape.data),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    hasMore: z.boolean(),
  }),
  timestamp: z.string(),
});

export const uploadResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    filename: z.string(),
    url: z.string(),
    size: z.number(),
    mimetype: z.string(),
  }),
  timestamp: z.string(),
});

export const cdnUrlResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    url: z.string(),
    expires: z.string().optional(),
  }),
  timestamp: z.string(),
});

export type UploadMediaRequest = z.infer<typeof uploadMediaSchema>;
export type MediaParams = z.infer<typeof mediaParamsSchema>;
export type MediaQueryParams = z.infer<typeof mediaQuerySchema>;
export type ImageTransform = z.infer<typeof imageTransformSchema>;
export type CdnOptions = z.infer<typeof cdnOptionsSchema>;
export type MediaResponse = z.infer<typeof mediaResponseSchema>;
export type MediaListResponse = z.infer<typeof mediaListResponseSchema>;
export type UploadResponse = z.infer<typeof uploadResponseSchema>;
export type CdnUrlResponse = z.infer<typeof cdnUrlResponseSchema>;

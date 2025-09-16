import { z } from "zod";

/**
 * Zod validation schemas for media management endpoints
 */

export const uploadMediaSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  mimetype: z.string().min(1, "MIME type is required"),
  size: z.number().min(1, "File size must be greater than 0"),
  alt: z.string().optional(),
  caption: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const mediaParamsSchema = z.object({
  id: z.string().uuid("Invalid media ID format"),
});

export const mediaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(["image", "video", "audio", "document"]).optional(),
  search: z.string().optional(),
  tags: z.string().optional(), // Comma-separated tags
  sortBy: z
    .enum(["createdAt", "updatedAt", "filename", "size"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
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

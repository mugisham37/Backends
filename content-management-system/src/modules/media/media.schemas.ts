import { z } from "zod";
import {
  fileUploadSchema,
  idParamsSchema,
  paginatedResponseSchema,
  paginationQuerySchema,
  searchQuerySchema,
  successResponseSchema,
  uuidSchema,
} from "../../shared/validators/common.schemas.js";

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

export const mediaParamsSchema = z.object({
  id: uuidSchema,
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
  quality: z.number().int().min(1).max(100).default(85),
  format: z.enum(["jpeg", "png", "webp", "avif"]).optional(),
  fit: z
    .enum(["cover", "contain", "fill", "inside", "outside"])
    .default("cover"),
  background: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional(),
  blur: z.number().int().min(0).max(100).optional(),
  sharpen: z.number().int().min(0).max(100).optional(),
});

export const cdnOptionsSchema = z.object({
  transform: imageTransformSchema.optional(),
  expires: z.number().int().min(1).max(86400).optional(), // TTL in seconds (max 24h)
  secure: z.boolean().default(true),
  download: z.boolean().default(false),
});

// Response schemas
export const mediaSchema = z.object({
  id: uuidSchema,
  filename: z.string(),
  originalName: z.string(),
  mimetype: z.string(),
  size: z.number(),
  type: z.enum(["image", "video", "audio", "document", "other"]),
  url: z.string(),
  cdnUrl: z.string().nullable(),
  alt: z.string().nullable(),
  caption: z.string().nullable(),
  tags: z.array(z.string()),
  folderId: uuidSchema.nullable(),
  isPublic: z.boolean(),
  downloads: z.number().default(0),
  metadata: z.record(z.any()),
  dimensions: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .nullable(),
  tenantId: uuidSchema,
  uploadedBy: uuidSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const folderSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  parentId: uuidSchema.nullable(),
  description: z.string().nullable(),
  mediaCount: z.number().default(0),
  tenantId: uuidSchema,
  createdBy: uuidSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const mediaStatsSchema = z.object({
  totalMedia: z.number(),
  totalSize: z.number(),
  mediaByType: z.record(z.number()),
  mediaByFolder: z.record(z.number()),
  totalDownloads: z.number(),
  storageUsed: z.number(),
  storageLimit: z.number(),
});

export const mediaResponseSchema = successResponseSchema(mediaSchema);
export const mediaListResponseSchema = paginatedResponseSchema(mediaSchema);
export const folderResponseSchema = successResponseSchema(folderSchema);
export const folderListResponseSchema = paginatedResponseSchema(folderSchema);
export const mediaStatsResponseSchema = successResponseSchema(mediaStatsSchema);

export const uploadResponseSchema = successResponseSchema(
  z.object({
    id: uuidSchema,
    filename: z.string(),
    url: z.string(),
    size: z.number(),
    mimetype: z.string(),
    type: z.string(),
  })
);

export const cdnUrlResponseSchema = successResponseSchema(
  z.object({
    url: z.string(),
    expires: z.string().datetime().optional(),
  })
);

export const bulkDeleteResponseSchema = successResponseSchema(
  z.object({
    deletedCount: z.number(),
    failedIds: z.array(uuidSchema),
  })
);

// Endpoint schemas
export const uploadMediaEndpoint = {
  body: uploadMediaSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const updateMediaEndpoint = {
  body: updateMediaSchema,
  query: z.void(),
  params: idParamsSchema,
  headers: z.void(),
};

export const getMediaEndpoint = {
  body: z.void(),
  query: z.void(),
  params: idParamsSchema,
  headers: z.void(),
};

export const listMediaEndpoint = {
  body: z.void(),
  query: mediaQuerySchema,
  params: z.void(),
  headers: z.void(),
};

export const generateCdnUrlEndpoint = {
  body: cdnOptionsSchema,
  query: z.void(),
  params: idParamsSchema,
  headers: z.void(),
};

export const bulkDeleteMediaEndpoint = {
  body: bulkDeleteMediaSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

export const createFolderEndpoint = {
  body: createFolderSchema,
  query: z.void(),
  params: z.void(),
  headers: z.void(),
};

// Type exports
export type UploadMediaRequest = z.infer<typeof uploadMediaSchema>;
export type UpdateMediaRequest = z.infer<typeof updateMediaSchema>;
export type MediaQueryParams = z.infer<typeof mediaQuerySchema>;
export type MediaParams = z.infer<typeof mediaParamsSchema>;
export type ImageTransform = z.infer<typeof imageTransformSchema>;
export type CdnOptions = z.infer<typeof cdnOptionsSchema>;
export type BulkDeleteMediaRequest = z.infer<typeof bulkDeleteMediaSchema>;
export type CreateFolderRequest = z.infer<typeof createFolderSchema>;
export type Media = z.infer<typeof mediaSchema>;
export type Folder = z.infer<typeof folderSchema>;
export type MediaStats = z.infer<typeof mediaStatsSchema>;
export type MediaResponse = z.infer<typeof mediaResponseSchema>;
export type MediaListResponse = z.infer<typeof mediaListResponseSchema>;
export type FolderResponse = z.infer<typeof folderResponseSchema>;
export type FolderListResponse = z.infer<typeof folderListResponseSchema>;
export type MediaStatsResponse = z.infer<typeof mediaStatsResponseSchema>;
export type UploadResponse = z.infer<typeof uploadResponseSchema>;
export type CdnUrlResponse = z.infer<typeof cdnUrlResponseSchema>;
export type BulkDeleteResponse = z.infer<typeof bulkDeleteResponseSchema>;

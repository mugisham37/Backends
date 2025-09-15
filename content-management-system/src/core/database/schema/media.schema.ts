import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth.schema";
import { tenants } from "./tenant.schema";

/**
 * Media types enum
 */
export const mediaTypes = [
  "image",
  "video",
  "audio",
  "document",
  "archive",
  "other",
] as const;
export type MediaType = (typeof mediaTypes)[number];

/**
 * Media storage providers enum
 */
export const storageProviders = [
  "local",
  "s3",
  "cloudinary",
  "gcs",
  "azure",
] as const;
export type StorageProvider = (typeof storageProviders)[number];

/**
 * Media processing status enum
 */
export const processingStatuses = [
  "pending",
  "processing",
  "completed",
  "failed",
] as const;
export type ProcessingStatus = (typeof processingStatuses)[number];

/**
 * Media files table - File management and metadata
 */
export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filename: varchar("filename", { length: 255 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    mediaType: varchar("media_type", { length: 20 }).notNull(),
    size: bigint("size", { mode: "number" }).notNull(), // File size in bytes
    width: integer("width"), // For images and videos
    height: integer("height"), // For images and videos
    duration: integer("duration"), // For videos and audio in seconds
    hash: varchar("hash", { length: 64 }), // File hash for deduplication
    path: text("path").notNull(), // Storage path
    url: text("url"), // Public URL
    cdnUrl: text("cdn_url"), // CDN URL if available
    storageProvider: varchar("storage_provider", { length: 20 })
      .notNull()
      .default("local"),
    bucket: varchar("bucket", { length: 100 }), // S3 bucket or similar
    key: text("key"), // Storage key/path
    isPublic: boolean("is_public").notNull().default(false),
    isProcessed: boolean("is_processed").notNull().default(true),
    processingStatus: varchar("processing_status", { length: 20 })
      .notNull()
      .default("completed"),
    uploaderId: uuid("uploader_id").references(() => users.id, {
      onDelete: "set null",
    }),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    folderId: uuid("folder_id"), // Reference to media folders
    alt: text("alt"), // Alt text for accessibility
    caption: text("caption"),
    description: text("description"),
    tags: jsonb("tags").$type<string[]>(),
    exifData: jsonb("exif_data").$type<Record<string, unknown>>(), // EXIF data for images
    metadata: jsonb("metadata").$type<{
      colorPalette?: string[];
      dominantColor?: string;
      faces?: number;
      objects?: string[];
      [key: string]: unknown;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    filenameIdx: index("media_filename_idx").on(table.filename),
    mimeTypeIdx: index("media_mime_type_idx").on(table.mimeType),
    mediaTypeIdx: index("media_type_idx").on(table.mediaType),
    hashIdx: index("media_hash_idx").on(table.hash),
    uploaderIdx: index("media_uploader_idx").on(table.uploaderId),
    tenantIdx: index("media_tenant_idx").on(table.tenantId),
    folderIdx: index("media_folder_idx").on(table.folderId),
    publicIdx: index("media_public_idx").on(table.isPublic),
    processedIdx: index("media_processed_idx").on(table.isProcessed),
    createdIdx: index("media_created_idx").on(table.createdAt),
  })
);

/**
 * Media folders table - Hierarchical folder organization
 */
export const mediaFolders = pgTable(
  "media_folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    parentId: uuid("parent_id"),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    path: text("path").notNull(), // Full folder path
    isPublic: boolean("is_public").notNull().default(false),
    sortOrder: integer("sort_order").default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugTenantIdx: index("folder_slug_tenant_idx").on(
      table.slug,
      table.tenantId
    ),
    parentIdx: index("folder_parent_idx").on(table.parentId),
    tenantIdx: index("folder_tenant_idx").on(table.tenantId),
    pathIdx: index("folder_path_idx").on(table.path),
    publicIdx: index("folder_public_idx").on(table.isPublic),
  })
);

/**
 * Media transformations table - Image/video processing variants
 */
export const mediaTransformations = pgTable(
  "media_transformations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaId: uuid("media_id")
      .references(() => media.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(), // e.g., "thumbnail", "medium", "large"
    width: integer("width"),
    height: integer("height"),
    quality: integer("quality"), // 1-100 for compression quality
    format: varchar("format", { length: 10 }), // jpg, png, webp, etc.
    size: bigint("size", { mode: "number" }).notNull(),
    path: text("path").notNull(),
    url: text("url"),
    cdnUrl: text("cdn_url"),
    transformations: jsonb("transformations").$type<{
      resize?: { width?: number; height?: number; fit?: string };
      crop?: { x: number; y: number; width: number; height: number };
      filters?: Record<string, unknown>;
      [key: string]: unknown;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    mediaNameIdx: index("transformation_media_name_idx").on(
      table.mediaId,
      table.name
    ),
    mediaIdx: index("transformation_media_idx").on(table.mediaId),
    nameIdx: index("transformation_name_idx").on(table.name),
  })
);

/**
 * Media usage tracking table - Track where media is used
 */
export const mediaUsage = pgTable(
  "media_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaId: uuid("media_id")
      .references(() => media.id, { onDelete: "cascade" })
      .notNull(),
    entityType: varchar("entity_type", { length: 50 }).notNull(), // "content", "user", "tenant", etc.
    entityId: uuid("entity_id").notNull(),
    field: varchar("field", { length: 100 }), // Which field uses this media
    context: jsonb("context").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    mediaIdx: index("usage_media_idx").on(table.mediaId),
    entityIdx: index("usage_entity_idx").on(table.entityType, table.entityId),
    mediaEntityIdx: index("usage_media_entity_idx").on(
      table.mediaId,
      table.entityType,
      table.entityId
    ),
  })
);

/**
 * Media relations
 */
export const mediaRelations = relations(media, ({ one, many }) => ({
  uploader: one(users, {
    fields: [media.uploaderId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [media.tenantId],
    references: [tenants.id],
  }),
  folder: one(mediaFolders, {
    fields: [media.folderId],
    references: [mediaFolders.id],
  }),
  transformations: many(mediaTransformations),
  usage: many(mediaUsage),
}));

export const mediaFolderRelations = relations(
  mediaFolders,
  ({ one, many }) => ({
    parent: one(mediaFolders, {
      fields: [mediaFolders.parentId],
      references: [mediaFolders.id],
      relationName: "folderHierarchy",
    }),
    children: many(mediaFolders, {
      relationName: "folderHierarchy",
    }),
    tenant: one(tenants, {
      fields: [mediaFolders.tenantId],
      references: [tenants.id],
    }),
    media: many(media),
  })
);

export const mediaTransformationRelations = relations(
  mediaTransformations,
  ({ one }) => ({
    media: one(media, {
      fields: [mediaTransformations.mediaId],
      references: [media.id],
    }),
  })
);

export const mediaUsageRelations = relations(mediaUsage, ({ one }) => ({
  media: one(media, {
    fields: [mediaUsage.mediaId],
    references: [media.id],
  }),
}));

/**
 * TypeScript types for media schemas
 */
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type MediaMetadata = NonNullable<Media["metadata"]>;

export type MediaFolder = typeof mediaFolders.$inferSelect;
export type NewMediaFolder = typeof mediaFolders.$inferInsert;

export type MediaTransformation = typeof mediaTransformations.$inferSelect;
export type NewMediaTransformation = typeof mediaTransformations.$inferInsert;
export type TransformationConfig = NonNullable<
  MediaTransformation["transformations"]
>;

export type MediaUsage = typeof mediaUsage.$inferSelect;
export type NewMediaUsage = typeof mediaUsage.$inferInsert;

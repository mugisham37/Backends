import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./auth.schema";
import { tenants } from "./tenant.schema";

/**
 * Content status enum
 */
export const contentStatuses = [
  "draft",
  "published",
  "archived",
  "scheduled",
] as const;
export type ContentStatus = (typeof contentStatuses)[number];

/**
 * Content types enum
 */
export const contentTypes = [
  "article",
  "page",
  "blog_post",
  "news",
  "documentation",
  "custom",
] as const;
export type ContentType = (typeof contentTypes)[number];

/**
 * Contents table - Main content management
 */
export const contents = pgTable(
  "contents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: varchar("title", { length: 500 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    excerpt: text("excerpt"),
    body: text("body"),
    contentType: varchar("content_type", { length: 50 })
      .notNull()
      .default("article"),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    version: integer("version").notNull().default(1),
    isLatestVersion: boolean("is_latest_version").notNull().default(true),
    parentId: uuid("parent_id"), // For content hierarchies
    originalId: uuid("original_id"), // Reference to the original content for versions
    publishedAt: timestamp("published_at"),
    scheduledAt: timestamp("scheduled_at"),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    editorId: uuid("editor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    seoTitle: varchar("seo_title", { length: 255 }),
    seoDescription: text("seo_description"),
    seoKeywords: varchar("seo_keywords", { length: 500 }),
    featuredImage: text("featured_image"), // URL to featured image
    tags: jsonb("tags").$type<string[]>(),
    categories: jsonb("categories").$type<string[]>(),
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<{
      readTime?: number;
      wordCount?: number;
      language?: string;
      template?: string;
      layout?: string;
      [key: string]: unknown;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugTenantIdx: index("content_slug_tenant_idx").on(
      table.slug,
      table.tenantId
    ),
    statusIdx: index("content_status_idx").on(table.status),
    typeIdx: index("content_type_idx").on(table.contentType),
    authorIdx: index("content_author_idx").on(table.authorId),
    tenantIdx: index("content_tenant_idx").on(table.tenantId),
    publishedIdx: index("content_published_idx").on(table.publishedAt),
    scheduledIdx: index("content_scheduled_idx").on(table.scheduledAt),
    versionIdx: index("content_version_idx").on(
      table.originalId,
      table.version
    ),
    latestVersionIdx: index("content_latest_version_idx").on(
      table.isLatestVersion
    ),
    parentIdx: index("content_parent_idx").on(table.parentId),
  })
);

/**
 * Content versions table - Version history tracking
 */
export const contentVersions = pgTable(
  "content_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentId: uuid("content_id")
      .references(() => contents.id, { onDelete: "cascade" })
      .notNull(),
    version: integer("version").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    body: text("body"),
    excerpt: text("excerpt"),
    status: varchar("status", { length: 20 }).notNull(),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    changeLog: text("change_log"), // Description of changes made
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    contentVersionIdx: index("version_content_version_idx").on(
      table.contentId,
      table.version
    ),
    contentIdx: index("version_content_idx").on(table.contentId),
    authorIdx: index("version_author_idx").on(table.authorId),
    createdIdx: index("version_created_idx").on(table.createdAt),
  })
);

/**
 * Content categories table - Hierarchical categories
 */
export const contentCategories = pgTable(
  "content_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    parentId: uuid("parent_id"),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    sortOrder: integer("sort_order").default(0),
    isActive: boolean("is_active").notNull().default(true),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugTenantIdx: index("category_slug_tenant_idx").on(
      table.slug,
      table.tenantId
    ),
    parentIdx: index("category_parent_idx").on(table.parentId),
    tenantIdx: index("category_tenant_idx").on(table.tenantId),
    activeIdx: index("category_active_idx").on(table.isActive),
  })
);

/**
 * Content tags table - Flexible tagging system
 */
export const contentTags = pgTable(
  "content_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),
    color: varchar("color", { length: 7 }), // Hex color code
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    usageCount: integer("usage_count").default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugTenantIdx: index("tag_slug_tenant_idx").on(table.slug, table.tenantId),
    nameIdx: index("tag_name_idx").on(table.name),
    tenantIdx: index("tag_tenant_idx").on(table.tenantId),
    usageIdx: index("tag_usage_idx").on(table.usageCount),
  })
);

/**
 * Content relations
 */
export const contentRelations = relations(contents, ({ one, many }) => ({
  author: one(users, {
    fields: [contents.authorId],
    references: [users.id],
    relationName: "contentAuthor",
  }),
  editor: one(users, {
    fields: [contents.editorId],
    references: [users.id],
    relationName: "contentEditor",
  }),
  tenant: one(tenants, {
    fields: [contents.tenantId],
    references: [tenants.id],
  }),
  parent: one(contents, {
    fields: [contents.parentId],
    references: [contents.id],
    relationName: "contentHierarchy",
  }),
  children: many(contents, {
    relationName: "contentHierarchy",
  }),
  versions: many(contentVersions),
}));

export const contentVersionRelations = relations(
  contentVersions,
  ({ one }) => ({
    content: one(contents, {
      fields: [contentVersions.contentId],
      references: [contents.id],
    }),
    author: one(users, {
      fields: [contentVersions.authorId],
      references: [users.id],
    }),
  })
);

export const contentCategoryRelations = relations(
  contentCategories,
  ({ one, many }) => ({
    parent: one(contentCategories, {
      fields: [contentCategories.parentId],
      references: [contentCategories.id],
      relationName: "categoryHierarchy",
    }),
    children: many(contentCategories, {
      relationName: "categoryHierarchy",
    }),
    tenant: one(tenants, {
      fields: [contentCategories.tenantId],
      references: [tenants.id],
    }),
  })
);

export const contentTagRelations = relations(contentTags, ({ one }) => ({
  tenant: one(tenants, {
    fields: [contentTags.tenantId],
    references: [tenants.id],
  }),
}));

/**
 * TypeScript types for content schemas
 */
export type Content = typeof contents.$inferSelect;
export type NewContent = typeof contents.$inferInsert;
export type ContentMetadata = NonNullable<Content["metadata"]>;

export type ContentVersion = typeof contentVersions.$inferSelect;
export type NewContentVersion = typeof contentVersions.$inferInsert;

export type ContentCategory = typeof contentCategories.$inferSelect;
export type NewContentCategory = typeof contentCategories.$inferInsert;

export type ContentTag = typeof contentTags.$inferSelect;
export type NewContentTag = typeof contentTags.$inferInsert;

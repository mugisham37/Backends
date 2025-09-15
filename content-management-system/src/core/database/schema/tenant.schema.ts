import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth.schema";
import { contents } from "./content.schema";
import { media } from "./media.schema";

/**
 * Tenants table - Multi-tenancy support
 */
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull().unique(),
    description: text("description"),
    domain: varchar("domain", { length: 255 }),
    subdomain: varchar("subdomain", { length: 100 }),
    isActive: boolean("is_active").notNull().default(true),
    settings: jsonb("settings").$type<{
      theme?: string;
      features?: string[];
      limits?: {
        users?: number;
        storage?: number;
        bandwidth?: number;
      };
      customization?: Record<string, unknown>;
    }>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    slugIdx: index("tenant_slug_idx").on(table.slug),
    domainIdx: index("tenant_domain_idx").on(table.domain),
    subdomainIdx: index("tenant_subdomain_idx").on(table.subdomain),
    activeIdx: index("tenant_active_idx").on(table.isActive),
  })
);

/**
 * Tenant relations
 */
export const tenantRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  contents: many(contents),
  media: many(media),
}));

/**
 * TypeScript types for tenant schema
 */
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantSettings = NonNullable<Tenant["settings"]>;
export type TenantMetadata = NonNullable<Tenant["metadata"]>;

export interface Content {
  id: string;
  title: string;
  slug: string;
  body?: string;
  excerpt?: string;
  status: ContentStatus;
  version: number;
  metadata: ContentMetadata;
  tenantId: string;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
}

export interface CreateContentData {
  title: string;
  slug: string;
  body?: string;
  excerpt?: string;
  metadata?: Partial<ContentMetadata>;
  tenantId: string;
  authorId: string;
}

export interface UpdateContentData {
  title?: string;
  slug?: string;
  body?: string;
  excerpt?: string;
  metadata?: Partial<ContentMetadata>;
}

export interface ContentMetadata {
  tags: string[];
  categories: string[];
  featuredImage?: string;
  seoTitle?: string;
  seoDescription?: string;
  customFields: Record<string, any>;
}

export enum ContentStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
  SCHEDULED = "scheduled",
}

export interface ContentVersion {
  id: string;
  contentId: string;
  version: number;
  title: string;
  body?: string;
  metadata: ContentMetadata;
  createdAt: Date;
  createdBy: string;
}

export interface ContentFilter {
  status?: ContentStatus;
  authorId?: string;
  tenantId?: string;
  tags?: string[];
  categories?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ContentSearchOptions {
  query?: string;
  filters?: ContentFilter;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

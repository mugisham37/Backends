import type { BaseError } from "../../core/errors/base.error";
import type { Result } from "../../core/types/result.types";

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
  body: string;
  excerpt?: string | undefined;
  status?: ContentStatus | undefined;
  tags?: string[] | undefined;
  categoryId?: string | undefined;
  featuredImage?: string | undefined;
  seoTitle?: string | undefined;
  seoDescription?: string | undefined;
  publishedAt?: Date | undefined;
  metadata?: Record<string, any> | undefined;
  tenantId: string;
  authorId: string;
}

export interface UpdateContentData {
  title?: string | undefined;
  slug?: string | undefined;
  body?: string | undefined;
  excerpt?: string | undefined;
  status?: ContentStatus | undefined;
  tags?: string[] | undefined;
  categoryId?: string | undefined;
  featuredImage?: string | undefined;
  seoTitle?: string | undefined;
  seoDescription?: string | undefined;
  publishedAt?: Date | undefined;
  metadata?: Record<string, any> | undefined;
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
  query?: string | undefined;
  filters?: ContentFilter | undefined;
  sortBy?: string | undefined;
  sortOrder?: "asc" | "desc" | undefined;
  page?: number | undefined;
  limit?: number | undefined;
  status?: ContentStatus | undefined;
  authorId?: string | undefined;
  search?: string | undefined;
  tags?: string[] | undefined;
}

export interface ContentListResult {
  items: Content[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface IContentService {
  createContent(data: CreateContentData): Promise<Result<Content, BaseError>>;
  updateContent(
    id: string,
    data: UpdateContentData
  ): Promise<Result<Content, BaseError>>;
  deleteContent(id: string): Promise<Result<void, BaseError>>;
  getContent(id: string, version?: string): Promise<Result<Content, BaseError>>;
  getContentsByTenant(
    tenantId: string,
    options: ContentSearchOptions
  ): Promise<Result<ContentListResult, BaseError>>;
  publishContent(id: string): Promise<Result<Content, BaseError>>;
  getContentVersions(id: string): Promise<Result<ContentVersion[], BaseError>>;
  searchContent(
    options: ContentSearchOptions
  ): Promise<Result<ContentListResult, BaseError>>;
}

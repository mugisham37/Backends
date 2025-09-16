import type { Result } from "../../core/types/result.types";

export interface Media {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  cdnUrl?: string;
  metadata: MediaMetadata;
  tenantId: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMediaData {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  metadata?: Partial<MediaMetadata>;
  tenantId: string;
  uploadedBy: string;
}

export interface UpdateMediaData {
  filename?: string;
  metadata?: Partial<MediaMetadata>;
}

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number;
  alt?: string;
  caption?: string;
  tags: string[];
  customFields: Record<string, any>;
}

export interface FileUpload {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ImageTransform {
  width?: number | undefined;
  height?: number | undefined;
  quality?: number | undefined;
  format?: "jpeg" | "png" | "webp" | "avif" | undefined;
  crop?: "center" | "top" | "bottom" | "left" | "right" | undefined;
}

export interface CdnOptions {
  transforms?: ImageTransform[];
  cache?: boolean;
  expires?: number | undefined;
}

export interface MediaFilter {
  mimeType?: string;
  tenantId?: string;
  uploadedBy?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface MediaSearchOptions {
  query?: string | undefined;
  type?: string | undefined;
  filters?: MediaFilter;
  sortBy?: string | undefined;
  sortOrder?: "asc" | "desc";
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  tags?: string[] | undefined;
}

export interface MediaListResult {
  items: Media[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface FileUploadRequest {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

export interface UploadMetadata {
  filename?: string;
  mimetype?: string;
  size?: number;
  alt?: string;
  caption?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  tenantId: string;
  uploadedBy: string;
}

export interface IMediaService {
  uploadMedia(
    file: FileUpload,
    metadata?: Partial<MediaMetadata>
  ): Promise<Result<Media>>;
  uploadFile(
    file: FileUploadRequest,
    metadata: UploadMetadata
  ): Promise<Result<Media>>;
  updateMedia(id: string, data: UpdateMediaData): Promise<Result<Media>>;
  deleteMedia(id: string): Promise<Result<void>>;
  getMedia(id: string): Promise<Result<Media>>;
  getMediaByTenant(
    tenantId: string,
    options: MediaSearchOptions
  ): Promise<Result<MediaListResult>>;
  transformImage(
    id: string,
    transforms: ImageTransform
  ): Promise<Result<string>>;
  processImage(
    id: string,
    transforms: ImageTransform[]
  ): Promise<Result<Media>>;
  getCdnUrl(id: string, options?: CdnOptions): Promise<Result<string>>;
  generateCdnUrl(
    id: string,
    options: CdnOptions
  ): Promise<Result<{ url: string; expires?: string }>>;
  searchMedia(options: MediaSearchOptions): Promise<Result<MediaListResult>>;
}

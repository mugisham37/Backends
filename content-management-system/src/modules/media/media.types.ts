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
  width?: number;
  height?: number;
  quality?: number;
  format?: "jpeg" | "png" | "webp";
  crop?: "center" | "top" | "bottom" | "left" | "right";
}

export interface CdnOptions {
  transforms?: ImageTransform[];
  cache?: boolean;
  expires?: number;
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
  query?: string;
  filters?: MediaFilter;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

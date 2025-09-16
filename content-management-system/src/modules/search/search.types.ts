export interface SearchResult<T = any> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SearchQuery {
  query: string;
  filters?: SearchFilter;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
  highlight?: boolean;
}

export interface SearchFilter {
  type?: string[];
  tenantId?: string;
  authorId?: string;
  status?: string[];
  tags?: string[];
  categories?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface SearchIndex {
  id: string;
  type: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IndexDocument {
  id: string;
  type: "content" | "media" | "user";
  title: string;
  content: string;
  metadata: Record<string, any>;
  tenantId: string;
}

export interface SearchConfig {
  indexName: string;
  batchSize: number;
  maxResults: number;
  highlightFields: string[];
}

export interface SearchStats {
  totalDocuments: number;
  indexSize: number;
  lastIndexed: Date;
  searchesPerDay: number;
}

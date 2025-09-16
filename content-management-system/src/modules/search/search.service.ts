import { inject, injectable } from "tsyringe";
import type { Content } from "../../core/database/schema/content.schema";
import type { Media } from "../../core/database/schema/media.schema";
import type { Result } from "../../core/types/result.types";
import { logger } from "../../shared/utils/logger";
import { CacheService } from "../cache/cache.service";

interface SearchDocument {
  id: string;
  type: "content" | "media";
  title?: string;
  body?: string;
  excerpt?: string;
  filename?: string;
  originalName?: string;
  alt?: string;
  caption?: string;
  description?: string;
  tags: string[];
  categories?: string[];
  status?: string;
  mediaType?: string;
  tenantId: string;
  authorId?: string;
  createdAt: Date;
  updatedAt: Date;
  searchableText: string;
  boost: number;
}

interface SearchOptions {
  tenantId?: string;
  type?: "content" | "media" | "all";
  filters?: {
    status?: string;
    mediaType?: string;
    tags?: string[];
    categories?: string[];
    authorId?: string;
    dateRange?: { start: Date; end: Date };
  };
  sort?: {
    field: string;
    direction: "asc" | "desc";
  };
  pagination?: {
    page: number;
    limit: number;
  };
  highlight?: boolean;
  fuzzy?: boolean;
}

interface SearchResult {
  document: SearchDocument;
  score: number;
  highlights?: { [field: string]: string[] };
}

/**
 * Advanced search service with full-text search, indexing, and optimization
 * Provides comprehensive search functionality with filtering, ranking, and caching
 */
@injectable()
export class SearchService {
  private searchIndex = new Map<string, SearchDocument>();
  private invertedIndex = new Map<string, Set<string>>();
  private searchStats = {
    totalSearches: 0,
    queryHistory: new Map<string, number>(),
    noResultsQueries: new Map<string, number>(),
  };

  constructor(@inject("CacheService") private cacheService: CacheService) {
    this.initializeIndex();
  }

  /**
   * Initialize search index
   */
  private async initializeIndex(): Promise<void> {
    try {
      // Load cached index if available
      const cachedIndex = await this.cacheService.get<
        Map<string, SearchDocument>
      >("search:index");
      if (cachedIndex) {
        this.searchIndex = new Map(cachedIndex);
        this.rebuildInvertedIndex();
        logger.info("Search index loaded from cache");
      }
    } catch (error) {
      logger.error("Failed to initialize search index:", error);
    }
  }

  /**
   * Rebuild inverted index from main index
   */
  private rebuildInvertedIndex(): void {
    this.invertedIndex.clear();

    for (const [docId, document] of this.searchIndex.entries()) {
      this.addToInvertedIndex(docId, document.searchableText);
    }
  }

  /**
   * Add document to inverted index
   */
  private addToInvertedIndex(docId: string, text: string): void {
    const tokens = this.tokenize(text);

    for (const token of tokens) {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Set());
      }
      this.invertedIndex.get(token)?.add(docId);
    }
  }

  /**
   * Remove document from inverted index
   */
  private removeFromInvertedIndex(docId: string, text: string): void {
    const tokens = this.tokenize(text);

    for (const token of tokens) {
      const docSet = this.invertedIndex.get(token);
      if (docSet) {
        docSet.delete(docId);
        if (docSet.size === 0) {
          this.invertedIndex.delete(token);
        }
      }
    }
  }

  /**
   * Tokenize text for indexing
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
      .filter((token) => !this.isStopWord(token));
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
    ]);
    return stopWords.has(word);
  }

  /**
   * Create searchable text from document
   */
  private createSearchableText(document: Partial<SearchDocument>): string {
    const fields = [
      document.title,
      document.body,
      document.excerpt,
      document.filename,
      document.originalName,
      document.alt,
      document.caption,
      document.description,
      ...(document.tags || []),
      ...(document.categories || []),
    ];

    return fields.filter(Boolean).join(" ");
  }

  /**
   * Calculate document boost based on type and properties
   */
  private calculateBoost(document: Partial<SearchDocument>): number {
    let boost = 1.0;

    // Content type boost
    if (document.type === "content") {
      boost *= 1.2;
    }

    // Status boost
    if (document.status === "published") {
      boost *= 1.5;
    }

    // Recency boost (newer content gets higher boost)
    if (document.createdAt) {
      const daysSinceCreation =
        (Date.now() - document.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation < 7) {
        boost *= 1.3;
      } else if (daysSinceCreation < 30) {
        boost *= 1.1;
      }
    }

    return boost;
  }

  /**
   * Index content for search
   */
  async indexContent(content: Content): Promise<Result<void, Error>> {
    try {
      const searchDocument: SearchDocument = {
        id: content.id,
        type: "content",
        title: content.title,
        body: content.body,
        excerpt: content.excerpt,
        tags: content.tags || [],
        categories: content.categories || [],
        status: content.status,
        tenantId: content.tenantId,
        authorId: content.authorId,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt,
        searchableText: "",
        boost: 1.0,
      };

      searchDocument.searchableText = this.createSearchableText(searchDocument);
      searchDocument.boost = this.calculateBoost(searchDocument);

      const docId = `content:${content.id}`;

      // Remove old document from inverted index if it exists
      const existingDoc = this.searchIndex.get(docId);
      if (existingDoc) {
        this.removeFromInvertedIndex(docId, existingDoc.searchableText);
      }

      // Add to main index
      this.searchIndex.set(docId, searchDocument);

      // Add to inverted index
      this.addToInvertedIndex(docId, searchDocument.searchableText);

      // Cache the updated index
      await this.cacheIndex();

      logger.debug(`Content indexed for search: ${content.id}`);

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Failed to index content ${content.id}:`, error);
      return {
        success: false,
        error: new Error("Failed to index content"),
      };
    }
  }

  /**
   * Update content in search index
   */
  async updateContent(content: Content): Promise<Result<void, Error>> {
    try {
      return await this.indexContent(content);
    } catch (error) {
      logger.error(`Failed to update content in search ${content.id}:`, error);
      return {
        success: false,
        error: new Error("Failed to update content in search"),
      };
    }
  }

  /**
   * Remove content from search index
   */
  async removeContent(contentId: string): Promise<Result<void, Error>> {
    try {
      const docId = `content:${contentId}`;
      const existingDoc = this.searchIndex.get(docId);

      if (existingDoc) {
        // Remove from inverted index
        this.removeFromInvertedIndex(docId, existingDoc.searchableText);

        // Remove from main index
        this.searchIndex.delete(docId);

        // Cache the updated index
        await this.cacheIndex();
      }

      logger.debug(`Content removed from search index: ${contentId}`);

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Failed to remove content from search ${contentId}:`, error);
      return {
        success: false,
        error: new Error("Failed to remove content from search"),
      };
    }
  }

  /**
   * Index media for search
   */
  async indexMedia(media: Media): Promise<Result<void, Error>> {
    try {
      const searchDocument: SearchDocument = {
        id: media.id,
        type: "media",
        filename: media.filename,
        originalName: media.originalName,
        alt: media.alt,
        caption: media.caption,
        description: media.description,
        tags: media.tags || [],
        mediaType: media.mediaType,
        tenantId: media.tenantId,
        createdAt: media.createdAt,
        updatedAt: media.updatedAt,
        searchableText: "",
        boost: 1.0,
      };

      searchDocument.searchableText = this.createSearchableText(searchDocument);
      searchDocument.boost = this.calculateBoost(searchDocument);

      const docId = `media:${media.id}`;

      // Remove old document from inverted index if it exists
      const existingDoc = this.searchIndex.get(docId);
      if (existingDoc) {
        this.removeFromInvertedIndex(docId, existingDoc.searchableText);
      }

      // Add to main index
      this.searchIndex.set(docId, searchDocument);

      // Add to inverted index
      this.addToInvertedIndex(docId, searchDocument.searchableText);

      // Cache the updated index
      await this.cacheIndex();

      logger.debug(`Media indexed for search: ${media.id}`);

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Failed to index media ${media.id}:`, error);
      return {
        success: false,
        error: new Error("Failed to index media"),
      };
    }
  }

  /**
   * Update media in search index
   */
  async updateMedia(media: Media): Promise<Result<void, Error>> {
    try {
      return await this.indexMedia(media);
    } catch (error) {
      logger.error(`Failed to update media in search ${media.id}:`, error);
      return {
        success: false,
        error: new Error("Failed to update media in search"),
      };
    }
  }

  /**
   * Remove media from search index
   */
  async removeMedia(mediaId: string): Promise<Result<void, Error>> {
    try {
      const docId = `media:${mediaId}`;
      const existingDoc = this.searchIndex.get(docId);

      if (existingDoc) {
        // Remove from inverted index
        this.removeFromInvertedIndex(docId, existingDoc.searchableText);

        // Remove from main index
        this.searchIndex.delete(docId);

        // Cache the updated index
        await this.cacheIndex();
      }

      logger.debug(`Media removed from search index: ${mediaId}`);

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Failed to remove media from search ${mediaId}:`, error);
      return {
        success: false,
        error: new Error("Failed to remove media from search"),
      };
    }
  }

  /**
   * Cache the search index
   */
  private async cacheIndex(): Promise<void> {
    try {
      await this.cacheService.set(
        "search:index",
        Array.from(this.searchIndex.entries()),
        3600 // 1 hour TTL
      );
    } catch (error) {
      logger.error("Failed to cache search index:", error);
    }
  }

  /**
   * Advanced search with full-text search, ranking, and optimization
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<
    Result<
      {
        results: SearchResult[];
        total: number;
        pagination?: {
          page: number;
          limit: number;
          totalPages: number;
          hasNext: boolean;
          hasPrev: boolean;
        };
        searchTime: number;
        suggestions?: string[];
      },
      Error
    >
  > {
    const startTime = Date.now();

    try {
      // Update search statistics
      this.searchStats.totalSearches++;
      const queryLower = query.toLowerCase();
      this.searchStats.queryHistory.set(
        queryLower,
        (this.searchStats.queryHistory.get(queryLower) || 0) + 1
      );

      // Check cache first
      const cacheKey = `search:${JSON.stringify({ query, options })}`;
      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult) {
        return { success: true, data: cachedResult };
      }

      const {
        type = "all",
        tenantId,
        filters,
        sort,
        pagination,
        highlight = false,
        fuzzy = false,
      } = options;

      // Tokenize search query
      const searchTokens = this.tokenize(query);
      if (searchTokens.length === 0) {
        return {
          success: true,
          data: {
            results: [],
            total: 0,
            searchTime: Date.now() - startTime,
          },
        };
      }

      // Find candidate documents using inverted index
      const candidateDocIds = this.findCandidateDocuments(searchTokens, fuzzy);

      // Score and filter documents
      const searchResults: SearchResult[] = [];

      for (const docId of candidateDocIds) {
        const document = this.searchIndex.get(docId);
        if (!document) continue;

        // Apply filters
        if (!this.passesFilters(document, { type, tenantId, filters })) {
          continue;
        }

        // Calculate relevance score
        const score = this.calculateAdvancedScore(
          document,
          searchTokens,
          query
        );

        const result: SearchResult = {
          document,
          score,
        };

        // Add highlights if requested
        if (highlight) {
          result.highlights = this.generateHighlights(document, searchTokens);
        }

        searchResults.push(result);
      }

      // Sort results by score (descending) or custom sort
      if (sort) {
        searchResults.sort((a, b) => {
          const aValue = (a.document as any)[sort.field];
          const bValue = (b.document as any)[sort.field];
          const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
          return sort.direction === "desc" ? -comparison : comparison;
        });
      } else {
        searchResults.sort((a, b) => b.score - a.score);
      }

      const total = searchResults.length;
      let paginatedResults = searchResults;

      // Apply pagination
      let paginationInfo;
      if (pagination) {
        const { page, limit } = pagination;
        const offset = (page - 1) * limit;
        paginatedResults = searchResults.slice(offset, offset + limit);

        const totalPages = Math.ceil(total / limit);
        paginationInfo = {
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        };
      }

      const searchTime = Date.now() - startTime;

      // Track no results queries
      if (total === 0) {
        this.searchStats.noResultsQueries.set(
          queryLower,
          (this.searchStats.noResultsQueries.get(queryLower) || 0) + 1
        );
      }

      const result = {
        results: paginatedResults,
        total,
        pagination: paginationInfo,
        searchTime,
      };

      // Cache the result
      await this.cacheService.set(cacheKey, result, 300); // 5 minutes TTL

      return { success: true, data: result };
    } catch (error) {
      logger.error("Search failed:", error);
      return {
        success: false,
        error: new Error("Search failed"),
      };
    }
  }

  /**
   * Find candidate documents using inverted index
   */
  private findCandidateDocuments(
    tokens: string[],
    fuzzy: boolean
  ): Set<string> {
    const candidates = new Set<string>();

    for (const token of tokens) {
      // Exact match
      const exactMatches = this.invertedIndex.get(token);
      if (exactMatches) {
        exactMatches.forEach((docId) => candidates.add(docId));
      }

      // Fuzzy matching if enabled
      if (fuzzy) {
        for (const [indexToken, docIds] of this.invertedIndex.entries()) {
          if (this.calculateLevenshteinDistance(token, indexToken) <= 2) {
            docIds.forEach((docId) => candidates.add(docId));
          }
        }
      }
    }

    return candidates;
  }

  /**
   * Check if document passes filters
   */
  private passesFilters(
    document: SearchDocument,
    options: { type?: string; tenantId?: string; filters?: any }
  ): boolean {
    const { type, tenantId, filters } = options;

    // Type filter
    if (type && type !== "all" && document.type !== type) {
      return false;
    }

    // Tenant filter
    if (tenantId && document.tenantId !== tenantId) {
      return false;
    }

    // Additional filters
    if (filters) {
      if (filters.status && document.status !== filters.status) {
        return false;
      }
      if (filters.mediaType && document.mediaType !== filters.mediaType) {
        return false;
      }
      if (filters.authorId && document.authorId !== filters.authorId) {
        return false;
      }
      if (filters.tags && filters.tags.length > 0) {
        if (!document.tags.some((tag) => filters.tags.includes(tag))) {
          return false;
        }
      }
      if (filters.categories && filters.categories.length > 0) {
        if (
          !document.categories?.some((cat) => filters.categories.includes(cat))
        ) {
          return false;
        }
      }
      if (filters.dateRange) {
        const docDate = new Date(document.createdAt);
        if (
          docDate < filters.dateRange.start ||
          docDate > filters.dateRange.end
        ) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Calculate advanced relevance score
   */
  private calculateAdvancedScore(
    document: SearchDocument,
    searchTokens: string[],
    originalQuery: string
  ): number {
    let score = 0;
    const docTokens = this.tokenize(document.searchableText);

    // Term frequency scoring
    for (const searchToken of searchTokens) {
      const termFreq = docTokens.filter(
        (token) => token === searchToken
      ).length;
      if (termFreq > 0) {
        // TF-IDF like scoring
        const tf = termFreq / docTokens.length;
        const idf = Math.log(
          this.searchIndex.size /
            (this.invertedIndex.get(searchToken)?.size || 1)
        );
        score += tf * idf;
      }
    }

    // Field-specific boosts
    if (document.title?.toLowerCase().includes(originalQuery.toLowerCase())) {
      score *= 2.0; // Title matches get higher score
    }

    if (
      document.tags.some((tag) =>
        tag.toLowerCase().includes(originalQuery.toLowerCase())
      )
    ) {
      score *= 1.5; // Tag matches get boost
    }

    // Apply document boost
    score *= document.boost;

    return score;
  }

  /**
   * Generate highlights for search results
   */
  private generateHighlights(
    document: SearchDocument,
    searchTokens: string[]
  ): { [field: string]: string[] } {
    const highlights: { [field: string]: string[] } = {};

    const fields = {
      title: document.title,
      body: document.body,
      description: document.description,
    };

    for (const [fieldName, fieldValue] of Object.entries(fields)) {
      if (!fieldValue) continue;

      const fieldHighlights: string[] = [];
      const words = fieldValue.split(/\s+/);

      for (let i = 0; i < words.length; i++) {
        const word = words[i].toLowerCase();
        if (searchTokens.some((token) => word.includes(token))) {
          // Extract context around the match
          const start = Math.max(0, i - 5);
          const end = Math.min(words.length, i + 6);
          const context = words.slice(start, end);

          // Highlight the matching words
          const highlighted = context
            .map((w) => {
              const wLower = w.toLowerCase();
              if (searchTokens.some((token) => wLower.includes(token))) {
                return `<mark>${w}</mark>`;
              }
              return w;
            })
            .join(" ");

          fieldHighlights.push(highlighted);
        }
      }

      if (fieldHighlights.length > 0) {
        highlights[fieldName] = fieldHighlights.slice(0, 3); // Limit to 3 highlights per field
      }
    }

    return highlights;
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get intelligent search suggestions
   */
  async getSuggestions(
    query: string,
    tenantId?: string,
    limit = 5
  ): Promise<Result<string[], Error>> {
    try {
      const cacheKey = `suggestions:${query}:${tenantId || "all"}:${limit}`;
      const cached = await this.cacheService.get<string[]>(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      const suggestions = new Set<string>();
      const queryLower = query.toLowerCase();
      const queryTokens = this.tokenize(query);

      // Get suggestions from search history
      for (const [
        historicalQuery,
        count,
      ] of this.searchStats.queryHistory.entries()) {
        if (historicalQuery.includes(queryLower) && count > 1) {
          suggestions.add(historicalQuery);
        }
      }

      // Get suggestions from indexed content
      for (const [_docId, document] of this.searchIndex.entries()) {
        if (tenantId && document.tenantId !== tenantId) {
          continue;
        }

        // Extract potential suggestions from various fields
        const candidates = [
          document.title,
          document.filename,
          document.originalName,
          ...document.tags,
          ...(document.categories || []),
        ].filter(Boolean);

        for (const candidate of candidates) {
          const candidateLower = candidate.toLowerCase();

          // Exact substring match
          if (candidateLower.includes(queryLower)) {
            suggestions.add(candidate);
          }

          // Token-based matching
          const candidateTokens = this.tokenize(candidate);
          if (queryTokens.some((token) => candidateTokens.includes(token))) {
            suggestions.add(candidate);
          }
        }

        if (suggestions.size >= limit * 2) {
          break; // Collect more than needed for better ranking
        }
      }

      // Rank suggestions by relevance
      const rankedSuggestions = Array.from(suggestions)
        .map((suggestion) => ({
          text: suggestion,
          score: this.calculateSuggestionScore(suggestion, query),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => s.text);

      // Cache suggestions
      await this.cacheService.set(cacheKey, rankedSuggestions, 1800); // 30 minutes

      return { success: true, data: rankedSuggestions };
    } catch (error) {
      logger.error("Failed to get search suggestions:", error);
      return {
        success: false,
        error: new Error("Failed to get search suggestions"),
      };
    }
  }

  /**
   * Calculate suggestion relevance score
   */
  private calculateSuggestionScore(suggestion: string, query: string): number {
    let score = 0;
    const suggestionLower = suggestion.toLowerCase();
    const queryLower = query.toLowerCase();

    // Exact match gets highest score
    if (suggestionLower === queryLower) {
      score += 100;
    }

    // Starts with query gets high score
    if (suggestionLower.startsWith(queryLower)) {
      score += 50;
    }

    // Contains query gets medium score
    if (suggestionLower.includes(queryLower)) {
      score += 25;
    }

    // Shorter suggestions are preferred
    score += Math.max(0, 50 - suggestion.length);

    // Popular queries get boost
    const popularity = this.searchStats.queryHistory.get(suggestionLower) || 0;
    score += popularity * 5;

    return score;
  }

  /**
   * Get comprehensive search analytics
   */
  async getSearchAnalytics(tenantId?: string): Promise<
    Result<
      {
        totalSearches: number;
        topQueries: Array<{ query: string; count: number }>;
        noResultsQueries: Array<{ query: string; count: number }>;
        averageResultsPerQuery: number;
        searchTrends: Array<{ date: string; searches: number }>;
        popularContent: Array<{
          id: string;
          title: string;
          searchCount: number;
        }>;
      },
      Error
    >
  > {
    try {
      const cacheKey = `analytics:${tenantId || "all"}`;
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return { success: true, data: cached };
      }

      // Get top queries
      const topQueries = Array.from(this.searchStats.queryHistory.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([query, count]) => ({ query, count }));

      // Get no results queries
      const noResultsQueries = Array.from(
        this.searchStats.noResultsQueries.entries()
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([query, count]) => ({ query, count }));

      // Calculate average results per query (simplified)
      const totalQueries = this.searchStats.queryHistory.size;
      const averageResultsPerQuery =
        totalQueries > 0
          ? Array.from(this.searchStats.queryHistory.values()).reduce(
              (a, b) => a + b,
              0
            ) / totalQueries
          : 0;

      // Generate search trends (simplified - would use real time-series data)
      const searchTrends = this.generateSearchTrends();

      // Get popular content (simplified)
      const popularContent = this.getPopularContent(tenantId);

      const analytics = {
        totalSearches: this.searchStats.totalSearches,
        topQueries,
        noResultsQueries,
        averageResultsPerQuery,
        searchTrends,
        popularContent,
      };

      // Cache analytics
      await this.cacheService.set(cacheKey, analytics, 3600); // 1 hour

      return { success: true, data: analytics };
    } catch (error) {
      logger.error("Failed to get search analytics:", error);
      return {
        success: false,
        error: new Error("Failed to get search analytics"),
      };
    }
  }

  /**
   * Generate search trends data
   */
  private generateSearchTrends(): Array<{ date: string; searches: number }> {
    const trends = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      trends.push({
        date: date.toISOString().split("T")[0],
        searches: Math.floor(Math.random() * 100) + 10, // Simplified
      });
    }

    return trends;
  }

  /**
   * Get popular content based on search patterns
   */
  private getPopularContent(
    tenantId?: string
  ): Array<{ id: string; title: string; searchCount: number }> {
    const contentPopularity = new Map<string, number>();

    // Analyze search queries to determine popular content (simplified)
    for (const [_docId, document] of this.searchIndex.entries()) {
      if (tenantId && document.tenantId !== tenantId) {
        continue;
      }

      if (document.type === "content" && document.title) {
        // Simplified popularity calculation
        const popularity = Math.floor(Math.random() * 50) + 1;
        contentPopularity.set(document.id, popularity);
      }
    }

    return Array.from(contentPopularity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => {
        const doc = this.searchIndex.get(`content:${id}`);
        return {
          id,
          title: doc?.title || "Unknown",
          searchCount: count,
        };
      });
  }

  /**
   * Reindex all content for a tenant
   */
  async reindexTenant(tenantId: string): Promise<Result<void, Error>> {
    try {
      logger.info(`Starting reindex for tenant: ${tenantId}`);

      // Remove existing tenant data from both indexes
      const keysToRemove: string[] = [];

      for (const [docId, document] of this.searchIndex.entries()) {
        if (document.tenantId === tenantId) {
          keysToRemove.push(docId);
          // Remove from inverted index
          this.removeFromInvertedIndex(docId, document.searchableText);
        }
      }

      // Remove from main index
      for (const key of keysToRemove) {
        this.searchIndex.delete(key);
      }

      // Clear tenant-specific cache
      await this.cacheService.invalidatePattern(`search:*${tenantId}*`);
      await this.cacheService.invalidatePattern(`suggestions:*${tenantId}*`);

      // Cache the updated index
      await this.cacheIndex();

      logger.info(
        `Reindexed search data for tenant: ${tenantId} (removed ${keysToRemove.length} documents)`
      );

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Failed to reindex tenant ${tenantId}:`, error);
      return {
        success: false,
        error: new Error("Failed to reindex tenant"),
      };
    }
  }

  /**
   * Bulk index multiple documents
   */
  async bulkIndex(
    documents: Array<
      { type: "content"; data: Content } | { type: "media"; data: Media }
    >
  ): Promise<Result<{ indexed: number; failed: number }, Error>> {
    try {
      let indexed = 0;
      let failed = 0;

      for (const doc of documents) {
        try {
          if (doc.type === "content") {
            await this.indexContent(doc.data);
          } else {
            await this.indexMedia(doc.data);
          }
          indexed++;
        } catch (error) {
          logger.error(`Failed to index ${doc.type} ${doc.data.id}:`, error);
          failed++;
        }
      }

      logger.info(`Bulk index completed: ${indexed} indexed, ${failed} failed`);

      return { success: true, data: { indexed, failed } };
    } catch (error) {
      logger.error("Bulk index failed:", error);
      return {
        success: false,
        error: new Error("Bulk index failed"),
      };
    }
  }

  /**
   * Optimize search index
   */
  async optimizeIndex(): Promise<Result<void, Error>> {
    try {
      logger.info("Starting search index optimization");

      // Remove empty entries from inverted index
      for (const [token, docIds] of this.invertedIndex.entries()) {
        if (docIds.size === 0) {
          this.invertedIndex.delete(token);
        }
      }

      // Update cache
      await this.cacheIndex();

      logger.info("Search index optimization completed");

      return { success: true, data: undefined };
    } catch (error) {
      logger.error("Failed to optimize search index:", error);
      return {
        success: false,
        error: new Error("Failed to optimize search index"),
      };
    }
  }

  /**
   * Get comprehensive search index statistics
   */
  async getIndexStats(): Promise<{
    totalItems: number;
    contentItems: number;
    mediaItems: number;
    indexSize: number;
    invertedIndexSize: number;
    averageDocumentSize: number;
    topTokens: Array<{ token: string; frequency: number }>;
    memoryUsage: string;
  }> {
    try {
      let contentItems = 0;
      let mediaItems = 0;
      let totalTextLength = 0;

      for (const [_docId, document] of this.searchIndex.entries()) {
        if (document.type === "content") {
          contentItems++;
        } else if (document.type === "media") {
          mediaItems++;
        }
        totalTextLength += document.searchableText.length;
      }

      // Get top tokens
      const tokenFrequency = new Map<string, number>();
      for (const [token, docIds] of this.invertedIndex.entries()) {
        tokenFrequency.set(token, docIds.size);
      }

      const topTokens = Array.from(tokenFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([token, frequency]) => ({ token, frequency }));

      const averageDocumentSize =
        this.searchIndex.size > 0 ? totalTextLength / this.searchIndex.size : 0;

      // Estimate memory usage (simplified)
      const estimatedMemory =
        this.searchIndex.size * 1000 + this.invertedIndex.size * 100;
      const memoryUsage = `${(estimatedMemory / 1024 / 1024).toFixed(2)}MB`;

      return {
        totalItems: this.searchIndex.size,
        contentItems,
        mediaItems,
        indexSize: this.searchIndex.size,
        invertedIndexSize: this.invertedIndex.size,
        averageDocumentSize: Math.round(averageDocumentSize),
        topTokens,
        memoryUsage,
      };
    } catch (error) {
      logger.error("Failed to get index stats:", error);
      return {
        totalItems: 0,
        contentItems: 0,
        mediaItems: 0,
        indexSize: 0,
        invertedIndexSize: 0,
        averageDocumentSize: 0,
        topTokens: [],
        memoryUsage: "0MB",
      };
    }
  }

  /**
   * Health check for search service
   */
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    indexSize: number;
    cacheConnected: boolean;
    lastOptimization?: Date;
  }> {
    try {
      const cacheHealthy = await this.cacheService.healthCheck();
      const indexSize = this.searchIndex.size;

      let status: "healthy" | "degraded" | "unhealthy" = "healthy";

      if (!cacheHealthy) {
        status = "degraded";
      }

      if (indexSize === 0) {
        status = "unhealthy";
      }

      return {
        status,
        indexSize,
        cacheConnected: cacheHealthy,
      };
    } catch (error) {
      logger.error("Search service health check failed:", error);
      return {
        status: "unhealthy",
        indexSize: 0,
        cacheConnected: false,
      };
    }
  }
}

/**
 * Utility functions for modules
 */

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Parse pagination parameters from query string
 */
export function parsePaginationParams(
  query: Record<string, unknown>
): PaginationParams {
  const page = Math.max(1, parseInt((query.page as string) || "1", 10));
  const limit = Math.max(
    1,
    Math.min(100, parseInt((query.limit as string) || "20", 10))
  );

  return { page, limit };
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(
  totalCount: number,
  page: number,
  limit: number
): PaginationResult<never>["pagination"] {
  const totalPages = Math.ceil(totalCount / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    page,
    limit,
    totalPages,
    totalCount,
    hasNext,
    hasPrev,
  };
}

/**
 * Apply pagination to a query
 */
export function applyPagination(
  page: number,
  limit: number
): { offset: number; limit: number } {
  const offset = (page - 1) * limit;
  return { offset, limit };
}

/**
 * Format API response with pagination
 */
export function formatPaginatedResponse<T>(
  data: T[],
  totalCount: number,
  page: number,
  limit: number
): PaginationResult<T> {
  return {
    data,
    pagination: calculatePagination(totalCount, page, limit),
  };
}

/**
 * Parse sort parameters from query string
 */
export function parseSortParams(query: Record<string, unknown>): {
  sortBy?: string | undefined;
  sortOrder: "asc" | "desc";
};
export function parseSortParams(
  query: Record<string, unknown>,
  defaultField: string,
  defaultDirection: "asc" | "desc"
): {
  field: string;
  direction: "asc" | "desc";
};
export function parseSortParams(
  query: Record<string, unknown>,
  defaultField?: string,
  defaultDirection?: "asc" | "desc"
): any {
  if (defaultField && defaultDirection) {
    const field = (query.sortBy as string) || defaultField;
    const direction =
      (query.sortOrder as string)?.toLowerCase() === "desc"
        ? "desc"
        : (query.sortOrder as string)?.toLowerCase() === "asc"
          ? "asc"
          : defaultDirection;

    return { field, direction };
  }
  const sortBy = query.sortBy as string | undefined;
  const sortOrder =
    (query.sortOrder as string)?.toLowerCase() === "desc" ? "desc" : "asc";

  return { sortBy, sortOrder };
}

/**
 * Parse date range from query string
 */
export function parseDateRange(query: Record<string, unknown>): {
  startDate?: Date | undefined;
  endDate?: Date | undefined;
} {
  const startDateStr = query.startDate as string | undefined;
  const endDateStr = query.endDate as string | undefined;

  const startDate = startDateStr ? new Date(startDateStr) : undefined;
  const endDate = endDateStr ? new Date(endDateStr) : undefined;

  // Validate dates
  if (startDate && Number.isNaN(startDate.getTime())) {
    throw new Error("Invalid startDate format");
  }
  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new Error("Invalid endDate format");
  }

  return {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };
}

/**
 * Parse search parameters from query string
 */
export function parseSearchParams(query: Record<string, unknown>): {
  search?: string | undefined;
  searchFields?: string[] | undefined;
} {
  const search = query.search as string | undefined;
  const searchFieldsRaw = query.searchFields;
  const searchFields = searchFieldsRaw
    ? ((Array.isArray(searchFieldsRaw)
        ? searchFieldsRaw
        : [searchFieldsRaw]) as string[])
    : undefined;

  return {
    search: search || undefined,
    searchFields: searchFields || undefined,
  };
}

/**
 * Sanitize string for database queries
 */
export function sanitizeString(input: string): string {
  return input.trim().replace(/[^\w\s-]/gi, "");
}

/**
 * Convert string to slug format
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Generate random string
 */
export function generateRandomString(length: number): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (Array.isArray(obj)) return obj.map(deepClone) as unknown as T;

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

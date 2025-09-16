/**
 * Standardized API response utilities
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
    timestamp?: string;
  };
  meta?: {
    requestId?: string;
    timestamp: string;
    version: string;
    processingTime?: number;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  links?: {
    self?: string;
    first?: string;
    last?: string;
    next?: string;
    prev?: string;
  };
}

export class ResponseBuilder {
  static success<T>(
    data: T,
    meta?: Partial<ApiResponse["meta"]>,
    pagination?: Partial<ApiResponse["pagination"]>,
    links?: ApiResponse["links"]
  ): ApiResponse<T> {
    const response: ApiResponse<T> = {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: "v1",
        ...meta,
      },
    };

    if (pagination) {
      const totalPages = Math.ceil(
        (pagination.total || 0) / (pagination.limit || 20)
      );
      response.pagination = {
        page: pagination.page || 1,
        limit: pagination.limit || 20,
        total: pagination.total || 0,
        totalPages,
        hasNext: (pagination.page || 1) < totalPages,
        hasPrev: (pagination.page || 1) > 1,
        ...pagination,
      };
    }

    if (links) {
      response.links = links;
    }

    return response;
  }

  static error(
    message: string,
    code?: string,
    details?: any,
    meta?: Partial<ApiResponse["meta"]>
  ): ApiResponse {
    return {
      success: false,
      error: {
        message,
        code,
        details,
        timestamp: new Date().toISOString(),
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: "v1",
        ...meta,
      },
    };
  }

  static paginated<T>(
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
    },
    baseUrl?: string,
    meta?: Partial<ApiResponse["meta"]>
  ): ApiResponse<T[]> {
    const totalPages = Math.ceil(pagination.total / pagination.limit);
    const hasNext = pagination.page < totalPages;
    const hasPrev = pagination.page > 1;

    const links: ApiResponse["links"] = {};

    if (baseUrl) {
      links.self = `${baseUrl}?page=${pagination.page}&limit=${pagination.limit}`;
      links.first = `${baseUrl}?page=1&limit=${pagination.limit}`;
      links.last = `${baseUrl}?page=${totalPages}&limit=${pagination.limit}`;

      if (hasNext) {
        links.next = `${baseUrl}?page=${pagination.page + 1}&limit=${
          pagination.limit
        }`;
      }

      if (hasPrev) {
        links.prev = `${baseUrl}?page=${pagination.page - 1}&limit=${
          pagination.limit
        }`;
      }
    }

    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        version: "v1",
        ...meta,
      },
      pagination: {
        ...pagination,
        totalPages,
        hasNext,
        hasPrev,
      },
      links,
    };
  }

  static created<T>(
    data: T,
    location?: string,
    meta?: Partial<ApiResponse["meta"]>
  ): ApiResponse<T> {
    const response = this.success(data, meta);

    if (location) {
      response.links = {
        self: location,
      };
    }

    return response;
  }

  static noContent(meta?: Partial<ApiResponse["meta"]>): ApiResponse<null> {
    return {
      success: true,
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        version: "v1",
        ...meta,
      },
    };
  }
}

export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // Client Error
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  CONFLICT: 409,
  GONE: 410,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // Server Error
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

/**
 * Response utilities unit tests
 */

import { describe, it, expect } from "vitest";
import { ResponseBuilder, HTTP_STATUS } from "../response.utils";

describe("ResponseBuilder", () => {
  describe("success", () => {
    it("should create a successful response", () => {
      const data = { id: "123", name: "Test" };
      const response = ResponseBuilder.success(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.meta).toBeDefined();
      expect(response.meta?.timestamp).toBeDefined();
      expect(response.meta?.version).toBe("v1");
    });

    it("should include custom meta data", () => {
      const data = { id: "123" };
      const meta = { requestId: "req-123", processingTime: 150 };
      const response = ResponseBuilder.success(data, meta);

      expect(response.meta?.requestId).toBe("req-123");
      expect(response.meta?.processingTime).toBe(150);
      expect(response.meta?.version).toBe("v1");
    });

    it("should include pagination data", () => {
      const data = [{ id: "1" }, { id: "2" }];
      const pagination = { page: 1, limit: 10, total: 25 };
      const response = ResponseBuilder.success(data, undefined, pagination);

      expect(response.pagination).toBeDefined();
      expect(response.pagination?.page).toBe(1);
      expect(response.pagination?.limit).toBe(10);
      expect(response.pagination?.total).toBe(25);
      expect(response.pagination?.totalPages).toBe(3);
      expect(response.pagination?.hasNext).toBe(true);
      expect(response.pagination?.hasPrev).toBe(false);
    });

    it("should include links", () => {
      const data = { id: "123" };
      const links = { self: "/api/v1/items/123" };
      const response = ResponseBuilder.success(
        data,
        undefined,
        undefined,
        links
      );

      expect(response.links).toEqual(links);
    });
  });

  describe("error", () => {
    it("should create an error response", () => {
      const message = "Something went wrong";
      const code = "INTERNAL_ERROR";
      const response = ResponseBuilder.error(message, code);

      expect(response.success).toBe(false);
      expect(response.error?.message).toBe(message);
      expect(response.error?.code).toBe(code);
      expect(response.error?.timestamp).toBeDefined();
      expect(response.meta).toBeDefined();
    });

    it("should include error details", () => {
      const message = "Validation failed";
      const code = "VALIDATION_ERROR";
      const details = { field: "email", reason: "invalid format" };
      const response = ResponseBuilder.error(message, code, details);

      expect(response.error?.details).toEqual(details);
    });

    it("should include custom meta data", () => {
      const meta = { requestId: "req-456" };
      const response = ResponseBuilder.error("Error", "CODE", undefined, meta);

      expect(response.meta?.requestId).toBe("req-456");
    });
  });

  describe("paginated", () => {
    it("should create a paginated response", () => {
      const data = [{ id: "1" }, { id: "2" }];
      const pagination = { page: 2, limit: 5, total: 12 };
      const response = ResponseBuilder.paginated(data, pagination);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.pagination?.page).toBe(2);
      expect(response.pagination?.limit).toBe(5);
      expect(response.pagination?.total).toBe(12);
      expect(response.pagination?.totalPages).toBe(3);
      expect(response.pagination?.hasNext).toBe(true);
      expect(response.pagination?.hasPrev).toBe(true);
    });

    it("should generate pagination links when baseUrl provided", () => {
      const data = [{ id: "1" }];
      const pagination = { page: 2, limit: 5, total: 12 };
      const baseUrl = "/api/v1/items";
      const response = ResponseBuilder.paginated(data, pagination, baseUrl);

      expect(response.links?.self).toBe("/api/v1/items?page=2&limit=5");
      expect(response.links?.first).toBe("/api/v1/items?page=1&limit=5");
      expect(response.links?.last).toBe("/api/v1/items?page=3&limit=5");
      expect(response.links?.next).toBe("/api/v1/items?page=3&limit=5");
      expect(response.links?.prev).toBe("/api/v1/items?page=1&limit=5");
    });

    it("should handle first page correctly", () => {
      const data = [{ id: "1" }];
      const pagination = { page: 1, limit: 5, total: 12 };
      const baseUrl = "/api/v1/items";
      const response = ResponseBuilder.paginated(data, pagination, baseUrl);

      expect(response.pagination?.hasNext).toBe(true);
      expect(response.pagination?.hasPrev).toBe(false);
      expect(response.links?.next).toBe("/api/v1/items?page=2&limit=5");
      expect(response.links?.prev).toBeUndefined();
    });

    it("should handle last page correctly", () => {
      const data = [{ id: "1" }];
      const pagination = { page: 3, limit: 5, total: 12 };
      const baseUrl = "/api/v1/items";
      const response = ResponseBuilder.paginated(data, pagination, baseUrl);

      expect(response.pagination?.hasNext).toBe(false);
      expect(response.pagination?.hasPrev).toBe(true);
      expect(response.links?.next).toBeUndefined();
      expect(response.links?.prev).toBe("/api/v1/items?page=2&limit=5");
    });
  });

  describe("created", () => {
    it("should create a created response", () => {
      const data = { id: "123", name: "New Item" };
      const location = "/api/v1/items/123";
      const response = ResponseBuilder.created(data, location);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.links?.self).toBe(location);
    });

    it("should work without location", () => {
      const data = { id: "123" };
      const response = ResponseBuilder.created(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.links).toBeUndefined();
    });
  });

  describe("noContent", () => {
    it("should create a no content response", () => {
      const response = ResponseBuilder.noContent();

      expect(response.success).toBe(true);
      expect(response.data).toBe(null);
      expect(response.meta).toBeDefined();
    });

    it("should include custom meta data", () => {
      const meta = { requestId: "req-789" };
      const response = ResponseBuilder.noContent(meta);

      expect(response.meta?.requestId).toBe("req-789");
    });
  });
});

describe("HTTP_STATUS", () => {
  it("should have all required status codes", () => {
    expect(HTTP_STATUS.OK).toBe(200);
    expect(HTTP_STATUS.CREATED).toBe(201);
    expect(HTTP_STATUS.NO_CONTENT).toBe(204);
    expect(HTTP_STATUS.BAD_REQUEST).toBe(400);
    expect(HTTP_STATUS.UNAUTHORIZED).toBe(401);
    expect(HTTP_STATUS.FORBIDDEN).toBe(403);
    expect(HTTP_STATUS.NOT_FOUND).toBe(404);
    expect(HTTP_STATUS.CONFLICT).toBe(409);
    expect(HTTP_STATUS.UNPROCESSABLE_ENTITY).toBe(422);
    expect(HTTP_STATUS.TOO_MANY_REQUESTS).toBe(429);
    expect(HTTP_STATUS.INTERNAL_SERVER_ERROR).toBe(500);
    expect(HTTP_STATUS.SERVICE_UNAVAILABLE).toBe(503);
  });
});

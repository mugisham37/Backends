/**
 * API standardization unit tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { RestApiRouter } from "../index";

describe("API Standardization", () => {
  let app: express.Application;

  beforeEach(() => {
    // Set test environment to disable middleware
    process.env.NODE_ENV = "test";

    app = express();
    app.use(express.json());

    const restApiRouter = new RestApiRouter();
    app.use("/api/v1", restApiRouter.getRouter());
  });

  describe("Response Format", () => {
    it("should return standardized success response for API info", async () => {
      const response = await request(app).get("/api/v1/").expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          name: "E-commerce REST API",
          version: "v1",
          description: expect.any(String),
          endpoints: expect.any(Object),
          features: expect.any(Array),
        },
        meta: {
          timestamp: expect.any(String),
          version: "v1",
          requestId: expect.any(String),
        },
      });
    });

    it("should return standardized success response for health check", async () => {
      const response = await request(app).get("/api/v1/health").expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: "healthy",
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          version: expect.any(String),
          environment: expect.any(String),
        },
        meta: {
          timestamp: expect.any(String),
          version: "v1",
          requestId: expect.any(String),
        },
      });
    });

    it("should return standardized error response for 404", async () => {
      const response = await request(app)
        .get("/api/v1/nonexistent")
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringContaining(
            "Route GET /api/v1/nonexistent not found"
          ),
          code: "ROUTE_NOT_FOUND",
          timestamp: expect.any(String),
        },
        meta: {
          timestamp: expect.any(String),
          version: "v1",
          requestId: expect.any(String),
        },
      });
    });
  });

  describe("Headers", () => {
    it("should include basic headers", async () => {
      const response = await request(app).get("/api/v1/health").expect(200);

      expect(response.headers["x-request-id"]).toBeDefined();
      expect(response.headers["x-api-version"]).toBe("v1");
      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });

    it("should handle API versioning from header", async () => {
      const response = await request(app)
        .get("/api/v1/health")
        .set("API-Version", "v1")
        .expect(200);

      expect(response.headers["x-api-version"]).toBe("v1");
    });

    it("should reject unsupported API version", async () => {
      const response = await request(app)
        .get("/api/v1/health")
        .set("API-Version", "v2")
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringContaining("API version v2 is not supported"),
          code: "UNSUPPORTED_API_VERSION",
        },
      });
    });
  });

  describe("Request ID Correlation", () => {
    it("should use provided request ID", async () => {
      const customRequestId = "custom-request-123";

      const response = await request(app)
        .get("/api/v1/health")
        .set("X-Request-ID", customRequestId)
        .expect(200);

      expect(response.headers["x-request-id"]).toBe(customRequestId);
      expect(response.body.meta.requestId).toBe(customRequestId);
    });

    it("should generate request ID if not provided", async () => {
      const response = await request(app).get("/api/v1/health").expect(200);

      expect(response.headers["x-request-id"]).toBeDefined();
      expect(response.body.meta.requestId).toBeDefined();
      expect(response.headers["x-request-id"]).toBe(
        response.body.meta.requestId
      );
    });
  });
});

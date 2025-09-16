import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createApp } from "../../app";
import type { FastifyInstance } from "fastify";

describe("Content Management REST Endpoints", () => {
  let app: FastifyInstance;
  let accessToken: string;
  let contentId: string;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();

    // Get authentication token
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "test@example.com",
        password: "password123",
      },
    });

    const loginBody = JSON.parse(loginResponse.payload);
    accessToken = loginBody.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/v1/content", () => {
    it("should create new content", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/content",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          title: "Test Content",
          slug: "test-content",
          body: "This is test content body",
          status: "draft",
          tags: ["test", "content"],
          metadata: {
            description: "Test content description",
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.title).toBe("Test Content");
      expect(body.data.slug).toBe("test-content");
      expect(body.data.status).toBe("draft");

      contentId = body.data.id; // Store for other tests
    });

    it("should validate required fields", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/content",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          body: "Content without title",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBeDefined();
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/content",
        payload: {
          title: "Test Content",
          body: "Test body",
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/content", () => {
    it("should get content list with pagination", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/content?page=1&limit=10",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.items).toBeInstanceOf(Array);
      expect(body.data.total).toBeTypeOf("number");
      expect(body.data.page).toBe(1);
      expect(body.data.limit).toBe(10);
      expect(body.data.hasMore).toBeTypeOf("boolean");
    });

    it("should filter content by status", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/content?status=draft",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.items).toBeInstanceOf(Array);
    });

    it("should search content", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/content?search=test",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.items).toBeInstanceOf(Array);
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/content",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/content/:id", () => {
    it("should get specific content by ID", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/content/${contentId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(contentId);
      expect(body.data.title).toBeDefined();
    });

    it("should return 404 for non-existent content", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/content/00000000-0000-0000-0000-000000000000",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Content Not Found");
    });

    it("should validate UUID format", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/content/invalid-id",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("PUT /api/v1/content/:id", () => {
    it("should update existing content", async () => {
      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/content/${contentId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          title: "Updated Test Content",
          body: "Updated content body",
          status: "published",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe("Updated Test Content");
      expect(body.data.status).toBe("published");
    });

    it("should return 404 for non-existent content", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/v1/content/00000000-0000-0000-0000-000000000000",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          title: "Updated Title",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("POST /api/v1/content/:id/publish", () => {
    it("should publish content", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/content/${contentId}/publish`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("published");
    });

    it("should return 404 for non-existent content", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/content/00000000-0000-0000-0000-000000000000/publish",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("GET /api/v1/content/:id/versions", () => {
    it("should get content versions", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/content/${contentId}/versions`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
    });
  });

  describe("DELETE /api/v1/content/:id", () => {
    it("should delete content", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/content/${contentId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.message).toBe("Content deleted successfully");
    });

    it("should return 404 for already deleted content", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/content/${contentId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});

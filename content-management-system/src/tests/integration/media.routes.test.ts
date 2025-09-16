import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createApp } from "../../app";
import type { FastifyInstance } from "fastify";
import { createReadStream } from "fs";
import { join } from "path";

describe("Media Management REST Endpoints", () => {
  let app: FastifyInstance;
  let accessToken: string;
  let mediaId: string;

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

  describe("GET /api/v1/media", () => {
    it("should get media list with pagination", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/media?page=1&limit=10",
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

    it("should filter media by type", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/media?type=image",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.items).toBeInstanceOf(Array);
    });

    it("should search media files", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/media?search=test",
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
        url: "/api/v1/media",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /api/v1/media/upload", () => {
    it("should upload a file successfully", async () => {
      // Create a test file buffer
      const testFileContent = Buffer.from("test file content");

      const form = new FormData();
      form.append("file", new Blob([testFileContent]), "test.txt");
      form.append("alt", "Test file");
      form.append("caption", "Test file caption");
      form.append("tags", JSON.stringify(["test", "upload"]));

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/media/upload",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: form,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.filename).toBeDefined();
      expect(body.data.url).toBeDefined();
      expect(body.data.size).toBeTypeOf("number");
      expect(body.data.mimetype).toBeDefined();

      mediaId = body.data.id; // Store for other tests
    });

    it("should reject upload without file", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/media/upload",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("File Upload Failed");
      expect(body.message).toBe("No file provided");
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/media/upload",
        payload: {},
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/media/:id", () => {
    it("should get specific media file by ID", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/media/${mediaId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(mediaId);
      expect(body.data.filename).toBeDefined();
      expect(body.data.url).toBeDefined();
    });

    it("should return 404 for non-existent media", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/media/00000000-0000-0000-0000-000000000000",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Media Not Found");
    });

    it("should validate UUID format", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/media/invalid-id",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("GET /api/v1/media/:id/metadata", () => {
    it("should get media metadata", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/media/${mediaId}/metadata`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(mediaId);
      expect(body.data.filename).toBeDefined();
      expect(body.data.size).toBeTypeOf("number");
      expect(body.data.mimetype).toBeDefined();
      // Should not include url or cdnUrl in metadata response
      expect(body.data.url).toBeUndefined();
      expect(body.data.cdnUrl).toBeUndefined();
    });
  });

  describe("POST /api/v1/media/:id/transform", () => {
    it("should process image transformations", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/media/${mediaId}/transform`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          width: 800,
          height: 600,
          quality: 80,
          format: "jpeg",
          fit: "cover",
        },
      });

      // This might return 400 if the file is not an image, which is expected for text files
      expect([200, 400]).toContain(response.statusCode);
      const body = JSON.parse(response.payload);

      if (response.statusCode === 200) {
        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();
      } else {
        expect(body.error).toBe("Image Processing Failed");
      }
    });

    it("should validate transformation parameters", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/media/${mediaId}/transform`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          width: -100, // Invalid width
          quality: 150, // Invalid quality
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /api/v1/media/:id/cdn-url", () => {
    it("should generate CDN URL", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/media/${mediaId}/cdn-url`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          expires: 3600,
          secure: true,
          transform: {
            width: 400,
            quality: 70,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.url).toBeDefined();
      expect(body.data.expires).toBeDefined();
    });

    it("should generate CDN URL with minimal options", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/media/${mediaId}/cdn-url`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.url).toBeDefined();
    });
  });

  describe("DELETE /api/v1/media/:id", () => {
    it("should delete media file", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/media/${mediaId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.message).toBe("Media file deleted successfully");
    });

    it("should return 404 for already deleted media", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/media/${mediaId}`,
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 404 for non-existent media", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/v1/media/00000000-0000-0000-0000-000000000000",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});

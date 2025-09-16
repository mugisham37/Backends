import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createApp } from "../../app";
import type { FastifyInstance } from "fastify";

describe("Authentication REST Endpoints", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/v1/auth/login", () => {
    it("should authenticate user with valid credentials", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "test@example.com",
          password: "password123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
      expect(body.data.user).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });

    it("should reject invalid credentials", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "test@example.com",
          password: "wrongpassword",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Authentication Failed");
      expect(body.message).toBeDefined();
    });

    it("should validate request body", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "invalid-email",
          password: "",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBeDefined();
    });
  });

  describe("POST /api/v1/auth/refresh", () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Get a valid refresh token first
      const loginResponse = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: "test@example.com",
          password: "password123",
        },
      });

      const loginBody = JSON.parse(loginResponse.payload);
      refreshToken = loginBody.data.refreshToken;
    });

    it("should refresh tokens with valid refresh token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: {
          refreshToken,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
    });

    it("should reject invalid refresh token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/refresh",
        payload: {
          refreshToken: "invalid-token",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("Token Refresh Failed");
    });
  });

  describe("POST /api/v1/auth/logout", () => {
    let accessToken: string;

    beforeEach(async () => {
      // Get a valid access token first
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

    it("should logout authenticated user", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.message).toBe("Logged out successfully");
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/auth/me", () => {
    let accessToken: string;

    beforeEach(async () => {
      // Get a valid access token first
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

    it("should return current user info", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it("should require authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

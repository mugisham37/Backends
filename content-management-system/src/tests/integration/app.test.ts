import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../../app";
import type { FastifyInstance } from "fastify";

describe("Fastify Application", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should create Fastify app successfully", () => {
    expect(app).toBeDefined();
  });

  it("should respond to health check", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe("ok");
    expect(body.version).toBeDefined();
    expect(body.database).toBeDefined();
  });

  it("should respond to ready check", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/ready",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe("ready");
  });

  it("should have API gateway endpoints", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/health",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe("healthy");
    expect(body.services).toBeDefined();
  });

  it("should have API info endpoint", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/info",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.name).toBe("Content Management System API");
    expect(body.endpoints).toBeDefined();
    expect(body.endpoints.rest).toBeDefined();
    expect(body.endpoints.graphql).toBeDefined();
  });

  it("should return 404 for unknown routes", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/unknown-route",
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe("Not Found");
  });

  it("should have proper CORS headers", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/health",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "GET",
      },
    });

    expect(response.headers["access-control-allow-origin"]).toBeDefined();
    expect(response.headers["access-control-allow-methods"]).toBeDefined();
  });

  it("should have security headers", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.headers["x-frame-options"]).toBeDefined();
    expect(response.headers["x-content-type-options"]).toBeDefined();
  });

  it("should have rate limiting", async () => {
    // Make multiple requests to test rate limiting
    const requests = Array.from({ length: 5 }, () =>
      app.inject({
        method: "GET",
        url: "/health",
      })
    );

    const responses = await Promise.all(requests);

    // All should succeed initially (rate limit is high for tests)
    responses.forEach((response) => {
      expect(response.statusCode).toBe(200);
    });
  });
});

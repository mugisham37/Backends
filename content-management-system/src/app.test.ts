import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "./app";
import type { FastifyInstance } from "fastify";

describe("Fastify App", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should create app successfully", () => {
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
    expect(body.timestamp).toBeDefined();
    expect(body.uptime).toBeDefined();
    expect(body.version).toBeDefined();
  });

  it("should handle 404 routes", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/non-existent-route",
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.payload);
    expect(body.error).toBe("Not Found");
    expect(body.message).toContain("Route GET:/non-existent-route not found");
  });

  it("should handle rate limiting", async () => {
    // Make multiple requests to trigger rate limiting
    const promises = Array.from({ length: 105 }, () =>
      app.inject({
        method: "GET",
        url: "/health",
      })
    );

    const responses = await Promise.all(promises);
    const rateLimitedResponses = responses.filter((r) => r.statusCode === 429);

    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });
});

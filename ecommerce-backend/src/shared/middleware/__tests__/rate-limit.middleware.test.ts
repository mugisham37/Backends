/**
 * Rate Limit Middleware Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";
import {
  RateLimitMiddleware,
  createRateLimitMiddleware,
} from "../rate-limit.middleware.js";
import { AppError } from "../../../core/errors/app-error.js";

// Mock Redis client
const mockPipeline = {
  incr: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
};

const mockRedis = {
  get: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  pipeline: vi.fn(() => mockPipeline),
  keys: vi.fn(),
  del: vi.fn(),
  setex: vi.fn(),
  decr: vi.fn(),
};

// Mock the Redis client module
vi.mock("../../modules/cache/redis.client.js", () => ({
  getRedisClient: () => mockRedis,
}));

describe("RateLimitMiddleware", () => {
  let middleware: RateLimitMiddleware;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    middleware = createRateLimitMiddleware(mockRedis);

    mockRequest = {
      ip: "127.0.0.1",
      headers: {},
      userId: undefined,
    };

    mockReply = {
      headers: vi.fn().mockReturnThis(),
      addHook: vi.fn(),
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("createRateLimit", () => {
    it("should allow requests within rate limit", async () => {
      const rateLimitHandler = middleware.createRateLimit({
        max: 10,
        window: 60000,
      });

      mockRedis.get.mockResolvedValue("5");
      mockRedis.pipeline().exec.mockResolvedValue([]);

      await expect(
        rateLimitHandler(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).resolves.toBeUndefined();

      expect(mockRedis.get).toHaveBeenCalled();
      expect(mockPipeline.incr).toHaveBeenCalled();
      expect(mockReply.headers).toHaveBeenCalledWith({
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": "4",
        "X-RateLimit-Reset": expect.any(String),
      });
    });

    it("should block requests exceeding rate limit", async () => {
      const rateLimitHandler = middleware.createRateLimit({
        max: 10,
        window: 60000,
      });

      mockRedis.get.mockResolvedValue("10");

      await expect(
        rateLimitHandler(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow(AppError);

      expect(mockReply.headers).toHaveBeenCalledWith({
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": expect.any(String),
      });
    });

    it("should use custom key generator", async () => {
      const customKeyGenerator = vi.fn().mockReturnValue("custom-key");
      const rateLimitHandler = middleware.createRateLimit({
        max: 10,
        window: 60000,
        keyGenerator: customKeyGenerator,
      });

      mockRedis.get.mockResolvedValue("0");
      mockRedis.pipeline().exec.mockResolvedValue([]);

      await rateLimitHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(customKeyGenerator).toHaveBeenCalledWith(mockRequest);
    });

    it("should handle Redis errors gracefully", async () => {
      const rateLimitHandler = middleware.createRateLimit({
        max: 10,
        window: 60000,
      });

      mockRedis.get.mockRejectedValue(new Error("Redis connection failed"));

      // Should not throw error when Redis fails
      await expect(
        rateLimitHandler(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).resolves.toBeUndefined();
    });

    it("should generate correct key for authenticated user", async () => {
      mockRequest.userId = "user123";

      const rateLimitHandler = middleware.createRateLimit({
        max: 10,
        window: 60000,
      });

      mockRedis.get.mockResolvedValue("0");
      mockRedis.pipeline().exec.mockResolvedValue([]);

      await rateLimitHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should use user ID in key
      expect(mockRedis.get).toHaveBeenCalledWith(
        expect.stringContaining("user:user123")
      );
    });

    it("should generate correct key for IP address", async () => {
      mockRequest.headers = { "x-forwarded-for": "192.168.1.1" };

      const rateLimitHandler = middleware.createRateLimit({
        max: 10,
        window: 60000,
      });

      mockRedis.get.mockResolvedValue("0");
      mockRedis.pipeline().exec.mockResolvedValue([]);

      await rateLimitHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Should use IP in key
      expect(mockRedis.get).toHaveBeenCalledWith(
        expect.stringContaining("ip:192.168.1.1")
      );
    });
  });

  describe("createBruteForceProtection", () => {
    it("should allow requests when not blocked", async () => {
      const bruteForceHandler = middleware.createBruteForceProtection({
        freeRetries: 3,
        minWait: 60000,
        maxWait: 3600000,
        lifetime: 86400000,
      });

      mockRedis.get.mockResolvedValue(null); // Not blocked

      await expect(
        bruteForceHandler(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).resolves.toBeUndefined();

      expect(mockReply.addHook).toHaveBeenCalledWith(
        "onSend",
        expect.any(Function)
      );
    });

    it("should block requests when IP is blocked", async () => {
      const bruteForceHandler = middleware.createBruteForceProtection({
        freeRetries: 3,
        minWait: 60000,
        maxWait: 3600000,
        lifetime: 86400000,
      });

      const blockTime = Date.now() + 60000;
      mockRedis.get.mockResolvedValue(blockTime.toString());

      await expect(
        bruteForceHandler(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow(AppError);
    });

    it("should clean up expired blocks", async () => {
      const bruteForceHandler = middleware.createBruteForceProtection({
        freeRetries: 3,
        minWait: 60000,
        maxWait: 3600000,
        lifetime: 86400000,
      });

      const expiredBlockTime = Date.now() - 1000;
      mockRedis.get.mockResolvedValue(expiredBlockTime.toString());

      await bruteForceHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe("utility methods", () => {
    it("should clear rate limit for specific key", async () => {
      mockRedis.keys.mockResolvedValue([
        "rate_limit:test:123",
        "rate_limit:test:456",
      ]);
      mockRedis.del.mockResolvedValue(2);

      await middleware.clearRateLimit("test");

      expect(mockRedis.keys).toHaveBeenCalledWith("rate_limit:test:*");
      expect(mockRedis.del).toHaveBeenCalledWith(
        "rate_limit:test:123",
        "rate_limit:test:456"
      );
    });

    it("should clear brute force protection for specific key", async () => {
      await middleware.clearBruteForce("test-key");

      expect(mockRedis.del).toHaveBeenCalledWith(
        "brute_force:attempts:test-key"
      );
      expect(mockRedis.del).toHaveBeenCalledWith("brute_force:block:test-key");
    });

    it("should get rate limit status", async () => {
      mockRedis.get.mockResolvedValue("5");

      const status = await middleware.getRateLimitStatus("test-key", 60000);

      expect(status).toEqual({
        count: 5,
        remaining: expect.any(Number),
        resetTime: expect.any(Number),
      });
    });
  });
});

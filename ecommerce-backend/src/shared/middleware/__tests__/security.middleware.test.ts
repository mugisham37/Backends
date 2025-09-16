/**
 * Security Middleware Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";
import { SecurityMiddleware } from "../security.middleware.js";
import { AppError } from "../../../core/errors/app-error.js";

describe("SecurityMiddleware", () => {
  let middleware: SecurityMiddleware;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    middleware = new SecurityMiddleware();

    mockRequest = {
      ip: "127.0.0.1",
      headers: {},
      body: undefined,
      query: undefined,
      params: undefined,
      method: "GET",
    };

    mockReply = {
      header: vi.fn().mockReturnThis(),
      removeHeader: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    vi.clearAllMocks();
  });

  describe("securityHeaders", () => {
    it("should set default security headers", async () => {
      const securityHandler = middleware.securityHeaders();

      await securityHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.header).toHaveBeenCalledWith(
        "Content-Security-Policy",
        expect.stringContaining("default-src 'self'")
      );
      expect(mockReply.header).toHaveBeenCalledWith(
        "X-Content-Type-Options",
        "nosniff"
      );
      expect(mockReply.header).toHaveBeenCalledWith("X-Frame-Options", "deny");
      expect(mockReply.header).toHaveBeenCalledWith(
        "X-XSS-Protection",
        "1; mode=block"
      );
      expect(mockReply.header).toHaveBeenCalledWith(
        "Referrer-Policy",
        "strict-origin-when-cross-origin"
      );
    });

    it("should set HSTS header in production", async () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const securityHandler = middleware.securityHeaders();
      await securityHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.header).toHaveBeenCalledWith(
        "Strict-Transport-Security",
        expect.stringContaining("max-age=31536000")
      );

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it("should allow custom CSP directives", async () => {
      const securityHandler = middleware.securityHeaders({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'", "https://api.example.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
          },
        },
      });

      await securityHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.header).toHaveBeenCalledWith(
        "Content-Security-Policy",
        "default-src 'self' https://api.example.com; script-src 'self' 'unsafe-inline'"
      );
    });

    it("should set CSP report-only header when specified", async () => {
      const securityHandler = middleware.securityHeaders({
        contentSecurityPolicy: {
          directives: { defaultSrc: ["'self'"] },
          reportOnly: true,
        },
      });

      await securityHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.header).toHaveBeenCalledWith(
        "Content-Security-Policy-Report-Only",
        expect.any(String)
      );
    });

    it("should hide X-Powered-By header", async () => {
      const securityHandler = middleware.securityHeaders();

      await securityHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.removeHeader).toHaveBeenCalledWith("X-Powered-By");
    });
  });

  describe("sanitizeInput", () => {
    it("should sanitize request body", async () => {
      mockRequest.body = {
        name: "<script>alert('xss')</script>John",
        email: "john@example.com",
        description: "A".repeat(15000), // Exceeds default max length
      };

      const sanitizeHandler = middleware.sanitizeInput();
      await sanitizeHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      const sanitizedBody = mockRequest.body as any;
      expect(sanitizedBody.name).toBe(
        "&lt;script&gt;alert('xss')&lt;&#x2F;script&gt;John"
      );
      expect(sanitizedBody.email).toBe("john@example.com");
      expect(sanitizedBody.description).toHaveLength(10000); // Truncated to max length
    });

    it("should sanitize query parameters", async () => {
      mockRequest.query = {
        search: "<img src=x onerror=alert(1)>",
        page: "1",
      };

      const sanitizeHandler = middleware.sanitizeInput();
      await sanitizeHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      const sanitizedQuery = mockRequest.query as any;
      expect(sanitizedQuery.search).toBe("&lt;img src=x &gt;");
      expect(sanitizedQuery.page).toBe("1");
    });

    it("should sanitize route parameters", async () => {
      mockRequest.params = {
        id: "123<script>",
        slug: "test-product",
      };

      const sanitizeHandler = middleware.sanitizeInput();
      await sanitizeHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      const sanitizedParams = mockRequest.params as any;
      expect(sanitizedParams.id).toBe("123&lt;script&gt;");
      expect(sanitizedParams.slug).toBe("test-product");
    });

    it("should sanitize nested objects", async () => {
      mockRequest.body = {
        user: {
          profile: {
            bio: "<script>malicious()</script>",
            tags: ["<b>tag1</b>", "tag2"],
          },
        },
      };

      const sanitizeHandler = middleware.sanitizeInput();
      await sanitizeHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      const sanitizedBody = mockRequest.body as any;
      expect(sanitizedBody.user.profile.bio).toBe(
        "&lt;script&gt;malicious()&lt;&#x2F;script&gt;"
      );
      expect(sanitizedBody.user.profile.tags[0]).toBe(
        "&lt;b&gt;tag1&lt;&#x2F;b&gt;"
      );
    });

    it("should remove dangerous patterns", async () => {
      mockRequest.body = {
        link: "javascript:alert(1)",
        script: "vbscript:malicious()",
        data: "data:text/html,<script>alert(1)</script>",
        event: "onclick=alert(1)",
      };

      const sanitizeHandler = middleware.sanitizeInput();
      await sanitizeHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      const sanitizedBody = mockRequest.body as any;
      expect(sanitizedBody.link).toBe("alert(1)");
      expect(sanitizedBody.script).toBe("malicious()");
      expect(sanitizedBody.data).toBe(
        "text&#x2F;html,&lt;script&gt;alert(1)&lt;&#x2F;script&gt;"
      );
      expect(sanitizedBody.event).toBe("alert(1)");
    });

    it("should handle null bytes", async () => {
      mockRequest.body = {
        malicious: "test\0null\0byte",
      };

      const sanitizeHandler = middleware.sanitizeInput();
      await sanitizeHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      const sanitizedBody = mockRequest.body as any;
      expect(sanitizedBody.malicious).toBe("testnullbyte");
    });

    it("should respect custom max length", async () => {
      mockRequest.body = {
        text: "A".repeat(1000),
      };

      const sanitizeHandler = middleware.sanitizeInput({ maxLength: 500 });
      await sanitizeHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      const sanitizedBody = mockRequest.body as any;
      expect(sanitizedBody.text).toHaveLength(500);
    });
  });

  describe("corsMiddleware", () => {
    it("should set CORS headers for allowed origin", async () => {
      mockRequest.headers = { origin: "https://example.com" };

      const corsHandler = middleware.corsMiddleware({
        origin: ["https://example.com", "https://app.example.com"],
      });

      await corsHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.header).toHaveBeenCalledWith(
        "Access-Control-Allow-Origin",
        "https://example.com"
      );
    });

    it("should not set CORS headers for disallowed origin", async () => {
      mockRequest.headers = { origin: "https://malicious.com" };

      const corsHandler = middleware.corsMiddleware({
        origin: ["https://example.com"],
      });

      await corsHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.header).not.toHaveBeenCalledWith(
        "Access-Control-Allow-Origin",
        expect.any(String)
      );
    });

    it("should handle preflight requests", async () => {
      mockRequest.method = "OPTIONS";

      const corsHandler = middleware.corsMiddleware();
      await corsHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.header).toHaveBeenCalledWith(
        "Access-Control-Allow-Methods",
        expect.stringContaining("GET, POST, PUT, DELETE, OPTIONS")
      );
      expect(mockReply.status).toHaveBeenCalledWith(204);
      expect(mockReply.send).toHaveBeenCalled();
    });

    it("should set credentials header when enabled", async () => {
      const corsHandler = middleware.corsMiddleware({ credentials: true });
      await corsHandler(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.header).toHaveBeenCalledWith(
        "Access-Control-Allow-Credentials",
        "true"
      );
    });
  });

  describe("requestSizeLimit", () => {
    it("should allow requests within size limit", async () => {
      mockRequest.headers = { "content-length": "1000" };

      const sizeHandler = middleware.requestSizeLimit(2000);

      await expect(
        sizeHandler(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).resolves.toBeUndefined();
    });

    it("should reject requests exceeding size limit", async () => {
      mockRequest.headers = { "content-length": "3000" };

      const sizeHandler = middleware.requestSizeLimit(2000);

      await expect(
        sizeHandler(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow(AppError);
    });

    it("should allow requests without content-length header", async () => {
      const sizeHandler = middleware.requestSizeLimit(2000);

      await expect(
        sizeHandler(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).resolves.toBeUndefined();
    });
  });

  describe("ipFilter", () => {
    it("should allow whitelisted IPs", async () => {
      mockRequest.ip = "192.168.1.100";

      const ipHandler = middleware.ipFilter({
        whitelist: ["192.168.1.100", "10.0.0.1"],
      });

      await expect(
        ipHandler(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).resolves.toBeUndefined();
    });

    it("should block non-whitelisted IPs", async () => {
      mockRequest.ip = "192.168.1.200";

      const ipHandler = middleware.ipFilter({
        whitelist: ["192.168.1.100"],
      });

      await expect(
        ipHandler(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow(AppError);
    });

    it("should block blacklisted IPs", async () => {
      mockRequest.ip = "192.168.1.100";

      const ipHandler = middleware.ipFilter({
        blacklist: ["192.168.1.100"],
      });

      await expect(
        ipHandler(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow(AppError);
    });

    it("should extract IP from X-Forwarded-For header", async () => {
      mockRequest.headers = { "x-forwarded-for": "203.0.113.1, 192.168.1.1" };

      const ipHandler = middleware.ipFilter({
        blacklist: ["203.0.113.1"],
      });

      await expect(
        ipHandler(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow(AppError);
    });

    it("should extract IP from X-Real-IP header", async () => {
      mockRequest.headers = { "x-real-ip": "203.0.113.1" };

      const ipHandler = middleware.ipFilter({
        blacklist: ["203.0.113.1"],
      });

      await expect(
        ipHandler(mockRequest as FastifyRequest, mockReply as FastifyReply)
      ).rejects.toThrow(AppError);
    });
  });
});

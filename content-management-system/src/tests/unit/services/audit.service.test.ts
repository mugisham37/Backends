import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { AuditService } from "../../../services/audit.service";
import type { CacheService } from "../../../services/cache.service";

// Mock the logger
vi.mock("../../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  createModuleLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  })),
}));

describe("AuditService", () => {
  let auditService: AuditService;
  let mockCacheService: {
    get: Mock;
    set: Mock;
    del: Mock;
  };

  beforeEach(() => {
    // Create mock cache service
    mockCacheService = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };

    // Create audit service with mocked dependencies
    auditService = new AuditService(mockCacheService as any);
  });

  describe("logAuthAttempt", () => {
    it("should log successful authentication attempt", async () => {
      const authData = {
        userId: "user-123",
        email: "test@example.com",
        success: true,
        ip: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        sessionId: "session-123",
        tenantId: "tenant-123",
      };

      mockCacheService.get.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(true);

      const result = await auditService.logAuthAttempt(authData);

      expect(result.success).toBe(true);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "audit:recent:auth_success",
        expect.any(Array),
        3600
      );
    });

    it("should log failed authentication attempt with higher severity", async () => {
      const authData = {
        email: "test@example.com",
        success: false,
        reason: "Invalid password",
        ip: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      };

      mockCacheService.get.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(true);

      const result = await auditService.logAuthAttempt(authData);

      expect(result.success).toBe(true);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "audit:recent:auth_failure",
        expect.any(Array),
        3600
      );
    });

    it("should handle cache errors gracefully", async () => {
      const authData = {
        email: "test@example.com",
        success: true,
      };

      mockCacheService.get.mockRejectedValue(new Error("Cache error"));
      mockCacheService.set.mockRejectedValue(new Error("Cache error"));

      const result = await auditService.logAuthAttempt(authData);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe("logSecurityEvent", () => {
    it("should log security event with appropriate severity", async () => {
      const securityData = {
        userId: "user-123",
        tenantId: "tenant-123",
        event: "suspicious_login",
        details: { attempts: 5, timeWindow: "5min" },
        ip: "192.168.1.1",
        severity: "high" as const,
      };

      mockCacheService.get.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(true);

      const result = await auditService.logSecurityEvent(securityData);

      expect(result.success).toBe(true);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "audit:recent:security_event",
        expect.any(Array),
        3600
      );
    });

    it("should handle critical security events with special processing", async () => {
      const criticalData = {
        userId: "user-123",
        event: "data_breach_attempt",
        details: { affectedRecords: 1000 },
        severity: "critical" as const,
      };

      mockCacheService.get.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(true);

      const result = await auditService.logSecurityEvent(criticalData);

      expect(result.success).toBe(true);
      // Should increment critical event counter
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "metrics:security:critical",
        1,
        3600
      );
    });
  });

  describe("logApiRequest", () => {
    it("should log API request with performance metrics", async () => {
      const requestData = {
        method: "GET",
        url: "/api/v1/users",
        statusCode: 200,
        responseTime: 150,
        userId: "user-123",
        tenantId: "tenant-123",
        ip: "192.168.1.1",
        requestId: "req-123",
      };

      mockCacheService.get.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(true);

      const result = await auditService.logApiRequest(requestData);

      expect(result.success).toBe(true);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "audit:recent:api_request",
        expect.any(Array),
        3600
      );
    });

    it("should track slow requests appropriately", async () => {
      const slowRequestData = {
        method: "POST",
        url: "/api/v1/content",
        statusCode: 201,
        responseTime: 2500, // Slow request
        userId: "user-123",
      };

      mockCacheService.get.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(true);

      const result = await auditService.logApiRequest(slowRequestData);

      expect(result.success).toBe(true);
      // Should be tagged as slow
      const setCall = mockCacheService.set.mock.calls.find(
        (call) => call[0] === "audit:recent:api_request"
      );
      const auditEvent = setCall[1][0];
      expect(auditEvent.tags).toContain("slow");
    });

    it("should track error requests with medium severity", async () => {
      const errorRequestData = {
        method: "DELETE",
        url: "/api/v1/users/123",
        statusCode: 404,
        responseTime: 50,
        userId: "user-123",
      };

      mockCacheService.get.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(true);

      const result = await auditService.logApiRequest(errorRequestData);

      expect(result.success).toBe(true);
      const setCall = mockCacheService.set.mock.calls.find(
        (call) => call[0] === "audit:recent:api_request"
      );
      const auditEvent = setCall[1][0];
      expect(auditEvent.severity).toBe("medium");
      expect(auditEvent.tags).toContain("error");
    });
  });

  describe("logPerformanceMetrics", () => {
    it("should log performance metrics with trend analysis", async () => {
      const performanceData = {
        operation: "database_query",
        duration: 250,
        userId: "user-123",
        tenantId: "tenant-123",
        metadata: { query: "SELECT * FROM users" },
      };

      mockCacheService.get.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(true);

      const result = await auditService.logPerformanceMetrics(performanceData);

      expect(result.success).toBe(true);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "audit:recent:performance_metrics",
        expect.any(Array),
        3600
      );
    });

    it("should identify very slow operations", async () => {
      const verySlowData = {
        operation: "file_processing",
        duration: 7000, // Very slow
        userId: "user-123",
      };

      mockCacheService.get.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(true);

      const result = await auditService.logPerformanceMetrics(verySlowData);

      expect(result.success).toBe(true);
      const setCall = mockCacheService.set.mock.calls.find(
        (call) => call[0] === "audit:recent:performance_metrics"
      );
      const auditEvent = setCall[1][0];
      expect(auditEvent.severity).toBe("high");
      expect(auditEvent.tags).toContain("very_slow");
    });
  });

  describe("getSystemMetrics", () => {
    it("should aggregate system metrics from cache", async () => {
      // Mock cache data for different minutes
      mockCacheService.get
        .mockResolvedValueOnce(10) // requests
        .mockResolvedValueOnce(2) // errors
        .mockResolvedValueOnce([100, 150, 200]) // response times
        .mockResolvedValueOnce(1) // slow operations
        .mockResolvedValueOnce(5) // security events
        .mockResolvedValueOnce(0); // critical events

      const result = await auditService.getSystemMetrics();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("requests");
      expect(result.data).toHaveProperty("errors");
      expect(result.data).toHaveProperty("averageResponseTime");
      expect(result.data).toHaveProperty("api");
      expect(result.data).toHaveProperty("security");
    });

    it("should handle cache errors gracefully", async () => {
      mockCacheService.get.mockRejectedValue(new Error("Cache error"));

      const result = await auditService.getSystemMetrics();

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe("getSystemHealth", () => {
    it("should return system health metrics", async () => {
      mockCacheService.get.mockResolvedValue(null);

      const result = await auditService.getSystemHealth();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("timestamp");
      expect(result.data).toHaveProperty("cpu");
      expect(result.data).toHaveProperty("memory");
      expect(result.data).toHaveProperty("database");
      expect(result.data).toHaveProperty("cache");
      expect(result.data).toHaveProperty("api");
    });
  });

  describe("logSystemError", () => {
    it("should log system errors with appropriate severity", async () => {
      const error = new Error("Database connection failed");
      const errorData = {
        error,
        userId: "user-123",
        tenantId: "tenant-123",
        severity: "critical" as const,
        context: { operation: "user_login" },
      };

      mockCacheService.get.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(true);

      const result = await auditService.logSystemError(errorData);

      expect(result.success).toBe(true);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "audit:recent:system_error",
        expect.any(Array),
        3600
      );
    });
  });

  describe("logUserAction", () => {
    it("should log user actions for compliance", async () => {
      const actionData = {
        userId: "user-123",
        tenantId: "tenant-123",
        action: "delete",
        resource: "user",
        details: { targetUserId: "user-456" },
        ip: "192.168.1.1",
      };

      mockCacheService.get.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(true);

      const result = await auditService.logUserAction(actionData);

      expect(result.success).toBe(true);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "audit:recent:user_action",
        expect.any(Array),
        3600
      );
    });
  });

  describe("getAuditLogs", () => {
    it("should retrieve and filter audit logs", async () => {
      const mockEvents = [
        {
          id: "1",
          type: "auth_success",
          timestamp: new Date(),
          userId: "user-123",
          severity: "low",
          details: {},
        },
        {
          id: "2",
          type: "security_event",
          timestamp: new Date(),
          userId: "user-456",
          severity: "high",
          details: {},
        },
      ];

      mockCacheService.get.mockResolvedValue(mockEvents);

      const filter = {
        type: "auth_success" as const,
        userId: "user-123",
        limit: 10,
      };

      const result = await auditService.getAuditLogs(filter);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].type).toBe("auth_success");
      expect(result.data[0].userId).toBe("user-123");
    });

    it("should handle empty cache gracefully", async () => {
      mockCacheService.get.mockResolvedValue(null);

      const result = await auditService.getAuditLogs({});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("should apply severity filter", async () => {
      const mockEvents = [
        {
          id: "1",
          type: "auth_success",
          timestamp: new Date(),
          severity: "low",
          details: {},
        },
        {
          id: "2",
          type: "security_event",
          timestamp: new Date(),
          severity: "critical",
          details: {},
        },
      ];

      mockCacheService.get.mockResolvedValue(mockEvents);

      const result = await auditService.getAuditLogs({ severity: "critical" });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].severity).toBe("critical");
    });
  });
});

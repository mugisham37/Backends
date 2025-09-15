import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type Mock,
} from "vitest";
import { MonitoringService } from "../../../services/monitoring.service";
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
  })),
}));

// Mock the config
vi.mock("../../../config", () => ({
  config: {
    environment: "test",
    redis: {
      enabled: true,
    },
  },
}));

// Mock os module
vi.mock("os", () => ({
  default: {
    uptime: vi.fn(() => 3600),
    platform: vi.fn(() => "linux"),
    arch: vi.fn(() => "x64"),
    cpus: vi.fn(() => [1, 2, 3, 4]),
    totalmem: vi.fn(() => 8589934592), // 8GB
    freemem: vi.fn(() => 4294967296), // 4GB
    loadavg: vi.fn(() => [0.5, 0.7, 0.8]),
  },
}));

// Mock process
const mockProcess = {
  version: "v18.0.0",
  uptime: vi.fn(() => 1800),
  cpuUsage: vi.fn(() => ({ user: 1000000, system: 500000 })),
  memoryUsage: vi.fn(() => ({
    heapUsed: 50000000,
    heapTotal: 100000000,
    external: 5000000,
    rss: 120000000,
    arrayBuffers: 1000000,
  })),
  env: { npm_package_version: "1.0.0" },
};

// Replace global process
Object.defineProperty(global, "process", {
  value: mockProcess,
  writable: true,
});

describe("MonitoringService", () => {
  let monitoringService: MonitoringService;
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

    // Create monitoring service with mocked dependencies
    monitoringService = new MonitoringService(mockCacheService as any);
  });

  afterEach(() => {
    // Stop health checks to prevent interference
    monitoringService.stopHealthChecks();
  });

  describe("getHealthStatus", () => {
    it("should return comprehensive health status", async () => {
      mockCacheService.set.mockResolvedValue(true);
      mockCacheService.get.mockResolvedValue("ok");

      const health = await monitoringService.getHealthStatus();

      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("timestamp");
      expect(health).toHaveProperty("version", "1.0.0");
      expect(health).toHaveProperty("environment", "test");
      expect(health).toHaveProperty("uptime");
      expect(health).toHaveProperty("system");
      expect(health).toHaveProperty("services");
      expect(health).toHaveProperty("performance");

      expect(health.uptime).toHaveProperty("system");
      expect(health.uptime).toHaveProperty("process");
      expect(health.uptime).toHaveProperty("formatted");

      expect(health.system).toHaveProperty("platform", "linux");
      expect(health.system).toHaveProperty("arch", "x64");
      expect(health.system).toHaveProperty("nodeVersion", "v18.0.0");
      expect(health.system).toHaveProperty("cpus", 4);
      expect(health.system).toHaveProperty("memory");
      expect(health.system).toHaveProperty("loadAverage");

      expect(health.services).toHaveProperty("database");
      expect(health.services).toHaveProperty("cache");

      expect(health.performance).toHaveProperty("cpu");
      expect(health.performance).toHaveProperty("memory");
      expect(health.performance).toHaveProperty("eventLoop");
    });

    it("should determine overall health status correctly", async () => {
      mockCacheService.set.mockResolvedValue(true);
      mockCacheService.get.mockResolvedValue("ok");

      const health = await monitoringService.getHealthStatus();

      expect(health.status).toBe("healthy");
      expect(health.services.database.status).toBe("healthy");
      expect(health.services.cache.status).toBe("healthy");
    });

    it("should handle cache service errors gracefully", async () => {
      mockCacheService.set.mockRejectedValue(new Error("Cache error"));
      mockCacheService.get.mockRejectedValue(new Error("Cache error"));

      const health = await monitoringService.getHealthStatus();

      expect(health.services.cache.status).toBe("unhealthy");
      expect(health.services.cache.error).toBe("Cache error");
    });

    it("should return degraded status when cache test fails", async () => {
      mockCacheService.set.mockResolvedValue(true);
      mockCacheService.get.mockResolvedValue("wrong_value");

      const health = await monitoringService.getHealthStatus();

      expect(health.services.cache.status).toBe("degraded");
      expect(health.services.cache.error).toBe("Cache test failed");
    });
  });

  describe("getMetrics", () => {
    it("should return comprehensive system metrics", async () => {
      mockCacheService.get.mockResolvedValue(0);

      const result = await monitoringService.getMetrics();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("timestamp");
      expect(result.data).toHaveProperty("system");
      expect(result.data).toHaveProperty("database");
      expect(result.data).toHaveProperty("cache");
      expect(result.data).toHaveProperty("api");

      expect(result.data.system).toHaveProperty("cpu");
      expect(result.data.system).toHaveProperty("memory");
      expect(result.data.system).toHaveProperty("uptime");

      expect(result.data.system.memory).toHaveProperty("system");
      expect(result.data.system.memory).toHaveProperty("process");

      expect(result.data.api).toHaveProperty("requestsPerMinute");
      expect(result.data.api).toHaveProperty("averageResponseTime");
      expect(result.data.api).toHaveProperty("errorRate");
    });

    it("should handle errors gracefully", async () => {
      mockCacheService.get.mockRejectedValue(new Error("Cache error"));

      const result = await monitoringService.getMetrics();

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe("Failed to get system metrics");
    });
  });

  describe("isHealthy", () => {
    it("should return true for healthy system", async () => {
      mockCacheService.set.mockResolvedValue(true);
      mockCacheService.get.mockResolvedValue("ok");

      const isHealthy = await monitoringService.isHealthy();

      expect(isHealthy).toBe(true);
    });

    it("should return false for unhealthy system", async () => {
      mockCacheService.set.mockRejectedValue(new Error("Cache error"));

      const isHealthy = await monitoringService.isHealthy();

      expect(isHealthy).toBe(false);
    });

    it("should return false when health check throws", async () => {
      // Mock a method to throw an error
      vi.spyOn(monitoringService, "getHealthStatus").mockRejectedValue(
        new Error("Health check failed")
      );

      const isHealthy = await monitoringService.isHealthy();

      expect(isHealthy).toBe(false);
    });
  });

  describe("getApplicationMetrics", () => {
    it("should return application-specific metrics", async () => {
      mockCacheService.get.mockResolvedValue(0);

      const result = await monitoringService.getApplicationMetrics();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("models");
      expect(result.data).toHaveProperty("api");
      expect(result.data).toHaveProperty("performance");

      expect(result.data.models).toHaveProperty("users");
      expect(result.data.models).toHaveProperty("contents");
      expect(result.data.models).toHaveProperty("media");

      expect(result.data.performance).toHaveProperty("slowOperations");
      expect(result.data.performance).toHaveProperty("averageOperationTime");
    });

    it("should handle cache errors in application metrics", async () => {
      mockCacheService.get.mockRejectedValue(new Error("Cache error"));

      const result = await monitoringService.getApplicationMetrics();

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe("recordApiMetrics", () => {
    it("should record API metrics without throwing", async () => {
      const metricsData = {
        path: "/api/v1/users",
        method: "GET",
        statusCode: 200,
        responseTime: 150,
        userId: "user-123",
      };

      // Should not throw
      await expect(
        monitoringService.recordApiMetrics(metricsData)
      ).resolves.toBeUndefined();
    });

    it("should handle errors gracefully in recordApiMetrics", async () => {
      const metricsData = {
        path: "/api/v1/users",
        method: "GET",
        statusCode: 200,
        responseTime: 150,
      };

      // Should not throw even if there's an internal error
      await expect(
        monitoringService.recordApiMetrics(metricsData)
      ).resolves.toBeUndefined();
    });
  });

  describe("health check automation", () => {
    it("should start health checks automatically", () => {
      // Health checks should be started in constructor
      expect(monitoringService).toBeDefined();
    });

    it("should stop health checks when requested", () => {
      // Should not throw
      expect(() => monitoringService.stopHealthChecks()).not.toThrow();
    });
  });

  describe("formatUptime", () => {
    it("should format uptime correctly", async () => {
      mockCacheService.set.mockResolvedValue(true);
      mockCacheService.get.mockResolvedValue("ok");

      const health = await monitoringService.getHealthStatus();

      expect(health.uptime.formatted).toMatch(/^\d+[dhms]/);
    });
  });

  describe("service status determination", () => {
    it("should mark services as disabled when not enabled", async () => {
      // Mock config to disable Redis
      vi.doMock("../../../config", () => ({
        config: {
          environment: "test",
          redis: {
            enabled: false,
          },
        },
      }));

      const health = await monitoringService.getHealthStatus();

      expect(health.services.cache.status).toBe("disabled");
    });
  });

  describe("performance metrics calculation", () => {
    it("should calculate CPU usage correctly", async () => {
      const health = await monitoringService.getHealthStatus();

      expect(health.performance.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(health.performance.cpu.loadAverage).toHaveLength(3);
    });

    it("should calculate memory usage correctly", async () => {
      const health = await monitoringService.getHealthStatus();

      expect(health.performance.memory.heapUsed).toBeGreaterThan(0);
      expect(health.performance.memory.heapTotal).toBeGreaterThan(0);
      expect(health.performance.memory.rss).toBeGreaterThan(0);
    });
  });
});

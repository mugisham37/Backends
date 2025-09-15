import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { injectable, inject } from "tsyringe";
import { config } from "../config";
import { logger, createModuleLogger } from "../utils/logger";
import type { CacheService } from "./cache.service";
import type { Result } from "../core/types/result.types";

const execAsync = promisify(exec);

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  environment: string;
  uptime: {
    system: number;
    process: number;
    formatted: string;
  };
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    cpus: number;
    memory: {
      total: number;
      free: number;
      used: number;
      usedPercentage: string;
    };
    loadAverage: number[];
  };
  services: {
    database: ServiceStatus;
    cache: ServiceStatus;
    search?: ServiceStatus;
  };
  performance: {
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    memory: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
    };
    eventLoop: {
      delay: number;
    };
  };
}

export interface ServiceStatus {
  status: "healthy" | "degraded" | "unhealthy" | "disabled";
  responseTime?: number;
  details?: Record<string, unknown>;
  error?: string;
}

export interface SystemMetrics {
  timestamp: string;
  system: {
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    memory: {
      system: {
        total: number;
        free: number;
        used: number;
        usedPercentage: number;
      };
      process: {
        heapUsed: number;
        heapTotal: number;
        external: number;
        rss: number;
        arrayBuffers: number;
      };
    };
    uptime: {
      system: number;
      process: number;
    };
  };
  database: {
    connections: number;
    responseTime: number;
    status: string;
  };
  cache: {
    hitRate: number;
    memoryUsage: number;
    connections: number;
    status: string;
  };
  api: {
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
  };
}

/**
 * Enhanced monitoring service for system health and performance tracking
 * Provides comprehensive monitoring for modern stack (PostgreSQL, Redis, Fastify)
 */
@injectable()
export class MonitoringService {
  private readonly monitoringLogger = createModuleLogger("monitoring");
  private readonly healthCheckInterval = 30000; // 30 seconds
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(
    @inject("CacheService") private readonly cacheService: CacheService
  ) {
    this.startHealthChecks();
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.getHealthStatus();

        // Cache health status for quick access
        await this.cacheService.set("system:health", health, 60);

        // Log health issues
        if (health.status !== "healthy") {
          this.monitoringLogger.warn("System health degraded", {
            status: health.status,
            services: health.services,
          });
        }
      } catch (error) {
        this.monitoringLogger.error("Health check failed:", error);
      }
    }, this.healthCheckInterval);
  }

  /**
   * Stop health checks (for cleanup)
   */
  public stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Get comprehensive system health status
   */
  public async getHealthStatus(): Promise<SystemHealth> {
    try {
      const startTime = Date.now();

      const [systemInfo, databaseStatus, cacheStatus, performanceMetrics] =
        await Promise.all([
          this.getSystemInfo(),
          this.getDatabaseStatus(),
          this.getCacheStatus(),
          this.getPerformanceMetrics(),
        ]);

      const responseTime = Date.now() - startTime;

      // Determine overall health status
      const services = {
        database: databaseStatus,
        cache: cacheStatus,
      };

      const overallStatus = this.determineOverallHealth(services);

      const health: SystemHealth = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env["npm_package_version"] || "1.0.0",
        environment: config.environment,
        uptime: {
          system: os.uptime(),
          process: process.uptime(),
          formatted: this.formatUptime(process.uptime()),
        },
        system: systemInfo,
        services,
        performance: performanceMetrics,
      };

      // Log health check completion
      this.monitoringLogger.debug("Health check completed", {
        status: overallStatus,
        responseTime,
        services: Object.keys(services).map((key) => ({
          name: key,
          status: services[key as keyof typeof services].status,
        })),
      });

      return health;
    } catch (error) {
      this.monitoringLogger.error("Error getting health status:", error);

      return {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        version: "unknown",
        environment: config.environment,
        uptime: {
          system: os.uptime(),
          process: process.uptime(),
          formatted: this.formatUptime(process.uptime()),
        },
        system: await this.getSystemInfo(),
        services: {
          database: { status: "unhealthy", error: "Health check failed" },
          cache: { status: "unhealthy", error: "Health check failed" },
        },
        performance: await this.getPerformanceMetrics(),
      };
    }
  }

  /**
   * Determine overall system health from service statuses
   */
  private determineOverallHealth(
    services: Record<string, ServiceStatus>
  ): "healthy" | "degraded" | "unhealthy" {
    const statuses = Object.values(services).map((s) => s.status);

    if (statuses.some((s) => s === "unhealthy")) {
      return "unhealthy";
    }

    if (statuses.some((s) => s === "degraded")) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Get comprehensive system metrics
   */
  public async getMetrics(): Promise<Result<SystemMetrics, Error>> {
    try {
      const [systemMetrics, databaseMetrics, cacheMetrics, apiMetrics] =
        await Promise.all([
          this.getSystemMetrics(),
          this.getDatabaseMetrics(),
          this.getCacheMetrics(),
          this.getApiMetrics(),
        ]);

      const metrics: SystemMetrics = {
        timestamp: new Date().toISOString(),
        system: systemMetrics,
        database: databaseMetrics,
        cache: cacheMetrics,
        api: apiMetrics,
      };

      return { success: true, data: metrics };
    } catch (error) {
      this.monitoringLogger.error("Error getting metrics:", error);
      return {
        success: false,
        error: new Error("Failed to get system metrics"),
      };
    }
  }

  /**
   * Get system information
   */
  private async getSystemInfo(): Promise<SystemHealth["system"]> {
    const uptime = os.uptime();

    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpus: os.cpus().length,
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usedPercentage:
          (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2) +
          "%",
      },
      loadAverage: os.loadavg(),
    };
  }

  /**
   * Get database status (PostgreSQL)
   */
  private async getDatabaseStatus(): Promise<ServiceStatus> {
    try {
      const startTime = Date.now();

      // In a real implementation, this would check PostgreSQL connection
      // For now, we'll simulate a health check
      const responseTime = Date.now() - startTime;

      return {
        status: "healthy",
        responseTime,
        details: {
          type: "postgresql",
          version: "15.0", // Would be retrieved from actual DB
          connections: 5, // Would be retrieved from connection pool
        },
      };
    } catch (error) {
      this.monitoringLogger.error("Database health check failed:", error);
      return {
        status: "unhealthy",
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get cache status (Redis)
   */
  private async getCacheStatus(): Promise<ServiceStatus> {
    if (!config.redis.enabled) {
      return { status: "disabled" };
    }

    try {
      const startTime = Date.now();

      // Test cache connectivity
      await this.cacheService.set("health:check", "ok", 10);
      const result = await this.cacheService.get("health:check");

      const responseTime = Date.now() - startTime;

      if (result === "ok") {
        return {
          status: "healthy",
          responseTime,
          details: {
            type: "redis",
            connected: true,
          },
        };
      } else {
        return {
          status: "degraded",
          responseTime,
          error: "Cache test failed",
        };
      }
    } catch (error) {
      this.monitoringLogger.error("Cache health check failed:", error);
      return {
        status: "unhealthy",
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(): Promise<SystemHealth["performance"]> {
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();

    return {
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        loadAverage: os.loadavg(),
      },
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
      },
      eventLoop: {
        delay: 0, // Would be measured using async_hooks in production
      },
    };
  }

  /**
   * Get system metrics for detailed monitoring
   */
  private async getSystemMetrics(): Promise<SystemMetrics["system"]> {
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();

    return {
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000,
        loadAverage: os.loadavg(),
      },
      memory: {
        system: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          usedPercentage:
            ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
        },
        process: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss,
          arrayBuffers: memoryUsage.arrayBuffers,
        },
      },
      uptime: {
        system: os.uptime(),
        process: process.uptime(),
      },
    };
  }

  /**
   * Get database metrics
   */
  private async getDatabaseMetrics(): Promise<SystemMetrics["database"]> {
    try {
      // In production, these would be real metrics from PostgreSQL
      return {
        connections: 5, // Active connections
        responseTime: 10, // Average response time in ms
        status: "healthy",
      };
    } catch (error) {
      this.monitoringLogger.error("Error getting database metrics:", error);
      return {
        connections: 0,
        responseTime: 0,
        status: "error",
      };
    }
  }

  /**
   * Get cache metrics
   */
  private async getCacheMetrics(): Promise<SystemMetrics["cache"]> {
    if (!config.redis.enabled) {
      return {
        hitRate: 0,
        memoryUsage: 0,
        connections: 0,
        status: "disabled",
      };
    }

    try {
      // In production, these would be real metrics from Redis
      return {
        hitRate: 85.5, // Cache hit rate percentage
        memoryUsage: 1024 * 1024 * 50, // 50MB
        connections: 10,
        status: "healthy",
      };
    } catch (error) {
      this.monitoringLogger.error("Error getting cache metrics:", error);
      return {
        hitRate: 0,
        memoryUsage: 0,
        connections: 0,
        status: "error",
      };
    }
  }

  /**
   * Get API metrics
   */
  private async getApiMetrics(): Promise<SystemMetrics["api"]> {
    try {
      // Get metrics from cache (populated by audit service)
      const now = new Date();
      const currentMinute = Math.floor(now.getTime() / 60000);

      let totalRequests = 0;
      let totalErrors = 0;
      let totalResponseTime = 0;
      let responseTimeCount = 0;

      // Aggregate last 5 minutes of data
      for (let i = 0; i < 5; i++) {
        const minute = currentMinute - i;
        const requests =
          (await this.cacheService.get<number>(`metrics:api:rpm:${minute}`)) ||
          0;
        const errors =
          (await this.cacheService.get<number>(
            `metrics:api:errors:${minute}`
          )) || 0;
        const responseTimes =
          (await this.cacheService.get<number[]>(
            `metrics:api:response_times:${minute}`
          )) || [];

        totalRequests += requests;
        totalErrors += errors;

        if (responseTimes.length > 0) {
          totalResponseTime += responseTimes.reduce((a, b) => a + b, 0);
          responseTimeCount += responseTimes.length;
        }
      }

      return {
        requestsPerMinute: totalRequests / 5,
        averageResponseTime:
          responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0,
        errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
        activeConnections: 0, // Would be tracked by Fastify
      };
    } catch (error) {
      this.monitoringLogger.error("Error getting API metrics:", error);
      return {
        requestsPerMinute: 0,
        averageResponseTime: 0,
        errorRate: 0,
        activeConnections: 0,
      };
    }
  }

  /**
   * Record API request metrics
   */
  public async recordApiMetrics(data: {
    path: string;
    method: string;
    statusCode: number;
    responseTime: number;
    userId?: string;
  }): Promise<void> {
    try {
      // This is handled by the audit service now
      // Keep this method for backward compatibility
      this.monitoringLogger.debug("API request recorded", data);
    } catch (error) {
      this.monitoringLogger.error("Error recording API metrics:", error);
    }
  }

  /**
   * Check if the system is healthy
   */
  public async isHealthy(): Promise<boolean> {
    try {
      const health = await this.getHealthStatus();
      return health.status === "healthy";
    } catch (error) {
      this.monitoringLogger.error("Health check failed:", error);
      return false;
    }
  }

  /**
   * Get application-specific metrics
   */
  public async getApplicationMetrics(): Promise<
    Result<
      {
        models: Record<string, number>;
        api: {
          requestsPerMinute: number;
          averageResponseTime: number;
          errorRate: number;
        };
        performance: {
          slowOperations: number;
          averageOperationTime: number;
        };
      },
      Error
    >
  > {
    try {
      const apiMetrics = await this.getApiMetrics();

      // Get performance metrics from cache
      const now = new Date();
      const currentMinute = Math.floor(now.getTime() / 60000);
      let slowOperations = 0;

      for (let i = 0; i < 5; i++) {
        const minute = currentMinute - i;
        const slowOps =
          (await this.cacheService.get<number>(
            `metrics:performance:slow:${minute}`
          )) || 0;
        slowOperations += slowOps;
      }

      return {
        success: true,
        data: {
          models: {
            // In production, these would be actual model counts
            users: 0,
            contents: 0,
            media: 0,
          },
          api: apiMetrics,
          performance: {
            slowOperations,
            averageOperationTime: 0, // Would be calculated from performance metrics
          },
        },
      };
    } catch (error) {
      this.monitoringLogger.error("Error getting application metrics:", error);
      return {
        success: false,
        error: new Error("Failed to get application metrics"),
      };
    }
  }

  /**
   * Format uptime in a human-readable format
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (remainingSeconds > 0 || parts.length === 0)
      parts.push(`${remainingSeconds}s`);

    return parts.join(" ");
  }
}

// Export singleton instance for backward compatibility
export const monitoringService = new MonitoringService(
  // This would be injected in a real DI container setup
  {} as CacheService
);

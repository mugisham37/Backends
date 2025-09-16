import { cacheService } from "./cache.service.js";
import { multiLevelCache } from "./cache.strategies.js";
import { getRedisClient } from "./redis.client.js";

export interface CachePerformanceMetrics {
  timestamp: Date;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  totalSets: number;
  totalDeletes: number;
  memoryUsage: {
    used: number;
    peak: number;
    fragmentation: number;
  };
  connectionInfo: {
    connectedClients: number;
    totalConnections: number;
    rejectedConnections: number;
  };
  keyspaceInfo: {
    totalKeys: number;
    expiringKeys: number;
    avgTtl: number;
  };
  operationLatency: {
    get: number;
    set: number;
    delete: number;
  };
}

export interface CacheAlert {
  type: "warning" | "error" | "info";
  message: string;
  timestamp: Date;
  metrics?: Partial<CachePerformanceMetrics>;
}

export class CacheMonitor {
  private metrics: CachePerformanceMetrics[] = [];
  private alerts: CacheAlert[] = [];
  private readonly maxMetricsHistory = 1000;
  private readonly maxAlertsHistory = 100;
  private monitoringInterval: NodeJS.Timeout | null = null;

  // Thresholds for alerts
  private readonly thresholds = {
    lowHitRate: 70, // Alert if hit rate below 70%
    highMemoryUsage: 80, // Alert if memory usage above 80%
    highLatency: 100, // Alert if latency above 100ms
    maxConnections: 100, // Alert if connections above 100
  };

  /**
   * Start monitoring cache performance
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    console.log("Starting cache performance monitoring...");

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error("Cache monitoring error:", error);
        this.addAlert(
          "error",
          `Monitoring collection failed: ${error.message}`
        );
      }
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log("Cache performance monitoring stopped");
    }
  }

  /**
   * Collect current cache metrics
   */
  async collectMetrics(): Promise<CachePerformanceMetrics> {
    const redis = getRedisClient();
    const cacheMetrics = cacheService.getMetrics();

    // Measure operation latency
    const latency = await this.measureLatency();

    // Get Redis info
    const info = await redis.info();
    const memoryInfo = this.parseRedisInfo(info, "memory");
    const statsInfo = this.parseRedisInfo(info, "stats");
    const keyspaceInfo = await this.getKeyspaceInfo();

    const metrics: CachePerformanceMetrics = {
      timestamp: new Date(),
      hitRate: cacheMetrics.hitRate,
      totalHits: cacheMetrics.hits,
      totalMisses: cacheMetrics.misses,
      totalSets: cacheMetrics.sets,
      totalDeletes: cacheMetrics.deletes,
      memoryUsage: {
        used: parseInt(memoryInfo.used_memory || "0"),
        peak: parseInt(memoryInfo.used_memory_peak || "0"),
        fragmentation: parseFloat(memoryInfo.mem_fragmentation_ratio || "1"),
      },
      connectionInfo: {
        connectedClients: parseInt(statsInfo.connected_clients || "0"),
        totalConnections: parseInt(statsInfo.total_connections_received || "0"),
        rejectedConnections: parseInt(statsInfo.rejected_connections || "0"),
      },
      keyspaceInfo,
      operationLatency: latency,
    };

    // Store metrics
    this.addMetrics(metrics);

    // Check for alerts
    this.checkAlerts(metrics);

    return metrics;
  }

  /**
   * Get current cache metrics
   */
  getCurrentMetrics(): CachePerformanceMetrics | null {
    return this.metrics.length > 0
      ? this.metrics[this.metrics.length - 1]
      : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit?: number): CachePerformanceMetrics[] {
    const history = [...this.metrics];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit?: number): CacheAlert[] {
    const alerts = [...this.alerts];
    return limit ? alerts.slice(-limit) : alerts;
  }

  /**
   * Clear metrics history
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Clear alerts history
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Get cache health status
   */
  getHealthStatus(): {
    status: "healthy" | "warning" | "critical";
    issues: string[];
    metrics: CachePerformanceMetrics | null;
  } {
    const currentMetrics = this.getCurrentMetrics();
    const recentAlerts = this.getAlerts(10);

    if (!currentMetrics) {
      return {
        status: "critical",
        issues: ["No metrics available"],
        metrics: null,
      };
    }

    const issues: string[] = [];
    let status: "healthy" | "warning" | "critical" = "healthy" as const;

    // Check hit rate
    if (currentMetrics.hitRate < this.thresholds.lowHitRate) {
      issues.push(`Low hit rate: ${currentMetrics.hitRate.toFixed(2)}%`);
      status = "warning";
    }

    // Check memory usage
    const memoryUsagePercent =
      (currentMetrics.memoryUsage.used / currentMetrics.memoryUsage.peak) * 100;
    if (memoryUsagePercent > this.thresholds.highMemoryUsage) {
      issues.push(`High memory usage: ${memoryUsagePercent.toFixed(2)}%`);
      if (status === "healthy") {
        status = "warning";
      }
    }

    // Check latency
    const avgLatency =
      (currentMetrics.operationLatency.get +
        currentMetrics.operationLatency.set) /
      2;
    if (avgLatency > this.thresholds.highLatency) {
      issues.push(`High latency: ${avgLatency.toFixed(2)}ms`);
      status = "critical";
    }

    // Check connections
    if (
      currentMetrics.connectionInfo.connectedClients >
      this.thresholds.maxConnections
    ) {
      issues.push(
        `High connection count: ${currentMetrics.connectionInfo.connectedClients}`
      );
      if (status === "healthy") {
        status = "warning";
      }
    }

    // Check for recent errors
    const recentErrors = recentAlerts.filter((alert) => alert.type === "error");
    if (recentErrors.length > 0) {
      issues.push(`Recent errors: ${recentErrors.length}`);
      status = "critical";
    }

    return {
      status,
      issues,
      metrics: currentMetrics,
    };
  }

  /**
   * Generate performance report
   */
  generateReport(hours: number = 24): {
    summary: {
      avgHitRate: number;
      totalOperations: number;
      avgLatency: number;
      peakMemoryUsage: number;
    };
    trends: {
      hitRateTrend: "improving" | "declining" | "stable";
      latencyTrend: "improving" | "declining" | "stable";
      memoryTrend: "improving" | "declining" | "stable";
    };
    recommendations: string[];
  } {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const relevantMetrics = this.metrics.filter(
      (m) => m.timestamp >= cutoffTime
    );

    if (relevantMetrics.length === 0) {
      return {
        summary: {
          avgHitRate: 0,
          totalOperations: 0,
          avgLatency: 0,
          peakMemoryUsage: 0,
        },
        trends: {
          hitRateTrend: "stable",
          latencyTrend: "stable",
          memoryTrend: "stable",
        },
        recommendations: ["Insufficient data for analysis"],
      };
    }

    // Calculate summary
    const summary = {
      avgHitRate:
        relevantMetrics.reduce((sum, m) => sum + m.hitRate, 0) /
        relevantMetrics.length,
      totalOperations: relevantMetrics.reduce(
        (sum, m) => sum + m.totalHits + m.totalMisses,
        0
      ),
      avgLatency:
        relevantMetrics.reduce(
          (sum, m) =>
            sum + (m.operationLatency.get + m.operationLatency.set) / 2,
          0
        ) / relevantMetrics.length,
      peakMemoryUsage: Math.max(
        ...relevantMetrics.map((m) => m.memoryUsage.used)
      ),
    };

    // Calculate trends
    const trends = this.calculateTrends(relevantMetrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      summary,
      trends,
      relevantMetrics
    );

    return { summary, trends, recommendations };
  }

  /**
   * Add metrics to history
   */
  private addMetrics(metrics: CachePerformanceMetrics): void {
    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Add alert
   */
  private addAlert(
    type: CacheAlert["type"],
    message: string,
    metrics?: Partial<CachePerformanceMetrics>
  ): void {
    const alert: CacheAlert = {
      type,
      message,
      timestamp: new Date(),
      metrics,
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > this.maxAlertsHistory) {
      this.alerts = this.alerts.slice(-this.maxAlertsHistory);
    }

    // Log alert
    console.log(`Cache Alert [${type.toUpperCase()}]: ${message}`);
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(metrics: CachePerformanceMetrics): void {
    // Low hit rate alert
    if (metrics.hitRate < this.thresholds.lowHitRate) {
      this.addAlert(
        "warning",
        `Low cache hit rate: ${metrics.hitRate.toFixed(2)}%`,
        metrics
      );
    }

    // High memory usage alert
    const memoryUsagePercent =
      (metrics.memoryUsage.used / metrics.memoryUsage.peak) * 100;
    if (memoryUsagePercent > this.thresholds.highMemoryUsage) {
      this.addAlert(
        "warning",
        `High memory usage: ${memoryUsagePercent.toFixed(2)}%`,
        metrics
      );
    }

    // High latency alert
    const avgLatency =
      (metrics.operationLatency.get + metrics.operationLatency.set) / 2;
    if (avgLatency > this.thresholds.highLatency) {
      this.addAlert(
        "error",
        `High operation latency: ${avgLatency.toFixed(2)}ms`,
        metrics
      );
    }

    // High connection count alert
    if (
      metrics.connectionInfo.connectedClients > this.thresholds.maxConnections
    ) {
      this.addAlert(
        "warning",
        `High connection count: ${metrics.connectionInfo.connectedClients}`,
        metrics
      );
    }
  }

  /**
   * Measure operation latency
   */
  private async measureLatency(): Promise<{
    get: number;
    set: number;
    delete: number;
  }> {
    const testKey = "latency_test_key";
    const testValue = "latency_test_value";

    try {
      // Measure SET latency
      const setStart = Date.now();
      await cacheService.set(testKey, testValue, { ttl: 60 });
      const setLatency = Date.now() - setStart;

      // Measure GET latency
      const getStart = Date.now();
      await cacheService.get(testKey);
      const getLatency = Date.now() - getStart;

      // Measure DELETE latency
      const deleteStart = Date.now();
      await cacheService.delete(testKey);
      const deleteLatency = Date.now() - deleteStart;

      return {
        get: getLatency,
        set: setLatency,
        delete: deleteLatency,
      };
    } catch (error) {
      console.error("Latency measurement error:", error);
      return { get: 0, set: 0, delete: 0 };
    }
  }

  /**
   * Parse Redis INFO output
   */
  private parseRedisInfo(
    info: string,
    section: string
  ): Record<string, string> {
    const lines = info.split("\r\n");
    const sectionStart = lines.findIndex((line) =>
      line.startsWith(`# ${section.charAt(0).toUpperCase() + section.slice(1)}`)
    );

    if (sectionStart === -1) return {};

    const result: Record<string, string> = {};
    for (let i = sectionStart + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("#") || line === "") break;

      const [key, value] = line.split(":");
      if (key && value) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Get keyspace information
   */
  private async getKeyspaceInfo(): Promise<{
    totalKeys: number;
    expiringKeys: number;
    avgTtl: number;
  }> {
    try {
      const redis = getRedisClient();
      const dbSize = await redis.dbsize();

      // This is a simplified implementation
      // In production, you might want to sample keys for TTL analysis
      return {
        totalKeys: dbSize,
        expiringKeys: 0, // Would need to scan keys to get accurate count
        avgTtl: 0, // Would need to calculate from sampled keys
      };
    } catch (error) {
      console.error("Keyspace info error:", error);
      return { totalKeys: 0, expiringKeys: 0, avgTtl: 0 };
    }
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(metrics: CachePerformanceMetrics[]): {
    hitRateTrend: "improving" | "declining" | "stable";
    latencyTrend: "improving" | "declining" | "stable";
    memoryTrend: "improving" | "declining" | "stable";
  } {
    if (metrics.length < 2) {
      return {
        hitRateTrend: "stable",
        latencyTrend: "stable",
        memoryTrend: "stable",
      };
    }

    const first = metrics[0];
    const last = metrics[metrics.length - 1];

    return {
      hitRateTrend: this.getTrend(first.hitRate, last.hitRate, false),
      latencyTrend: this.getTrend(
        (first.operationLatency.get + first.operationLatency.set) / 2,
        (last.operationLatency.get + last.operationLatency.set) / 2,
        true
      ),
      memoryTrend: this.getTrend(
        first.memoryUsage.used,
        last.memoryUsage.used,
        true
      ),
    };
  }

  /**
   * Get trend direction
   */
  private getTrend(
    first: number,
    last: number,
    lowerIsBetter: boolean
  ): "improving" | "declining" | "stable" {
    const change = ((last - first) / first) * 100;
    const threshold = 5; // 5% change threshold

    if (Math.abs(change) < threshold) return "stable";

    if (lowerIsBetter) {
      return change < 0 ? "improving" : "declining";
    } else {
      return change > 0 ? "improving" : "declining";
    }
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    summary: any,
    trends: any,
    _metrics: CachePerformanceMetrics[]
  ): string[] {
    const recommendations: string[] = [];

    // Hit rate recommendations
    if (summary.avgHitRate < 70) {
      recommendations.push(
        "Consider increasing cache TTL for frequently accessed data"
      );
      recommendations.push(
        "Review cache invalidation strategy to reduce unnecessary evictions"
      );
    }

    // Latency recommendations
    if (summary.avgLatency > 50) {
      recommendations.push(
        "Consider optimizing Redis configuration for better performance"
      );
      recommendations.push(
        "Review network latency between application and Redis server"
      );
    }

    // Memory recommendations
    if (summary.peakMemoryUsage > 1000000000) {
      // 1GB
      recommendations.push(
        "Consider implementing cache size limits or LRU eviction"
      );
      recommendations.push("Review data serialization efficiency");
    }

    // Trend-based recommendations
    if (trends.hitRateTrend === "declining") {
      recommendations.push(
        "Investigate recent changes that may be affecting cache effectiveness"
      );
    }

    if (trends.latencyTrend === "declining") {
      recommendations.push(
        "Monitor Redis server performance and consider scaling"
      );
    }

    return recommendations;
  }
}

// Singleton instance
export const cacheMonitor = new CacheMonitor();

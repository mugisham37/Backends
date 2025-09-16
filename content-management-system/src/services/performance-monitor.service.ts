import { injectable } from "tsyringe";
import { logger } from "../utils/logger";
import { CacheService } from "./cache.service";
import { getConnectionStats } from "../core/database/connection";

/**
 * Performance monitoring service
 * Tracks application performance metrics and provides optimization insights
 */
@injectable()
export class PerformanceMonitorService {
  private metrics = {
    requests: {
      total: 0,
      successful: 0,
      failed: 0,
      avgResponseTime: 0,
      slowRequests: 0, // Requests > 1000ms
    },
    cache: {
      hits: 0,
      misses: 0,
      hitRate: 0,
    },
    database: {
      queries: 0,
      slowQueries: 0, // Queries > 1000ms
      avgQueryTime: 0,
      connectionPoolUtilization: 0,
    },
    memory: {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      rss: 0,
    },
    compression: {
      totalRequests: 0,
      compressedRequests: 0,
      compressionRatio: 0,
      bytesSaved: 0,
    },
  };

  private requestTimes: number[] = [];
  private queryTimes: number[] = [];
  private compressionStats: Array<{ original: number; compressed: number }> =
    [];

  constructor(private cacheService: CacheService) {
    this.startPeriodicCollection();
  }

  /**
   * Record request metrics
   */
  recordRequest(responseTime: number, success: boolean): void {
    this.metrics.requests.total++;

    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }

    this.requestTimes.push(responseTime);

    if (responseTime > 1000) {
      this.metrics.requests.slowRequests++;
      logger.warn(`Slow request detected: ${responseTime}ms`);
    }

    // Keep only last 1000 request times for rolling average
    if (this.requestTimes.length > 1000) {
      this.requestTimes.shift();
    }

    this.updateAverageResponseTime();
  }

  /**
   * Record database query metrics
   */
  recordQuery(queryTime: number): void {
    this.metrics.database.queries++;
    this.queryTimes.push(queryTime);

    if (queryTime > 1000) {
      this.metrics.database.slowQueries++;
    }

    // Keep only last 1000 query times
    if (this.queryTimes.length > 1000) {
      this.queryTimes.shift();
    }

    this.updateAverageQueryTime();
  }

  /**
   * Record cache hit/miss
   */
  recordCacheHit(hit: boolean): void {
    if (hit) {
      this.metrics.cache.hits++;
    } else {
      this.metrics.cache.misses++;
    }

    this.updateCacheHitRate();
  }

  /**
   * Record compression metrics
   */
  recordCompression(originalSize: number, compressedSize: number): void {
    this.metrics.compression.totalRequests++;

    if (compressedSize < originalSize) {
      this.metrics.compression.compressedRequests++;
      this.compressionStats.push({
        original: originalSize,
        compressed: compressedSize,
      });

      // Keep only last 1000 compression stats
      if (this.compressionStats.length > 1000) {
        this.compressionStats.shift();
      }

      this.updateCompressionMetrics();
    }
  }

  /**
   * Get current performance metrics
   */
  async getMetrics(): Promise<
    typeof this.metrics & {
      recommendations: string[];
      health: {
        overall: "excellent" | "good" | "fair" | "poor";
        score: number;
      };
    }
  > {
    // Update memory metrics
    const memUsage = process.memoryUsage();
    this.metrics.memory = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
    };

    // Get database connection stats
    try {
      const dbStats = await getConnectionStats();
      this.metrics.database.connectionPoolUtilization =
        ((dbStats.poolHealth.metrics?.activeConnections || 0) /
          (dbStats.poolHealth.metrics?.maxConnections || 1)) *
        100;
    } catch (error) {
      logger.error("Failed to get database stats:", error);
    }

    const recommendations = this.generateRecommendations();
    const health = this.calculateHealthScore();

    return {
      ...this.metrics,
      recommendations,
      health,
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Response time recommendations
    if (this.metrics.requests.avgResponseTime > 1000) {
      recommendations.push(
        "Average response time is high (>1s). Consider optimizing slow endpoints."
      );
    }

    if (
      this.metrics.requests.slowRequests / this.metrics.requests.total >
      0.1
    ) {
      recommendations.push(
        "More than 10% of requests are slow. Review application performance."
      );
    }

    // Cache recommendations
    if (this.metrics.cache.hitRate < 0.7) {
      recommendations.push(
        "Cache hit rate is low (<70%). Review caching strategy."
      );
    }

    // Database recommendations
    if (this.metrics.database.avgQueryTime > 500) {
      recommendations.push(
        "Average query time is high (>500ms). Consider database optimization."
      );
    }

    if (
      this.metrics.database.slowQueries / this.metrics.database.queries >
      0.05
    ) {
      recommendations.push(
        "More than 5% of queries are slow. Review database indexes and queries."
      );
    }

    if (this.metrics.database.connectionPoolUtilization > 80) {
      recommendations.push(
        "Database connection pool utilization is high (>80%). Consider increasing pool size."
      );
    }

    // Memory recommendations
    const heapUsagePercent =
      (this.metrics.memory.heapUsed / this.metrics.memory.heapTotal) * 100;
    if (heapUsagePercent > 80) {
      recommendations.push(
        "Heap memory usage is high (>80%). Monitor for memory leaks."
      );
    }

    // Compression recommendations
    if (this.metrics.compression.compressionRatio < 0.3) {
      recommendations.push(
        "Compression ratio is low. Review compression settings and content types."
      );
    }

    return recommendations;
  }

  /**
   * Calculate overall health score
   */
  private calculateHealthScore(): {
    overall: "excellent" | "good" | "fair" | "poor";
    score: number;
  } {
    let score = 100;

    // Response time impact (30% weight)
    if (this.metrics.requests.avgResponseTime > 2000) score -= 30;
    else if (this.metrics.requests.avgResponseTime > 1000) score -= 20;
    else if (this.metrics.requests.avgResponseTime > 500) score -= 10;

    // Cache hit rate impact (20% weight)
    if (this.metrics.cache.hitRate < 0.5) score -= 20;
    else if (this.metrics.cache.hitRate < 0.7) score -= 10;

    // Database performance impact (25% weight)
    if (this.metrics.database.avgQueryTime > 1000) score -= 25;
    else if (this.metrics.database.avgQueryTime > 500) score -= 15;
    else if (this.metrics.database.avgQueryTime > 200) score -= 5;

    // Error rate impact (15% weight)
    const errorRate =
      this.metrics.requests.failed / this.metrics.requests.total;
    if (errorRate > 0.1) score -= 15;
    else if (errorRate > 0.05) score -= 10;
    else if (errorRate > 0.01) score -= 5;

    // Memory usage impact (10% weight)
    const heapUsagePercent =
      (this.metrics.memory.heapUsed / this.metrics.memory.heapTotal) * 100;
    if (heapUsagePercent > 90) score -= 10;
    else if (heapUsagePercent > 80) score -= 5;

    score = Math.max(0, Math.min(100, score));

    let overall: "excellent" | "good" | "fair" | "poor";
    if (score >= 90) overall = "excellent";
    else if (score >= 75) overall = "good";
    else if (score >= 60) overall = "fair";
    else overall = "poor";

    return { overall, score };
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(): void {
    if (this.requestTimes.length === 0) return;

    const sum = this.requestTimes.reduce((acc, time) => acc + time, 0);
    this.metrics.requests.avgResponseTime = sum / this.requestTimes.length;
  }

  /**
   * Update average query time
   */
  private updateAverageQueryTime(): void {
    if (this.queryTimes.length === 0) return;

    const sum = this.queryTimes.reduce((acc, time) => acc + time, 0);
    this.metrics.database.avgQueryTime = sum / this.queryTimes.length;
  }

  /**
   * Update cache hit rate
   */
  private updateCacheHitRate(): void {
    const total = this.metrics.cache.hits + this.metrics.cache.misses;
    if (total === 0) return;

    this.metrics.cache.hitRate = this.metrics.cache.hits / total;
  }

  /**
   * Update compression metrics
   */
  private updateCompressionMetrics(): void {
    if (this.compressionStats.length === 0) return;

    const totalOriginal = this.compressionStats.reduce(
      (acc, stat) => acc + stat.original,
      0
    );
    const totalCompressed = this.compressionStats.reduce(
      (acc, stat) => acc + stat.compressed,
      0
    );

    this.metrics.compression.compressionRatio = totalCompressed / totalOriginal;
    this.metrics.compression.bytesSaved = totalOriginal - totalCompressed;
  }

  /**
   * Start periodic metrics collection
   */
  private startPeriodicCollection(): void {
    // Collect metrics every 5 minutes
    setInterval(async () => {
      try {
        const metrics = await this.getMetrics();

        // Log performance summary
        logger.info("Performance metrics summary:", {
          avgResponseTime: `${metrics.requests.avgResponseTime.toFixed(2)}ms`,
          cacheHitRate: `${(metrics.cache.hitRate * 100).toFixed(1)}%`,
          avgQueryTime: `${metrics.database.avgQueryTime.toFixed(2)}ms`,
          healthScore: metrics.health.score,
          healthStatus: metrics.health.overall,
        });

        // Cache metrics for external access
        await this.cacheService.set("performance:metrics", metrics, 300); // 5 minutes

        // Log recommendations if any
        if (metrics.recommendations.length > 0) {
          logger.warn("Performance recommendations:", metrics.recommendations);
        }
      } catch (error) {
        logger.error("Error collecting performance metrics:", error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Reset rolling metrics daily
    setInterval(() => {
      this.resetRollingMetrics();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  /**
   * Reset rolling metrics to prevent memory buildup
   */
  private resetRollingMetrics(): void {
    this.requestTimes = [];
    this.queryTimes = [];
    this.compressionStats = [];

    // Reset counters but keep rates
    this.metrics.requests.total = 0;
    this.metrics.requests.successful = 0;
    this.metrics.requests.failed = 0;
    this.metrics.requests.slowRequests = 0;
    this.metrics.database.queries = 0;
    this.metrics.database.slowQueries = 0;
    this.metrics.cache.hits = 0;
    this.metrics.cache.misses = 0;
    this.metrics.compression.totalRequests = 0;
    this.metrics.compression.compressedRequests = 0;

    logger.info("Performance metrics reset for new collection period");
  }

  /**
   * Get performance report
   */
  async getPerformanceReport(): Promise<{
    summary: string;
    metrics: any;
    recommendations: string[];
    trends: {
      responseTime: "improving" | "stable" | "degrading";
      cachePerformance: "improving" | "stable" | "degrading";
      databasePerformance: "improving" | "stable" | "degrading";
    };
  }> {
    const metrics = await this.getMetrics();

    // This would typically compare with historical data
    const trends = {
      responseTime: "stable" as const,
      cachePerformance: "stable" as const,
      databasePerformance: "stable" as const,
    };

    const summary =
      `Application performance is ${metrics.health.overall} with a score of ${metrics.health.score}/100. ` +
      `Average response time: ${metrics.requests.avgResponseTime.toFixed(
        2
      )}ms, ` +
      `Cache hit rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%, ` +
      `Database query time: ${metrics.database.avgQueryTime.toFixed(2)}ms.`;

    return {
      summary,
      metrics,
      recommendations: metrics.recommendations,
      trends,
    };
  }
}

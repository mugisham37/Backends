import type { Result } from "../../core/types/result.types";

export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  activeConnections: number;
  requestsPerSecond: number;
  peakMemoryUsage: number;
  timestamp: string;
}

export interface OptimizationRecommendation {
  type: "query" | "cache" | "memory" | "database" | "general";
  priority: "low" | "medium" | "high" | "critical";
  description: string;
  impact: string;
  solution: string;
}

export interface PerformanceReport {
  metrics: PerformanceMetrics;
  recommendations: OptimizationRecommendation[];
  health: {
    overall: "excellent" | "good" | "fair" | "poor";
    score: number;
  };
}

export interface IPerformanceMonitorService {
  getMetrics(): Promise<Result<PerformanceMetrics>>;
  getReport(): Promise<Result<PerformanceReport>>;
  getRecommendations(): Promise<Result<OptimizationRecommendation[]>>;
  recordRequest(duration: number, path: string): Promise<void>;
  recordError(error: Error, path: string): Promise<void>;
  clearMetrics(): Promise<Result<void>>;
}

/**
 * Performance Monitor Service Implementation
 */
export class PerformanceMonitorService implements IPerformanceMonitorService {
  private metrics: PerformanceMetrics = {
    requestCount: 0,
    averageResponseTime: 0,
    errorRate: 0,
    activeConnections: 0,
    requestsPerSecond: 0,
    peakMemoryUsage: 0,
    timestamp: new Date().toISOString(),
  };

  async getMetrics(): Promise<Result<PerformanceMetrics>> {
    try {
      // Update memory usage
      this.metrics.peakMemoryUsage = Math.max(
        this.metrics.peakMemoryUsage,
        process.memoryUsage().heapUsed
      );
      this.metrics.timestamp = new Date().toISOString();

      return {
        success: true,
        data: { ...this.metrics },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  async getReport(): Promise<Result<PerformanceReport>> {
    try {
      const metricsResult = await this.getMetrics();
      if (!metricsResult.success) {
        return metricsResult as Result<PerformanceReport>;
      }

      const recommendationsResult = await this.getRecommendations();
      if (!recommendationsResult.success) {
        return recommendationsResult as Result<PerformanceReport>;
      }

      // Calculate health score based on metrics
      let score = 100;
      if (metricsResult.data.errorRate > 5) score -= 20;
      if (metricsResult.data.averageResponseTime > 1000) score -= 15;
      if (metricsResult.data.peakMemoryUsage > 1024 * 1024 * 500) score -= 10;

      const health = {
        overall: this.getHealthStatus(score),
        score,
      };

      return {
        success: true,
        data: {
          metrics: metricsResult.data,
          recommendations: recommendationsResult.data,
          health,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  async getRecommendations(): Promise<Result<OptimizationRecommendation[]>> {
    try {
      const recommendations: OptimizationRecommendation[] = [];

      // Memory usage recommendation
      if (this.metrics.peakMemoryUsage > 1024 * 1024 * 500) {
        recommendations.push({
          type: "memory",
          priority: "high",
          description: "High memory usage detected",
          impact: "May cause performance degradation",
          solution: "Consider implementing memory optimization strategies",
        });
      }

      // Response time recommendation
      if (this.metrics.averageResponseTime > 1000) {
        recommendations.push({
          type: "general",
          priority: "medium",
          description: "Slow response times detected",
          impact: "Poor user experience",
          solution: "Optimize database queries and add caching",
        });
      }

      // Error rate recommendation
      if (this.metrics.errorRate > 5) {
        recommendations.push({
          type: "general",
          priority: "critical",
          description: "High error rate detected",
          impact: "Service reliability issues",
          solution: "Review error logs and fix critical issues",
        });
      }

      return {
        success: true,
        data: recommendations,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  async recordRequest(duration: number, _path: string): Promise<void> {
    this.metrics.requestCount++;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime + duration) / 2;
    // TODO: Implement more sophisticated metrics tracking
  }

  async recordError(_error: Error, _path: string): Promise<void> {
    // TODO: Implement error tracking
    this.metrics.errorRate =
      ((this.metrics.errorRate + 1) / this.metrics.requestCount) * 100;
  }

  async clearMetrics(): Promise<Result<void>> {
    try {
      this.metrics = {
        requestCount: 0,
        averageResponseTime: 0,
        errorRate: 0,
        activeConnections: 0,
        requestsPerSecond: 0,
        peakMemoryUsage: 0,
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
      };
    }
  }

  private getHealthStatus(
    score: number
  ): "excellent" | "good" | "fair" | "poor" {
    if (score >= 90) return "excellent";
    if (score >= 75) return "good";
    if (score >= 60) return "fair";
    return "poor";
  }
}

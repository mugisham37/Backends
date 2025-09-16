/**
 * Database Performance Monitor
 * Monitors database performance, slow queries, and provides optimization recommendations
 */

import { sql } from "drizzle-orm";
import { getDatabase } from "./connection.js";
import { databaseOptimizer } from "./optimization.js";

export interface DatabasePerformanceMetrics {
  timestamp: Date;
  connectionStats: {
    active: number;
    idle: number;
    waiting: number;
    maxConnections: number;
  };
  queryStats: {
    totalQueries: number;
    slowQueries: number;
    averageExecutionTime: number;
    queriesPerSecond: number;
  };
  tableStats: Array<{
    tableName: string;
    size: string;
    rowCount: number;
    indexSize: string;
    sequentialScans: number;
    indexScans: number;
  }>;
  indexUsage: Array<{
    tableName: string;
    indexName: string;
    scans: number;
    tuplesRead: number;
    tuplesReturned: number;
    efficiency: number;
  }>;
  lockStats: {
    totalLocks: number;
    waitingLocks: number;
    deadlocks: number;
  };
}

export interface PerformanceAlert {
  type: "warning" | "error" | "info";
  category: "connection" | "query" | "index" | "lock" | "storage";
  message: string;
  timestamp: Date;
  severity: 1 | 2 | 3 | 4 | 5; // 1 = low, 5 = critical
  recommendations: string[];
}

export class DatabasePerformanceMonitor {
  private db = getDatabase();
  private metrics: DatabasePerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly maxMetricsHistory = 1000;
  private readonly maxAlertsHistory = 500;

  // Performance thresholds
  private readonly thresholds = {
    slowQueryMs: 1000,
    verySlowQueryMs: 5000,
    maxConnections: 80, // Percentage of max connections
    lowIndexEfficiency: 0.1, // 10%
    highTableSize: 1000000000, // 1GB
    maxQueriesPerSecond: 1000,
  };

  /**
   * Start monitoring database performance
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    console.log("Starting database performance monitoring...");

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error("Database performance monitoring error:", error);
        this.addAlert(
          "error",
          "connection",
          "Failed to collect performance metrics",
          3,
          ["Check database connection", "Verify monitoring permissions"]
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
      console.log("Database performance monitoring stopped");
    }
  }

  /**
   * Collect comprehensive performance metrics
   */
  async collectMetrics(): Promise<DatabasePerformanceMetrics> {
    const [connectionStats, queryStats, tableStats, indexUsage, lockStats] =
      await Promise.all([
        this.getConnectionStats(),
        this.getQueryStats(),
        this.getTableStats(),
        this.getIndexUsage(),
        this.getLockStats(),
      ]);

    const metrics: DatabasePerformanceMetrics = {
      timestamp: new Date(),
      connectionStats,
      queryStats,
      tableStats,
      indexUsage,
      lockStats,
    };

    this.addMetrics(metrics);
    this.analyzeMetrics(metrics);

    return metrics;
  }

  /**
   * Get connection statistics
   */
  private async getConnectionStats(): Promise<
    DatabasePerformanceMetrics["connectionStats"]
  > {
    try {
      const result = await this.db.execute(sql`
        SELECT 
          count(*) FILTER (WHERE state = 'active') as active,
          count(*) FILTER (WHERE state = 'idle') as idle,
          count(*) FILTER (WHERE state = 'idle in transaction') as waiting,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `);

      const stats = result[0] as any;
      return {
        active: parseInt(String(stats.active)) || 0,
        idle: parseInt(String(stats.idle)) || 0,
        waiting: parseInt(String(stats.waiting)) || 0,
        maxConnections: parseInt(String(stats.max_connections)) || 100,
      };
    } catch (error) {
      console.error("Failed to get connection stats:", error);
      return { active: 0, idle: 0, waiting: 0, maxConnections: 100 };
    }
  }

  /**
   * Get query performance statistics
   */
  private async getQueryStats(): Promise<
    DatabasePerformanceMetrics["queryStats"]
  > {
    try {
      // Get query statistics from pg_stat_statements if available
      const result = await this.db.execute(sql`
        SELECT 
          sum(calls) as total_queries,
          sum(calls) FILTER (WHERE mean_exec_time > 1000) as slow_queries,
          avg(mean_exec_time) as avg_execution_time,
          sum(calls) / EXTRACT(EPOCH FROM (now() - stats_reset)) as queries_per_second
        FROM pg_stat_statements
        WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      `);

      if (result.length > 0 && (result[0] as any).total_queries) {
        const stats = result[0] as any;
        return {
          totalQueries: parseInt(String(stats.total_queries)) || 0,
          slowQueries: parseInt(String(stats.slow_queries)) || 0,
          averageExecutionTime:
            parseFloat(String(stats.avg_execution_time)) || 0,
          queriesPerSecond: parseFloat(String(stats.queries_per_second)) || 0,
        };
      }
    } catch (error) {
      // pg_stat_statements might not be available
      console.warn(
        "pg_stat_statements not available, using fallback query stats"
      );
    }

    // Fallback to basic statistics
    const optimizerStats = databaseOptimizer.getPerformanceSummary();
    return {
      totalQueries: optimizerStats.totalQueries,
      slowQueries: databaseOptimizer.getSlowQueryRecommendations(
        this.thresholds.slowQueryMs
      ).slowQueries.length,
      averageExecutionTime: optimizerStats.averageExecutionTime,
      queriesPerSecond: 0, // Not available without pg_stat_statements
    };
  }

  /**
   * Get table statistics
   */
  private async getTableStats(): Promise<
    DatabasePerformanceMetrics["tableStats"]
  > {
    try {
      const result = await this.db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          n_tup_ins + n_tup_upd + n_tup_del as row_count,
          pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
          seq_scan as sequential_scans,
          idx_scan as index_scans
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 20
      `);

      return result.map((row: any) => ({
        tableName: String(row.tablename),
        size: String(row.size),
        rowCount: parseInt(String(row.row_count)) || 0,
        indexSize: String(row.index_size),
        sequentialScans: parseInt(String(row.sequential_scans)) || 0,
        indexScans: parseInt(String(row.index_scans)) || 0,
      }));
    } catch (error) {
      console.error("Failed to get table stats:", error);
      return [];
    }
  }

  /**
   * Get index usage statistics
   */
  private async getIndexUsage(): Promise<
    DatabasePerformanceMetrics["indexUsage"]
  > {
    try {
      const result = await this.db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan as scans,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_returned,
          CASE 
            WHEN idx_tup_read > 0 THEN idx_tup_fetch::float / idx_tup_read::float
            ELSE 0
          END as efficiency
        FROM pg_stat_user_indexes
        WHERE idx_scan > 0
        ORDER BY idx_scan DESC
        LIMIT 50
      `);

      return result.map((row: any) => ({
        tableName: String(row.tablename),
        indexName: String(row.indexname),
        scans: parseInt(String(row.scans)) || 0,
        tuplesRead: parseInt(String(row.tuples_read)) || 0,
        tuplesReturned: parseInt(String(row.tuples_returned)) || 0,
        efficiency: parseFloat(String(row.efficiency)) || 0,
      }));
    } catch (error) {
      console.error("Failed to get index usage:", error);
      return [];
    }
  }

  /**
   * Get lock statistics
   */
  private async getLockStats(): Promise<
    DatabasePerformanceMetrics["lockStats"]
  > {
    try {
      const result = await this.db.execute(sql`
        SELECT 
          count(*) as total_locks,
          count(*) FILTER (WHERE NOT granted) as waiting_locks,
          (SELECT sum(deadlocks) FROM pg_stat_database WHERE datname = current_database()) as deadlocks
        FROM pg_locks
        WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
      `);

      const stats = result[0] as any;
      return {
        totalLocks: parseInt(String(stats.total_locks)) || 0,
        waitingLocks: parseInt(String(stats.waiting_locks)) || 0,
        deadlocks: parseInt(String(stats.deadlocks)) || 0,
      };
    } catch (error) {
      console.error("Failed to get lock stats:", error);
      return { totalLocks: 0, waitingLocks: 0, deadlocks: 0 };
    }
  }

  /**
   * Analyze metrics and generate alerts
   */
  private analyzeMetrics(metrics: DatabasePerformanceMetrics): void {
    // Connection analysis
    const connectionUsage =
      (metrics.connectionStats.active /
        metrics.connectionStats.maxConnections) *
      100;
    if (connectionUsage > this.thresholds.maxConnections) {
      this.addAlert(
        "warning",
        "connection",
        `High connection usage: ${connectionUsage.toFixed(1)}%`,
        3,
        [
          "Consider connection pooling",
          "Review application connection management",
          "Monitor for connection leaks",
        ]
      );
    }

    // Query performance analysis
    if (metrics.queryStats.averageExecutionTime > this.thresholds.slowQueryMs) {
      this.addAlert(
        "warning",
        "query",
        `High average query execution time: ${metrics.queryStats.averageExecutionTime.toFixed(
          2
        )}ms`,
        3,
        [
          "Review slow queries",
          "Consider query optimization",
          "Check index usage",
        ]
      );
    }

    if (
      metrics.queryStats.queriesPerSecond > this.thresholds.maxQueriesPerSecond
    ) {
      this.addAlert(
        "warning",
        "query",
        `High query rate: ${metrics.queryStats.queriesPerSecond.toFixed(
          1
        )} queries/second`,
        2,
        [
          "Consider query caching",
          "Review application query patterns",
          "Monitor database load",
        ]
      );
    }

    // Table analysis
    metrics.tableStats.forEach((table) => {
      const seqScanRatio =
        table.sequentialScans / (table.indexScans + table.sequentialScans + 1);
      if (seqScanRatio > 0.1 && table.rowCount > 1000) {
        this.addAlert(
          "warning",
          "index",
          `High sequential scan ratio for table ${table.tableName}: ${(
            seqScanRatio * 100
          ).toFixed(1)}%`,
          3,
          [
            `Add indexes to table ${table.tableName}`,
            "Review query patterns for this table",
            "Consider query optimization",
          ]
        );
      }
    });

    // Index efficiency analysis
    metrics.indexUsage.forEach((index) => {
      if (
        index.efficiency < this.thresholds.lowIndexEfficiency &&
        index.scans > 100
      ) {
        this.addAlert(
          "warning",
          "index",
          `Low index efficiency for ${index.indexName}: ${(
            index.efficiency * 100
          ).toFixed(1)}%`,
          2,
          [
            `Review index ${index.indexName} on table ${index.tableName}`,
            "Consider index restructuring",
            "Analyze query patterns using this index",
          ]
        );
      }
    });

    // Lock analysis
    if (metrics.lockStats.waitingLocks > 0) {
      this.addAlert(
        "warning",
        "lock",
        `${metrics.lockStats.waitingLocks} queries waiting for locks`,
        3,
        [
          "Review long-running transactions",
          "Consider transaction optimization",
          "Monitor for deadlocks",
        ]
      );
    }

    if (metrics.lockStats.deadlocks > 0) {
      this.addAlert(
        "error",
        "lock",
        `${metrics.lockStats.deadlocks} deadlocks detected`,
        4,
        [
          "Review transaction ordering",
          "Implement deadlock retry logic",
          "Optimize transaction duration",
        ]
      );
    }
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics(): DatabasePerformanceMetrics | null {
    return this.metrics.length > 0
      ? this.metrics[this.metrics.length - 1]
      : null;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit?: number): DatabasePerformanceMetrics[] {
    const history = [...this.metrics];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit?: number): PerformanceAlert[] {
    const alerts = [...this.alerts];
    return limit ? alerts.slice(-limit) : alerts;
  }

  /**
   * Get performance health status
   */
  getHealthStatus(): {
    status: "healthy" | "warning" | "critical";
    score: number; // 0-100
    issues: string[];
    recommendations: string[];
  } {
    const currentMetrics = this.getCurrentMetrics();
    const recentAlerts = this.getAlerts(20);

    if (!currentMetrics) {
      return {
        status: "critical",
        score: 0,
        issues: ["No performance data available"],
        recommendations: ["Start performance monitoring"],
      };
    }

    let score = 100;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Connection health (20 points)
    const connectionUsage =
      (currentMetrics.connectionStats.active /
        currentMetrics.connectionStats.maxConnections) *
      100;
    if (connectionUsage > 90) {
      score -= 20;
      issues.push(`Critical connection usage: ${connectionUsage.toFixed(1)}%`);
      recommendations.push("Immediate connection pool optimization required");
    } else if (connectionUsage > 70) {
      score -= 10;
      issues.push(`High connection usage: ${connectionUsage.toFixed(1)}%`);
      recommendations.push("Monitor connection usage closely");
    }

    // Query performance health (30 points)
    if (
      currentMetrics.queryStats.averageExecutionTime >
      this.thresholds.verySlowQueryMs
    ) {
      score -= 30;
      issues.push(
        `Very slow average query time: ${currentMetrics.queryStats.averageExecutionTime.toFixed(
          2
        )}ms`
      );
      recommendations.push("Immediate query optimization required");
    } else if (
      currentMetrics.queryStats.averageExecutionTime >
      this.thresholds.slowQueryMs
    ) {
      score -= 15;
      issues.push(
        `Slow average query time: ${currentMetrics.queryStats.averageExecutionTime.toFixed(
          2
        )}ms`
      );
      recommendations.push("Review and optimize slow queries");
    }

    // Lock health (20 points)
    if (currentMetrics.lockStats.deadlocks > 0) {
      score -= 20;
      issues.push(`${currentMetrics.lockStats.deadlocks} deadlocks detected`);
      recommendations.push("Critical: resolve deadlock issues");
    } else if (currentMetrics.lockStats.waitingLocks > 10) {
      score -= 10;
      issues.push(
        `${currentMetrics.lockStats.waitingLocks} queries waiting for locks`
      );
      recommendations.push("Optimize transaction handling");
    }

    // Index efficiency health (20 points)
    const inefficientIndexes = currentMetrics.indexUsage.filter(
      (idx) =>
        idx.efficiency < this.thresholds.lowIndexEfficiency && idx.scans > 100
    );
    if (inefficientIndexes.length > 5) {
      score -= 20;
      issues.push(`${inefficientIndexes.length} inefficient indexes`);
      recommendations.push("Review and optimize database indexes");
    } else if (inefficientIndexes.length > 2) {
      score -= 10;
      issues.push(`${inefficientIndexes.length} inefficient indexes`);
      recommendations.push("Consider index optimization");
    }

    // Recent alerts impact (10 points)
    const criticalAlerts = recentAlerts.filter((alert) => alert.severity >= 4);
    if (criticalAlerts.length > 0) {
      score -= 10;
      issues.push(`${criticalAlerts.length} critical alerts in recent history`);
      recommendations.push("Address critical performance alerts");
    }

    // Determine overall status
    let status: "healthy" | "warning" | "critical";
    if (score >= 80) {
      status = "healthy";
    } else if (score >= 60) {
      status = "warning";
    } else {
      status = "critical";
    }

    return { status, score, issues, recommendations };
  }

  /**
   * Generate performance report
   */
  generateReport(hours: number = 24): {
    summary: {
      period: string;
      avgQueryTime: number;
      totalQueries: number;
      slowQueries: number;
      avgConnections: number;
      peakConnections: number;
    };
    trends: {
      queryPerformance: "improving" | "stable" | "degrading";
      connectionUsage: "improving" | "stable" | "degrading";
      indexEfficiency: "improving" | "stable" | "degrading";
    };
    topIssues: string[];
    recommendations: string[];
  } {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const relevantMetrics = this.metrics.filter(
      (m) => m.timestamp >= cutoffTime
    );

    if (relevantMetrics.length === 0) {
      return {
        summary: {
          period: `${hours} hours`,
          avgQueryTime: 0,
          totalQueries: 0,
          slowQueries: 0,
          avgConnections: 0,
          peakConnections: 0,
        },
        trends: {
          queryPerformance: "stable",
          connectionUsage: "stable",
          indexEfficiency: "stable",
        },
        topIssues: ["Insufficient data for analysis"],
        recommendations: ["Collect more performance data"],
      };
    }

    // Calculate summary
    const summary = {
      period: `${hours} hours`,
      avgQueryTime:
        relevantMetrics.reduce(
          (sum, m) => sum + m.queryStats.averageExecutionTime,
          0
        ) / relevantMetrics.length,
      totalQueries: relevantMetrics.reduce(
        (sum, m) => sum + m.queryStats.totalQueries,
        0
      ),
      slowQueries: relevantMetrics.reduce(
        (sum, m) => sum + m.queryStats.slowQueries,
        0
      ),
      avgConnections:
        relevantMetrics.reduce((sum, m) => sum + m.connectionStats.active, 0) /
        relevantMetrics.length,
      peakConnections: Math.max(
        ...relevantMetrics.map((m) => m.connectionStats.active)
      ),
    };

    // Calculate trends
    const trends = this.calculateTrends(relevantMetrics);

    // Get top issues from recent alerts
    const recentAlerts = this.alerts.filter((a) => a.timestamp >= cutoffTime);
    const topIssues = [...new Set(recentAlerts.map((a) => a.message))].slice(
      0,
      5
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      summary,
      trends,
      recentAlerts
    );

    return { summary, trends, topIssues, recommendations };
  }

  /**
   * Add metrics to history
   */
  private addMetrics(metrics: DatabasePerformanceMetrics): void {
    this.metrics.push(metrics);

    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Add performance alert
   */
  private addAlert(
    type: PerformanceAlert["type"],
    category: PerformanceAlert["category"],
    message: string,
    severity: PerformanceAlert["severity"],
    recommendations: string[]
  ): void {
    const alert: PerformanceAlert = {
      type,
      category,
      message,
      timestamp: new Date(),
      severity,
      recommendations,
    };

    this.alerts.push(alert);

    if (this.alerts.length > this.maxAlertsHistory) {
      this.alerts = this.alerts.slice(-this.maxAlertsHistory);
    }

    // Log alert
    const severityText = ["", "LOW", "MEDIUM", "HIGH", "CRITICAL", "EMERGENCY"][
      severity
    ];
    console.log(
      `DB Alert [${type.toUpperCase()}] [${severityText}]: ${message}`
    );
  }

  /**
   * Calculate performance trends
   */
  private calculateTrends(metrics: DatabasePerformanceMetrics[]): {
    queryPerformance: "improving" | "stable" | "degrading";
    connectionUsage: "improving" | "stable" | "degrading";
    indexEfficiency: "improving" | "stable" | "degrading";
  } {
    if (metrics.length < 2) {
      return {
        queryPerformance: "stable",
        connectionUsage: "stable",
        indexEfficiency: "stable",
      };
    }

    const first = metrics[0];
    const last = metrics[metrics.length - 1];

    return {
      queryPerformance: this.getTrend(
        first.queryStats.averageExecutionTime,
        last.queryStats.averageExecutionTime,
        true // lower is better
      ),
      connectionUsage: this.getTrend(
        first.connectionStats.active / first.connectionStats.maxConnections,
        last.connectionStats.active / last.connectionStats.maxConnections,
        true // lower is better
      ),
      indexEfficiency: this.getTrend(
        first.indexUsage.reduce((sum, idx) => sum + idx.efficiency, 0) /
          first.indexUsage.length,
        last.indexUsage.reduce((sum, idx) => sum + idx.efficiency, 0) /
          last.indexUsage.length,
        false // higher is better
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
  ): "improving" | "stable" | "degrading" {
    const change = ((last - first) / first) * 100;
    const threshold = 10; // 10% change threshold

    if (Math.abs(change) < threshold) return "stable";

    if (lowerIsBetter) {
      return change < 0 ? "improving" : "degrading";
    } else {
      return change > 0 ? "improving" : "degrading";
    }
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(
    summary: any,
    trends: any,
    alerts: PerformanceAlert[]
  ): string[] {
    const recommendations: string[] = [];

    // Query performance recommendations
    if (summary.avgQueryTime > this.thresholds.slowQueryMs) {
      recommendations.push("Optimize slow queries and add appropriate indexes");
    }

    if (trends.queryPerformance === "degrading") {
      recommendations.push(
        "Query performance is degrading - investigate recent changes"
      );
    }

    // Connection recommendations
    if (summary.peakConnections > summary.avgConnections * 2) {
      recommendations.push(
        "High connection variance - implement connection pooling"
      );
    }

    // Alert-based recommendations
    const criticalAlerts = alerts.filter((a) => a.severity >= 4);
    if (criticalAlerts.length > 0) {
      recommendations.push("Address critical performance alerts immediately");
    }

    // General recommendations
    recommendations.push("Regularly monitor database performance metrics");
    recommendations.push("Implement automated performance alerting");
    recommendations.push("Schedule regular database maintenance");

    return [...new Set(recommendations)]; // Remove duplicates
  }
}

// Singleton instance
export const dbPerformanceMonitor = new DatabasePerformanceMonitor();

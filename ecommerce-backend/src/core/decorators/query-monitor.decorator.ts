/**
 * Query performance monitoring decorator
 * Automatically tracks database query performance and provides optimization insights
 */

import { databaseOptimizer } from "../database/optimization.js";

export interface QueryMonitorOptions {
  description?: string;
  warnThreshold?: number; // Warn if query takes longer than this (ms)
  errorThreshold?: number; // Error if query takes longer than this (ms)
  logSlowQueries?: boolean;
  trackMetrics?: boolean;
}

/**
 * Decorator to monitor database query performance
 */
export function MonitorQuery(options: QueryMonitorOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const {
      description = `${target.constructor.name}.${propertyKey}`,
      warnThreshold = 1000,
      errorThreshold = 5000,
      logSlowQueries = true,
      trackMetrics = true,
    } = options;

    descriptor.value = async function (...args: any[]) {
      if (!trackMetrics) {
        return originalMethod.apply(this, args);
      }

      try {
        const { result, metrics } = await databaseOptimizer.executeWithMetrics(
          originalMethod.apply(this, args),
          description
        );

        // Log performance warnings
        if (logSlowQueries) {
          if (metrics.executionTime > errorThreshold) {
            console.error(
              `🚨 Very slow query detected: ${description} took ${metrics.executionTime}ms`
            );
          } else if (metrics.executionTime > warnThreshold) {
            console.warn(
              `⚠️  Slow query detected: ${description} took ${metrics.executionTime}ms`
            );
          }
        }

        return result;
      } catch (error) {
        console.error(`Database query error in ${description}:`, error);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Class decorator to monitor all database methods
 */
export function MonitorAllQueries(options: QueryMonitorOptions = {}) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    const prototype = constructor.prototype;
    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      (name) =>
        name !== "constructor" &&
        typeof prototype[name] === "function" &&
        (name.includes("find") ||
          name.includes("get") ||
          name.includes("create") ||
          name.includes("update") ||
          name.includes("delete") ||
          name.includes("query"))
    );

    methodNames.forEach((methodName) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
      if (descriptor) {
        MonitorQuery({
          ...options,
          description: `${constructor.name}.${methodName}`,
        })(prototype, methodName, descriptor);
        Object.defineProperty(prototype, methodName, descriptor);
      }
    });

    return constructor;
  };
}

/**
 * Decorator for batch operations monitoring
 */
export function MonitorBatchQuery(
  options: QueryMonitorOptions & {
    batchSize?: number;
    maxBatchTime?: number;
  } = {}
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const {
      description = `${target.constructor.name}.${propertyKey}`,
      batchSize = 100,
      maxBatchTime = 10000,
      trackMetrics = true,
    } = options;

    descriptor.value = async function (...args: any[]) {
      if (!trackMetrics) {
        return originalMethod.apply(this, args);
      }

      const startTime = Date.now();

      try {
        const result = await originalMethod.apply(this, args);
        const executionTime = Date.now() - startTime;

        // Log batch operation metrics
        const itemCount = Array.isArray(result) ? result.length : 1;
        const avgTimePerItem =
          itemCount > 0 ? executionTime / itemCount : executionTime;

        console.log(
          `📊 Batch operation: ${description} - ${itemCount} items in ${executionTime}ms (${avgTimePerItem.toFixed(
            2
          )}ms/item)`
        );

        if (executionTime > maxBatchTime) {
          console.warn(
            `⚠️  Long batch operation: ${description} took ${executionTime}ms for ${itemCount} items`
          );
        }

        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error(
          `❌ Batch operation failed: ${description} after ${executionTime}ms:`,
          error
        );
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator for transaction monitoring
 */
export function MonitorTransaction(options: QueryMonitorOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const {
      description = `${target.constructor.name}.${propertyKey}`,
      warnThreshold = 2000,
      errorThreshold = 10000,
    } = options;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      const transactionId = `tx_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      console.log(`🔄 Starting transaction: ${description} [${transactionId}]`);

      try {
        const result = await originalMethod.apply(this, args);
        const executionTime = Date.now() - startTime;

        if (executionTime > errorThreshold) {
          console.error(
            `🚨 Very long transaction: ${description} [${transactionId}] took ${executionTime}ms`
          );
        } else if (executionTime > warnThreshold) {
          console.warn(
            `⚠️  Long transaction: ${description} [${transactionId}] took ${executionTime}ms`
          );
        } else {
          console.log(
            `✅ Transaction completed: ${description} [${transactionId}] in ${executionTime}ms`
          );
        }

        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error(
          `❌ Transaction failed: ${description} [${transactionId}] after ${executionTime}ms:`,
          error
        );
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Utility functions for query monitoring
 */
export const QueryMonitorUtils = {
  /**
   * Get performance summary for a specific method
   */
  getMethodPerformance: (methodName: string) => {
    const metrics = databaseOptimizer.getQueryMetrics();
    const methodMetrics = metrics.filter((m) => m.query.includes(methodName));

    if (methodMetrics.length === 0) {
      return null;
    }

    const totalTime = methodMetrics.reduce(
      (sum, m) => sum + m.executionTime,
      0
    );
    const avgTime = totalTime / methodMetrics.length;
    const maxTime = Math.max(...methodMetrics.map((m) => m.executionTime));
    const minTime = Math.min(...methodMetrics.map((m) => m.executionTime));

    return {
      methodName,
      callCount: methodMetrics.length,
      totalTime,
      averageTime: avgTime,
      maxTime,
      minTime,
      lastCall: methodMetrics[methodMetrics.length - 1].timestamp,
    };
  },

  /**
   * Get top slowest queries
   */
  getSlowestQueries: (limit: number = 10) => {
    const metrics = databaseOptimizer.getQueryMetrics();
    return metrics
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit);
  },

  /**
   * Get queries by time range
   */
  getQueriesByTimeRange: (startTime: Date, endTime: Date) => {
    const metrics = databaseOptimizer.getQueryMetrics();
    return metrics.filter(
      (m) => m.timestamp >= startTime && m.timestamp <= endTime
    );
  },

  /**
   * Generate performance report
   */
  generatePerformanceReport: () => {
    const summary = databaseOptimizer.getPerformanceSummary();
    const slowQueries = QueryMonitorUtils.getSlowestQueries(5);

    return {
      summary,
      slowQueries,
      recommendations: [
        ...(summary.averageExecutionTime > 500
          ? ["Consider optimizing frequently used queries"]
          : []),
        ...(slowQueries.length > 0 ? ["Review and optimize slow queries"] : []),
        "Ensure proper database indexing",
        "Consider query result caching for frequently accessed data",
      ],
    };
  },
};

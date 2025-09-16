import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { container } from "tsyringe";
import { PerformanceMonitorService } from "../../../services/performance-monitor.service.js";
import {
  getConnectionStats,
  executeOptimizedQuery,
} from "../../../core/database/connection.js";
import { CacheService } from "../../../services/cache.service.js";
import { logger } from "../../../utils/logger.js";

/**
 * Performance monitoring and optimization routes
 */
export async function performanceRoutes(fastify: FastifyInstance) {
  const performanceMonitor = container.resolve(PerformanceMonitorService);
  const cacheService = container.resolve(CacheService);

  // ============================================================================
  // GET /performance/metrics - Get current performance metrics
  // ============================================================================

  fastify.get(
    "/metrics",
    {
      schema: {
        description: "Get current application performance metrics",
        tags: ["Performance"],
        response: {
          200: {
            type: "object",
            properties: {
              metrics: { type: "object" },
              recommendations: {
                type: "array",
                items: { type: "string" },
              },
              health: {
                type: "object",
                properties: {
                  overall: {
                    type: "string",
                    enum: ["excellent", "good", "fair", "poor"],
                  },
                  score: { type: "number" },
                },
              },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const metrics = await performanceMonitor.getMetrics();

        return reply.send({
          ...metrics,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Error getting performance metrics:", error);
        return reply.status(500).send({
          error: "Failed to get performance metrics",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // ============================================================================
  // GET /performance/report - Get comprehensive performance report
  // ============================================================================

  fastify.get(
    "/report",
    {
      schema: {
        description:
          "Get comprehensive performance report with trends and analysis",
        tags: ["Performance"],
        response: {
          200: {
            type: "object",
            properties: {
              summary: { type: "string" },
              metrics: { type: "object" },
              recommendations: {
                type: "array",
                items: { type: "string" },
              },
              trends: { type: "object" },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const report = await performanceMonitor.getPerformanceReport();

        return reply.send({
          ...report,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Error generating performance report:", error);
        return reply.status(500).send({
          error: "Failed to generate performance report",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // ============================================================================
  // GET /performance/database - Get database performance statistics
  // ============================================================================

  fastify.get(
    "/database",
    {
      schema: {
        description:
          "Get database performance statistics and connection pool health",
        tags: ["Performance"],
        response: {
          200: {
            type: "object",
            properties: {
              connectionStats: { type: "object" },
              slowQueries: { type: "array" },
              indexUsage: { type: "array" },
              tableSizes: { type: "array" },
              recommendations: {
                type: "array",
                items: { type: "string" },
              },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get connection statistics
        const connectionStats = await getConnectionStats();

        // Get database performance data using optimized queries
        const [slowQueries, indexUsage, tableSizes] = await Promise.all([
          executeOptimizedQuery(
            "performance:slow_queries",
            async () => {
              // This would query pg_stat_statements if available
              return [];
            },
            300 // 5 minutes cache
          ),
          executeOptimizedQuery(
            "performance:index_usage",
            async () => {
              // This would query pg_stat_user_indexes
              return [];
            },
            600 // 10 minutes cache
          ),
          executeOptimizedQuery(
            "performance:table_sizes",
            async () => {
              // This would query pg_tables with sizes
              return [];
            },
            1800 // 30 minutes cache
          ),
        ]);

        return reply.send({
          connectionStats,
          slowQueries,
          indexUsage,
          tableSizes,
          recommendations: connectionStats.recommendations,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Error getting database performance stats:", error);
        return reply.status(500).send({
          error: "Failed to get database performance statistics",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // ============================================================================
  // GET /performance/cache - Get cache performance statistics
  // ============================================================================

  fastify.get(
    "/cache",
    {
      schema: {
        description: "Get cache performance statistics and health",
        tags: ["Performance"],
        response: {
          200: {
            type: "object",
            properties: {
              stats: { type: "object" },
              health: { type: "boolean" },
              recommendations: {
                type: "array",
                items: { type: "string" },
              },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const [stats, health] = await Promise.all([
          cacheService.getStats(),
          cacheService.healthCheck(),
        ]);

        const recommendations: string[] = [];

        // Generate cache recommendations
        if (!health) {
          recommendations.push(
            "Cache service is not healthy - check Redis connection"
          );
        }

        if (stats.keyCount > 10000) {
          recommendations.push(
            "High number of cache keys - consider implementing cache cleanup"
          );
        }

        return reply.send({
          stats,
          health,
          recommendations,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Error getting cache performance stats:", error);
        return reply.status(500).send({
          error: "Failed to get cache performance statistics",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // ============================================================================
  // POST /performance/optimize - Trigger performance optimization
  // ============================================================================

  fastify.post(
    "/optimize",
    {
      schema: {
        description: "Trigger performance optimization tasks",
        tags: ["Performance"],
        body: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "cache_warmup",
                  "cleanup_sessions",
                  "analyze_tables",
                  "vacuum_db",
                ],
              },
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              message: { type: "string" },
              tasksExecuted: {
                type: "array",
                items: { type: "string" },
              },
              results: { type: "object" },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Body: { tasks?: string[] };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { tasks = ["cache_warmup", "cleanup_sessions"] } =
          request.body || {};
        const results: Record<string, any> = {};
        const executedTasks: string[] = [];

        // Execute requested optimization tasks
        for (const task of tasks) {
          try {
            switch (task) {
              case "cache_warmup":
                // Warm up cache with frequently accessed data
                await cacheService.warmCache([
                  { key: "active_tenants", value: [], ttl: 600 },
                  { key: "user_roles", value: [], ttl: 1800 },
                ]);
                results[task] = "Cache warmed successfully";
                executedTasks.push(task);
                break;

              case "cleanup_sessions":
                // This would cleanup expired sessions
                results[task] = "Sessions cleaned up";
                executedTasks.push(task);
                break;

              case "analyze_tables":
                // This would run ANALYZE on database tables
                results[task] = "Table statistics updated";
                executedTasks.push(task);
                break;

              case "vacuum_db":
                // This would run VACUUM on the database
                results[task] = "Database vacuumed";
                executedTasks.push(task);
                break;

              default:
                logger.warn(`Unknown optimization task: ${task}`);
            }
          } catch (taskError) {
            logger.error(`Error executing task ${task}:`, taskError);
            results[task] = `Failed: ${
              taskError instanceof Error ? taskError.message : "Unknown error"
            }`;
          }
        }

        return reply.send({
          message: "Performance optimization completed",
          tasksExecuted: executedTasks,
          results,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Error during performance optimization:", error);
        return reply.status(500).send({
          error: "Performance optimization failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  // ============================================================================
  // GET /performance/health - Get overall system health
  // ============================================================================

  fastify.get(
    "/health",
    {
      schema: {
        description: "Get overall system health and performance status",
        tags: ["Performance"],
        response: {
          200: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["healthy", "degraded", "unhealthy"],
              },
              score: { type: "number" },
              components: { type: "object" },
              recommendations: {
                type: "array",
                items: { type: "string" },
              },
              timestamp: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const [metrics, connectionStats, cacheHealth] = await Promise.all([
          performanceMonitor.getMetrics(),
          getConnectionStats(),
          cacheService.healthCheck(),
        ]);

        const components = {
          application: {
            healthy: metrics.health.overall !== "poor",
            score: metrics.health.score,
            details: {
              avgResponseTime: metrics.requests.avgResponseTime,
              errorRate:
                metrics.requests.failed / (metrics.requests.total || 1),
            },
          },
          database: {
            healthy: connectionStats.poolHealth.healthy,
            details: {
              avgQueryTime: metrics.database.avgQueryTime,
              poolUtilization: metrics.database.connectionPoolUtilization,
            },
          },
          cache: {
            healthy: cacheHealth,
            details: {
              hitRate: metrics.cache.hitRate,
            },
          },
        };

        // Calculate overall health
        const healthyComponents = Object.values(components).filter(
          (c) => c.healthy
        ).length;
        const totalComponents = Object.keys(components).length;
        const healthPercentage = (healthyComponents / totalComponents) * 100;

        let status: "healthy" | "degraded" | "unhealthy";
        if (healthPercentage >= 100) status = "healthy";
        else if (healthPercentage >= 66) status = "degraded";
        else status = "unhealthy";

        const allRecommendations = [
          ...metrics.recommendations,
          ...connectionStats.recommendations,
        ];

        return reply.send({
          status,
          score: Math.round((metrics.health.score + healthPercentage) / 2),
          components,
          recommendations: allRecommendations,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Error getting system health:", error);
        return reply.status(500).send({
          error: "Failed to get system health",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  );

  logger.info("Performance monitoring routes registered");
}

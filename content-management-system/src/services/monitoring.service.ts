import os from "os"
import { exec } from "child_process"
import { promisify } from "util"
import mongoose from "mongoose"
import { config } from "../config"
import { logger } from "../utils/logger"
import { getCacheClient } from "../db/redis"
import { getElasticsearchClient } from "../db/elasticsearch"

const execAsync = promisify(exec)

/**
 * Service for monitoring system health and performance
 */
export class MonitoringService {
  /**
   * Get system health status
   */
  public async getHealthStatus(): Promise<any> {
    try {
      const [systemInfo, databaseStatus, redisStatus, elasticsearchStatus, diskSpace] = await Promise.all([
        this.getSystemInfo(),
        this.getDatabaseStatus(),
        this.getRedisStatus(),
        this.getElasticsearchStatus(),
        this.getDiskSpace(),
      ])

      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "unknown",
        environment: config.environment,
        system: systemInfo,
        services: {
          database: databaseStatus,
          redis: redisStatus,
          elasticsearch: elasticsearchStatus,
        },
        disk: diskSpace,
      }
    } catch (error) {
      logger.error("Error getting health status:", error)
      return {
        status: "error",
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      }
    }
  }

  /**
   * Get system metrics
   */
  public async getMetrics(): Promise<any> {
    try {
      const [systemMetrics, databaseMetrics, redisMetrics, elasticsearchMetrics] = await Promise.all([
        this.getSystemMetrics(),
        this.getDatabaseMetrics(),
        this.getRedisMetrics(),
        this.getElasticsearchMetrics(),
      ])

      return {
        timestamp: new Date().toISOString(),
        system: systemMetrics,
        database: databaseMetrics,
        redis: redisMetrics,
        elasticsearch: elasticsearchMetrics,
      }
    } catch (error) {
      logger.error("Error getting metrics:", error)
      throw error
    }
  }

  /**
   * Get system information
   */
  private async getSystemInfo(): Promise<any> {
    const uptime = os.uptime()
    const uptimeFormatted = this.formatUptime(uptime)

    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpus: os.cpus().length,
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usedPercentage: (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2) + "%",
      },
      uptime: uptimeFormatted,
      uptimeSeconds: uptime,
      loadAverage: os.loadavg(),
    }
  }

  /**
   * Get database status
   */
  private async getDatabaseStatus(): Promise<any> {
    try {
      const status = mongoose.connection.readyState
      const statusMap: Record<number, string> = {
        0: "disconnected",
        1: "connected",
        2: "connecting",
        3: "disconnecting",
        99: "uninitialized",
      }

      // Get admin stats if connected
      let adminStats = null
      if (status === 1) {
        try {
          const db = mongoose.connection.db
          adminStats = await db.admin().serverStatus()
        } catch (error) {
          logger.warn("Could not get MongoDB admin stats:", error)
        }
      }

      return {
        status: statusMap[status] || "unknown",
        statusCode: status,
        host: mongoose.connection.host,
        name: mongoose.connection.name,
        adminStats: adminStats
          ? {
              version: adminStats.version,
              uptime: adminStats.uptime,
              connections: adminStats.connections,
              opcounters: adminStats.opcounters,
            }
          : null,
      }
    } catch (error) {
      logger.error("Error getting database status:", error)
      return {
        status: "error",
        error: (error as Error).message,
      }
    }
  }

  /**
   * Get Redis status
   */
  private async getRedisStatus(): Promise<any> {
    if (!config.redis.enabled) {
      return {
        status: "disabled",
      }
    }

    try {
      const client = getCacheClient()
      const info = await client.info()
      const parsedInfo: Record<string, any> = {}

      // Parse Redis INFO command output
      info.split("\r\n").forEach((line) => {
        if (line.includes(":")) {
          const [key, value] = line.split(":")
          parsedInfo[key] = value
        }
      })

      return {
        status: "connected",
        version: parsedInfo.redis_version,
        uptime: this.formatUptime(Number.parseInt(parsedInfo.uptime_in_seconds || "0")),
        uptimeSeconds: Number.parseInt(parsedInfo.uptime_in_seconds || "0"),
        memory: {
          used: parsedInfo.used_memory_human,
          peak: parsedInfo.used_memory_peak_human,
        },
        clients: parsedInfo.connected_clients,
      }
    } catch (error) {
      logger.error("Error getting Redis status:", error)
      return {
        status: "error",
        error: (error as Error).message,
      }
    }
  }

  /**
   * Get Elasticsearch status
   */
  private async getElasticsearchStatus(): Promise<any> {
    if (!config.elasticsearch.enabled) {
      return {
        status: "disabled",
      }
    }

    try {
      const client = getElasticsearchClient()
      const health = await client.cluster.health()
      const info = await client.info()

      return {
        status: health.status,
        version: info.version.number,
        clusterName: health.cluster_name,
        numberOfNodes: health.number_of_nodes,
        activeShards: health.active_shards,
        relocatingShards: health.relocating_shards,
        initializingShards: health.initializing_shards,
        unassignedShards: health.unassigned_shards,
      }
    } catch (error) {
      logger.error("Error getting Elasticsearch status:", error)
      return {
        status: "error",
        error: (error as Error).message,
      }
    }
  }

  /**
   * Get disk space information
   */
  private async getDiskSpace(): Promise<any> {
    try {
      // This will work on Linux and macOS
      const { stdout } = await execAsync("df -h / | tail -1")
      const parts = stdout.trim().split(/\s+/)

      // Format depends on OS, but generally:
      // Filesystem Size Used Avail Use% Mounted on
      return {
        filesystem: parts[0],
        size: parts[1],
        used: parts[2],
        available: parts[3],
        usedPercentage: parts[4],
        mountPoint: parts[5],
      }
    } catch (error) {
      logger.warn("Could not get disk space info:", error)
      return {
        error: "Could not retrieve disk space information",
      }
    }
  }

  /**
   * Get system metrics
   */
  private async getSystemMetrics(): Promise<any> {
    const cpuUsage = process.cpuUsage()
    const memoryUsage = process.memoryUsage()

    return {
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        loadAverage: os.loadavg(),
      },
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
        systemTotal: os.totalmem(),
        systemFree: os.freemem(),
        systemUsed: os.totalmem() - os.freemem(),
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        uptimeFormatted: this.formatUptime(process.uptime()),
      },
    }
  }

  /**
   * Get database metrics
   */
  private async getDatabaseMetrics(): Promise<any> {
    try {
      if (mongoose.connection.readyState !== 1) {
        return {
          status: "disconnected",
        }
      }

      // Get collection stats
      const db = mongoose.connection.db
      const collections = await db.listCollections().toArray()
      const collectionStats = await Promise.all(
        collections.map(async (collection) => {
          try {
            const stats = await db.collection(collection.name).stats()
            return {
              name: collection.name,
              count: stats.count,
              size: stats.size,
              avgObjSize: stats.avgObjSize,
              storageSize: stats.storageSize,
              totalIndexSize: stats.totalIndexSize,
            }
          } catch (error) {
            logger.warn(`Could not get stats for collection ${collection.name}:`, error)
            return {
              name: collection.name,
              error: "Could not retrieve stats",
            }
          }
        }),
      )

      return {
        collections: collectionStats,
      }
    } catch (error) {
      logger.error("Error getting database metrics:", error)
      return {
        error: (error as Error).message,
      }
    }
  }

  /**
   * Get Redis metrics
   */
  private async getRedisMetrics(): Promise<any> {
    if (!config.redis.enabled) {
      return {
        status: "disabled",
      }
    }

    try {
      const client = getCacheClient()
      const info = await client.info()
      const parsedInfo: Record<string, any> = {}

      // Parse Redis INFO command output
      info.split("\r\n").forEach((line) => {
        if (line.includes(":")) {
          const [key, value] = line.split(":")
          parsedInfo[key] = value
        }
      })

      return {
        memory: {
          used: Number.parseInt(parsedInfo.used_memory || "0"),
          peak: Number.parseInt(parsedInfo.used_memory_peak || "0"),
          fragmentation: Number.parseFloat(parsedInfo.mem_fragmentation_ratio || "0"),
        },
        clients: Number.parseInt(parsedInfo.connected_clients || "0"),
        commands: {
          processed: Number.parseInt(parsedInfo.total_commands_processed || "0"),
          perSecond: Number.parseFloat(parsedInfo.instantaneous_ops_per_sec || "0"),
        },
        keys: {
          total: Number.parseInt(parsedInfo.db0 ? parsedInfo.db0.split(",")[0].split("=")[1] : "0"),
        },
        network: {
          inputBytes: Number.parseInt(parsedInfo.total_net_input_bytes || "0"),
          outputBytes: Number.parseInt(parsedInfo.total_net_output_bytes || "0"),
          connections: Number.parseInt(parsedInfo.total_connections_received || "0"),
          rejectedConnections: Number.parseInt(parsedInfo.rejected_connections || "0"),
        },
      }
    } catch (error) {
      logger.error("Error getting Redis metrics:", error)
      return {
        error: (error as Error).message,
      }
    }
  }

  /**
   * Get Elasticsearch metrics
   */
  private async getElasticsearchMetrics(): Promise<any> {
    if (!config.elasticsearch.enabled) {
      return {
        status: "disabled",
      }
    }

    try {
      const client = getElasticsearchClient()
      const stats = await client.indices.stats()
      const nodeStats = await client.nodes.stats()

      return {
        indices: {
          count: stats._all.total.docs.count,
          size: stats._all.total.store.size_in_bytes,
          queryCount: stats._all.total.search.query_total,
          queryTime: stats._all.total.search.query_time_in_millis,
        },
        nodes: Object.keys(nodeStats.nodes).map((nodeId) => {
          const node = nodeStats.nodes[nodeId]
          return {
            name: node.name,
            cpu: node.process.cpu.percent,
            memory: {
              used: node.jvm.mem.heap_used_in_bytes,
              max: node.jvm.mem.heap_max_in_bytes,
              percent: node.jvm.mem.heap_used_percent,
            },
            docs: {
              count: node.indices.docs.count,
              deleted: node.indices.docs.deleted,
            },
            indexing: {
              indexTotal: node.indices.indexing.index_total,
              indexTime: node.indices.indexing.index_time_in_millis,
              deleteTotal: node.indices.indexing.delete_total,
              deleteTime: node.indices.indexing.delete_time_in_millis,
            },
            search: {
              queryTotal: node.indices.search.query_total,
              queryTime: node.indices.search.query_time_in_millis,
            },
          }
        }),
      }
    } catch (error) {
      logger.error("Error getting Elasticsearch metrics:", error)
      return {
        error: (error as Error).message,
      }
    }
  }

  /**
   * Format uptime in a human-readable format
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / (3600 * 24))
    const hours = Math.floor((seconds % (3600 * 24)) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = Math.floor(seconds % 60)

    const parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`)

    return parts.join(" ")
  }

  /**
   * Get application metrics
   */
  public async getApplicationMetrics(): Promise<any> {
    try {
      // Get model counts
      const modelCounts = await this.getModelCounts()

      // Get API metrics
      const apiMetrics = await this.getApiMetrics()

      return {
        timestamp: new Date().toISOString(),
        models: modelCounts,
        api: apiMetrics,
      }
    } catch (error) {
      logger.error("Error getting application metrics:", error)
      throw error
    }
  }

  /**
   * Get model counts
   */
  private async getModelCounts(): Promise<any> {
    try {
      // Get counts for all models
      const models = mongoose.connection.models
      const counts: Record<string, number> = {}

      await Promise.all(
        Object.keys(models).map(async (modelName) => {
          try {
            counts[modelName] = await models[modelName].countDocuments()
          } catch (error) {
            logger.warn(`Could not get count for model ${modelName}:`, error)
            counts[modelName] = -1 // Error indicator
          }
        }),
      )

      return counts
    } catch (error) {
      logger.error("Error getting model counts:", error)
      return {
        error: (error as Error).message,
      }
    }
  }

  /**
   * Get API metrics
   */
  private async getApiMetrics(): Promise<any> {
    try {
      // This would typically come from a metrics collection or Redis
      // For now, we'll return placeholder data
      return {
        requestsPerMinute: 0,
        averageResponseTime: 0,
        errorRate: 0,
        endpoints: {},
      }
    } catch (error) {
      logger.error("Error getting API metrics:", error)
      return {
        error: (error as Error).message,
      }
    }
  }

  /**
   * Record API request metrics
   */
  public async recordApiMetrics(data: {
    path: string
    method: string
    statusCode: number
    responseTime: number
    userId?: string
  }): Promise<void> {
    try {
      // In a real implementation, this would store metrics in Redis or a database
      // For now, we'll just log them
      if (config.isDevelopment) {
        logger.debug("API Metrics:", data)
      }
    } catch (error) {
      logger.error("Error recording API metrics:", error)
    }
  }

  /**
   * Check if a service is healthy
   */
  public async isHealthy(): Promise<boolean> {
    try {
      const health = await this.getHealthStatus()

      // Check database connection
      if (health.services.database.status !== "connected") {
        return false
      }

      // Check Redis if enabled
      if (config.redis.enabled && health.services.redis.status !== "connected") {
        return false
      }

      // Check Elasticsearch if enabled
      if (
        config.elasticsearch.enabled &&
        health.services.elasticsearch.status !== "green" &&
        health.services.elasticsearch.status !== "yellow"
      ) {
        return false
      }

      return true
    } catch (error) {
      logger.error("Health check failed:", error)
      return false
    }
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService()

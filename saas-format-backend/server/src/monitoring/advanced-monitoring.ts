import { Counter, Gauge, Histogram, Summary } from "prom-client"
import os from "os"
import { logger } from "../utils/logger"

// Advanced metrics for detailed monitoring
export const advancedMetrics = {
  // HTTP metrics
  httpRequestDurationByEndpoint: new Histogram({
    name: "http_request_duration_by_endpoint_seconds",
    help: "Duration of HTTP requests by endpoint",
    labelNames: ["method", "route", "status", "tenant"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  }),

  httpRequestSizeBytes: new Histogram({
    name: "http_request_size_bytes",
    help: "Size of HTTP requests in bytes",
    labelNames: ["method", "route"],
    buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  }),

  httpResponseSizeBytes: new Histogram({
    name: "http_response_size_bytes",
    help: "Size of HTTP responses in bytes",
    labelNames: ["method", "route", "status"],
    buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  }),

  // Database metrics
  dbConnectionPoolSize: new Gauge({
    name: "db_connection_pool_size",
    help: "Database connection pool size",
    labelNames: ["service"],
  }),

  dbConnectionPoolUsed: new Gauge({
    name: "db_connection_pool_used",
    help: "Database connection pool used connections",
    labelNames: ["service"],
  }),

  dbQueryDurationByType: new Histogram({
    name: "db_query_duration_by_type_seconds",
    help: "Duration of database queries by type",
    labelNames: ["operation", "table", "service"],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  }),

  // Cache metrics
  cacheHitRatio: new Gauge({
    name: "cache_hit_ratio",
    help: "Cache hit ratio",
    labelNames: ["cache", "service"],
  }),

  cacheSize: new Gauge({
    name: "cache_size",
    help: "Cache size in bytes",
    labelNames: ["cache", "service"],
  }),

  cacheOperationDuration: new Histogram({
    name: "cache_operation_duration_seconds",
    help: "Duration of cache operations",
    labelNames: ["operation", "cache", "service"],
    buckets: [0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
  }),

  // Kafka metrics
  kafkaMessageSize: new Histogram({
    name: "kafka_message_size_bytes",
    help: "Size of Kafka messages in bytes",
    labelNames: ["topic", "service"],
    buckets: [100, 500, 1000, 5000, 10000, 50000, 100000],
  }),

  kafkaConsumerLagByPartition: new Gauge({
    name: "kafka_consumer_lag_by_partition",
    help: "Kafka consumer lag by partition",
    labelNames: ["topic", "partition", "consumer_group", "service"],
  }),

  kafkaProducerQueueSize: new Gauge({
    name: "kafka_producer_queue_size",
    help: "Kafka producer queue size",
    labelNames: ["service"],
  }),

  // Service metrics
  serviceUptime: new Gauge({
    name: "service_uptime_seconds",
    help: "Service uptime in seconds",
    labelNames: ["service"],
  }),

  serviceMemoryUsage: new Gauge({
    name: "service_memory_usage_bytes",
    help: "Service memory usage in bytes",
    labelNames: ["service", "type"],
  }),

  serviceCpuUsage: new Gauge({
    name: "service_cpu_usage_percent",
    help: "Service CPU usage in percent",
    labelNames: ["service"],
  }),

  // Business metrics
  activeUsers: new Gauge({
    name: "active_users",
    help: "Number of active users",
    labelNames: ["tenant", "timeframe"],
  }),

  activeProjects: new Gauge({
    name: "active_projects",
    help: "Number of active projects",
    labelNames: ["tenant"],
  }),

  activeTasks: new Gauge({
    name: "active_tasks",
    help: "Number of active tasks",
    labelNames: ["tenant", "status"],
  }),

  // Tenant metrics
  tenantResourceUsage: new Gauge({
    name: "tenant_resource_usage",
    help: "Tenant resource usage",
    labelNames: ["tenant", "resource_type"],
  }),

  tenantApiUsage: new Counter({
    name: "tenant_api_usage_total",
    help: "Tenant API usage",
    labelNames: ["tenant", "endpoint", "method"],
  }),

  // Feature usage metrics
  featureUsage: new Counter({
    name: "feature_usage_total",
    help: "Feature usage count",
    labelNames: ["tenant", "feature", "user_role"],
  }),

  // Error metrics
  errorsByType: new Counter({
    name: "errors_by_type_total",
    help: "Errors by type",
    labelNames: ["service", "error_type", "tenant"],
  }),

  // Performance metrics
  gcDuration: new Histogram({
    name: "nodejs_gc_duration_seconds",
    help: "Node.js garbage collection duration",
    labelNames: ["gc_type"],
    buckets: [0.001, 0.01, 0.1, 1, 2, 5],
  }),

  eventLoopLag: new Gauge({
    name: "nodejs_eventloop_lag_seconds",
    help: "Node.js event loop lag in seconds",
    labelNames: ["service"],
  }),

  // Request tracing metrics
  requestTracingDuration: new Summary({
    name: "request_tracing_duration_seconds",
    help: "Request tracing duration in seconds",
    labelNames: ["service", "operation"],
    percentiles: [0.5, 0.9, 0.95, 0.99],
  }),

  // Multi-region metrics
  regionLatency: new Histogram({
    name: "region_latency_seconds",
    help: "Latency between regions",
    labelNames: ["source_region", "target_region", "operation"],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  }),

  regionAvailability: new Gauge({
    name: "region_availability",
    help: "Region availability (1 = available, 0 = unavailable)",
    labelNames: ["region"],
  }),

  crossRegionReplicationLag: new Gauge({
    name: "cross_region_replication_lag_seconds",
    help: "Cross-region replication lag in seconds",
    labelNames: ["source_region", "target_region", "data_type"],
  }),
}

// Update service metrics periodically
export const startMetricsCollection = (serviceName: string, interval = 15000) => {
  const startTime = Date.now()
  logger.info(`Starting advanced metrics collection for ${serviceName}`)

  // Initial collection
  collectServiceMetrics(serviceName, startTime)

  // Schedule periodic collection
  const timerId = setInterval(() => {
    collectServiceMetrics(serviceName, startTime)
  }, interval)

  // Return a function to stop collection
  return () => {
    clearInterval(timerId)
    logger.info(`Stopped advanced metrics collection for ${serviceName}`)
  }
}

// Collect service metrics
const collectServiceMetrics = (serviceName: string, startTime: number) => {
  try {
    // Update uptime
    const uptimeSeconds = (Date.now() - startTime) / 1000
    advancedMetrics.serviceUptime.set({ service: serviceName }, uptimeSeconds)

    // Update memory usage
    const memoryUsage = process.memoryUsage()
    advancedMetrics.serviceMemoryUsage.set({ service: serviceName, type: "rss" }, memoryUsage.rss)
    advancedMetrics.serviceMemoryUsage.set({ service: serviceName, type: "heapTotal" }, memoryUsage.heapTotal)
    advancedMetrics.serviceMemoryUsage.set({ service: serviceName, type: "heapUsed" }, memoryUsage.heapUsed)
    advancedMetrics.serviceMemoryUsage.set({ service: serviceName, type: "external" }, memoryUsage.external)
    if (memoryUsage.arrayBuffers) {
      advancedMetrics.serviceMemoryUsage.set({ service: serviceName, type: "arrayBuffers" }, memoryUsage.arrayBuffers)
    }

    // Update CPU usage
    const cpus = os.cpus()
    let totalIdle = 0
    let totalTick = 0

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type]
      }
      totalIdle += cpu.times.idle
    }

    const idle = totalIdle / cpus.length
    const total = totalTick / cpus.length
    const usage = 100 - (idle / total) * 100

    advancedMetrics.serviceCpuUsage.set({ service: serviceName }, usage)

    // Update event loop lag
    const start = Date.now()
    setImmediate(() => {
      const lag = (Date.now() - start) / 1000
      advancedMetrics.eventLoopLag.set({ service: serviceName }, lag)
    })
  } catch (error) {
    logger.error(`Error collecting service metrics: ${error.message}`, error)
  }
}

// Track HTTP request metrics
export const trackHttpRequest = (
  method: string,
  route: string,
  statusCode: number,
  startTime: number,
  requestSize: number,
  responseSize: number,
  tenantId?: string,
) => {
  const duration = (Date.now() - startTime) / 1000

  // Track request duration
  advancedMetrics.httpRequestDurationByEndpoint.observe(
    {
      method,
      route,
      status: statusCode.toString(),
      tenant: tenantId || "unknown",
    },
    duration,
  )

  // Track request size
  advancedMetrics.httpRequestSizeBytes.observe(
    {
      method,
      route,
    },
    requestSize,
  )

  // Track response size
  advancedMetrics.httpResponseSizeBytes.observe(
    {
      method,
      route,
      status: statusCode.toString(),
    },
    responseSize,
  )

  // Track tenant API usage
  if (tenantId) {
    advancedMetrics.tenantApiUsage.inc({
      tenant: tenantId,
      endpoint: route,
      method,
    })
  }
}

// Track database query metrics
export const trackDatabaseQuery = (
  operation: string,
  table: string,
  serviceName: string,
  startTime: number,
  success: boolean,
) => {
  const duration = (Date.now() - startTime) / 1000

  // Track query duration
  advancedMetrics.dbQueryDurationByType.observe(
    {
      operation,
      table,
      service: serviceName,
    },
    duration,
  )

  // Track errors if query failed
  if (!success) {
    advancedMetrics.errorsByType.inc({
      service: serviceName,
      error_type: "database_error",
      tenant: "all",
    })
  }
}

// Track cache operations
export const trackCacheOperation = (
  operation: string,
  cache: string,
  serviceName: string,
  startTime: number,
  success: boolean,
) => {
  const duration = (Date.now() - startTime) / 1000

  // Track operation duration
  advancedMetrics.cacheOperationDuration.observe(
    {
      operation,
      cache,
      service: serviceName,
    },
    duration,
  )

  // Track errors if operation failed
  if (!success) {
    advancedMetrics.errorsByType.inc({
      service: serviceName,
      error_type: "cache_error",
      tenant: "all",
    })
  }
}

// Update cache hit ratio
export const updateCacheHitRatio = (cache: string, serviceName: string, hits: number, misses: number) => {
  const total = hits + misses
  const ratio = total > 0 ? hits / total : 0
  advancedMetrics.cacheHitRatio.set({ cache, service: serviceName }, ratio)
}

// Track Kafka message metrics
export const trackKafkaMessage = (topic: string, serviceName: string, messageSize: number) => {
  advancedMetrics.kafkaMessageSize.observe(
    {
      topic,
      service: serviceName,
    },
    messageSize,
  )
}

// Update Kafka consumer lag
export const updateKafkaConsumerLag = (
  topic: string,
  partition: number,
  consumerGroup: string,
  serviceName: string,
  lag: number,
) => {
  advancedMetrics.kafkaConsumerLagByPartition.set(
    {
      topic,
      partition: partition.toString(),
      consumer_group: consumerGroup,
      service: serviceName,
    },
    lag,
  )
}

// Track feature usage
export const trackFeatureUsage = (tenantId: string, feature: string, userRole: string) => {
  advancedMetrics.featureUsage.inc({
    tenant: tenantId,
    feature,
    user_role: userRole,
  })
}

// Track errors
export const trackError = (serviceName: string, errorType: string, tenantId = "all") => {
  advancedMetrics.errorsByType.inc({
    service: serviceName,
    error_type: errorType,
    tenant: tenantId,
  })
}

// Track request tracing
export const trackRequestTracing = (serviceName: string, operation: string, duration: number) => {
  advancedMetrics.requestTracingDuration.observe(
    {
      service: serviceName,
      operation,
    },
    duration,
  )
}

// Track multi-region metrics
export const trackRegionLatency = (sourceRegion: string, targetRegion: string, operation: string, latency: number) => {
  advancedMetrics.regionLatency.observe(
    {
      source_region: sourceRegion,
      target_region: targetRegion,
      operation,
    },
    latency,
  )
}

// Update region availability
export const updateRegionAvailability = (region: string, available: boolean) => {
  advancedMetrics.regionAvailability.set({ region }, available ? 1 : 0)
}

// Update cross-region replication lag
export const updateCrossRegionReplicationLag = (
  sourceRegion: string,
  targetRegion: string,
  dataType: string,
  lagSeconds: number,
) => {
  advancedMetrics.crossRegionReplicationLag.set(
    {
      source_region: sourceRegion,
      target_region: targetRegion,
      data_type: dataType,
    },
    lagSeconds,
  )
}

export default {
  advancedMetrics,
  startMetricsCollection,
  trackHttpRequest,
  trackDatabaseQuery,
  trackCacheOperation,
  updateCacheHitRatio,
  trackKafkaMessage,
  updateKafkaConsumerLag,
  trackFeatureUsage,
  trackError,
  trackRequestTracing,
  trackRegionLatency,
  updateRegionAvailability,
  updateCrossRegionReplicationLag,
}

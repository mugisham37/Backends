import promClient from "prom-client"
import type express from "express"

// Create a Registry to register the metrics
const register = new promClient.Registry()

// Add a default label to all metrics
register.setDefaultLabels({
  app: process.env.APP_NAME || "saas-platform",
})

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register })

// HTTP request counter
export const httpRequestsTotal = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"],
  registers: [register],
})

// HTTP request duration
export const httpRequestDurationSeconds = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
})

// Database query counter
export const dbQueriesTotal = new promClient.Counter({
  name: "db_queries_total",
  help: "Total number of database queries",
  labelNames: ["operation", "success"],
  registers: [register],
})

// Database query duration
export const dbQueryDurationSeconds = new promClient.Histogram({
  name: "db_query_duration_seconds",
  help: "Duration of database queries in seconds",
  labelNames: ["operation"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
})

// Cache hit counter
export const cacheHitsTotal = new promClient.Counter({
  name: "cache_hits_total",
  help: "Total number of cache hits",
  labelNames: ["cache"],
  registers: [register],
})

// Cache miss counter
export const cacheMissesTotal = new promClient.Counter({
  name: "cache_misses_total",
  help: "Total number of cache misses",
  labelNames: ["cache"],
  registers: [register],
})

// API error counter
export const apiErrorsTotal = new promClient.Counter({
  name: "api_errors_total",
  help: "Total number of API errors",
  labelNames: ["method", "route", "code"],
  registers: [register],
})

// Active users gauge
export const activeUsersGauge = new promClient.Gauge({
  name: "active_users",
  help: "Number of active users",
  labelNames: ["tenant"],
  registers: [register],
})

// Database connections gauge
export const dbConnectionsGauge = new promClient.Gauge({
  name: "db_connections",
  help: "Number of database connections",
  labelNames: ["state"], // 'idle', 'active', 'waiting'
  registers: [register],
})

// Database connection pool metrics
export const dbConnectionsUsed = new promClient.Gauge({
  name: "db_connections_used",
  help: "Number of used database connections",
  labelNames: ["service"],
  registers: [register],
})

export const dbConnectionsMax = new promClient.Gauge({
  name: "db_connections_max",
  help: "Maximum number of database connections",
  labelNames: ["service"],
  registers: [register],
})

// Kafka consumer lag
export const kafkaConsumerLag = new promClient.Gauge({
  name: "kafka_consumer_lag",
  help: "Kafka consumer lag",
  labelNames: ["topic", "partition", "consumergroup"],
  registers: [register],
})

// Kafka message counter
export const kafkaMessagesTotal = new promClient.Counter({
  name: "kafka_messages_total",
  help: "Total number of Kafka messages",
  labelNames: ["topic", "status"], // 'produced', 'consumed', 'failed'
  registers: [register],
})

// Job processing metrics
export const jobsProcessedTotal = new promClient.Counter({
  name: "jobs_processed_total",
  help: "Total number of jobs processed",
  labelNames: ["queue", "status"], // 'completed', 'failed'
  registers: [register],
})

export const jobProcessingDurationSeconds = new promClient.Histogram({
  name: "job_processing_duration_seconds",
  help: "Duration of job processing in seconds",
  labelNames: ["queue"],
  buckets: [0.01, 0.1, 1, 5, 10, 30, 60, 300, 600],
  registers: [register],
})

// Memory usage gauge
export const memoryUsageGauge = new promClient.Gauge({
  name: "memory_usage_bytes",
  help: "Memory usage in bytes",
  labelNames: ["type"], // 'rss', 'heapTotal', 'heapUsed', 'external'
  registers: [register],
})

// Update memory usage metrics
export const updateMemoryMetrics = () => {
  const memoryUsage = process.memoryUsage()
  memoryUsageGauge.set({ type: "rss" }, memoryUsage.rss)
  memoryUsageGauge.set({ type: "heapTotal" }, memoryUsage.heapTotal)
  memoryUsageGauge.set({ type: "heapUsed" }, memoryUsage.heapUsed)
  memoryUsageGauge.set({ type: "external" }, memoryUsage.external)
}

// Update memory metrics every 15 seconds
setInterval(updateMemoryMetrics, 15000)

// Metrics middleware for Express
export const metricsMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now()

  // Record request
  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000
    const route = req.route ? req.route.path : req.path
    const method = req.method
    const status = res.statusCode

    httpRequestsTotal.inc({ method, route, status })
    httpRequestDurationSeconds.observe({ method, route, status }, duration)

    if (status >= 400) {
      apiErrorsTotal.inc({ method, route, code: status })
    }
  })

  next()
}

// Metrics endpoint for Prometheus scraping
export const metricsEndpoint = async (req: express.Request, res: express.Response) => {
  try {
    res.set("Content-Type", register.contentType)
    res.end(await register.metrics())
  } catch (err) {
    res.status(500).end(err)
  }
}

// Database metrics wrapper\
export const withDbMetrics = async <T>(operation: string, queryFn: () => Promise<T>)
: Promise<T> =>
{
  const start = Date.now()
  try {
    const result = await queryFn()
    const duration = (Date.now() - start) / 1000
    dbQueriesTotal.inc({ operation, success: "true" })
    dbQueryDurationSeconds.observe({ operation }, duration)
    return result;
  } catch (error) {
    const duration = (Date.now() - start) / 1000
    dbQueriesTotal.inc({ operation, success: "false" })
    dbQueryDurationSeconds.observe({ operation }, duration)
    throw error
  }
}

// Cache metrics helpers
export const recordCacheHit = (cache: string) => {
  cacheHitsTotal.inc({ cache })
}

export const recordCacheMiss = (cache: string) => {
  cacheMissesTotal.inc({ cache })
}

// Update active users count
export const updateActiveUsers = (tenant: string, count: number) => {
  activeUsersGauge.set({ tenant }, count)
}

// Update database connection metrics
export const updateDbConnectionMetrics = (service: string, used: number, max: number) => {
  dbConnectionsUsed.set({ service }, used)
  dbConnectionsMax.set({ service }, max)
}

// Update Kafka consumer lag
export const updateKafkaConsumerLag = (topic: string, partition: string, consumergroup: string, lag: number) => {
  kafkaConsumerLag.set({ topic, partition, consumergroup }, lag)
}

// Record Kafka message
export const recordKafkaMessage = (topic: string, status: "produced" | "consumed" | "failed") => {
  kafkaMessagesTotal.inc({ topic, status })
}

// Record job processing
export const recordJobProcessed = (queue: string, status: "completed" | "failed") => {
  jobsProcessedTotal.inc({ queue, status })
}

export const recordJobProcessingDuration = (queue: string, durationSeconds: number) => {
  jobProcessingDurationSeconds.observe({ queue }, durationSeconds)
}

export default {
  register,
  metricsMiddleware,
  metricsEndpoint,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  dbQueriesTotal,
  dbQueryDurationSeconds,
  cacheHitsTotal,
  cacheMissesTotal,
  apiErrorsTotal,
  activeUsersGauge,
  dbConnectionsGauge,
  dbConnectionsUsed,
  dbConnectionsMax,
  kafkaConsumerLag,
  kafkaMessagesTotal,
  jobsProcessedTotal,
  jobProcessingDurationSeconds,
  memoryUsageGauge,
  updateMemoryMetrics,
  withDbMetrics,
  recordCacheHit,
  recordCacheMiss,
  updateActiveUsers,
  updateDbConnectionMetrics,
  updateKafkaConsumerLag,
  recordKafkaMessage,
  recordJobProcessed,
  recordJobProcessingDuration,
}

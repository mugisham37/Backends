import axios from "axios"
import type { Redis } from "ioredis"
import { logger } from "./logger"
import { config } from "../config"
import {
  trackRegionLatency,
  updateRegionAvailability,
  updateCrossRegionReplicationLag,
} from "../monitoring/advanced-monitoring"

// Region configuration
interface RegionConfig {
  name: string
  apiUrl: string
  primary: boolean
  active: boolean
  lastHeartbeat?: number
  latency?: number
}

// Global state
const currentRegion: string = process.env.AWS_REGION || "us-east-1"
let regions: RegionConfig[] = []
let primaryRegion = ""
let redisClient: Redis | null = null

/**
 * Initialize multi-region support
 * @param redis Redis client for cross-region communication
 */
export const initMultiRegion = async (redis: Redis): Promise<void> => {
  redisClient = redis
  logger.info(`Initializing multi-region support in region ${currentRegion}`)

  try {
    // Load region configuration from environment or config service
    await loadRegionConfig()

    // Set up heartbeat for this region
    startHeartbeat()

    // Set up health check for other regions
    startHealthCheck()

    // Subscribe to region status changes
    subscribeToRegionStatus()

    logger.info(`Multi-region support initialized with ${regions.length} regions`)
    logger.info(`Current region: ${currentRegion}, Primary region: ${primaryRegion}`)
  } catch (error) {
    logger.error(`Failed to initialize multi-region support: ${error.message}`, error)
    throw error
  }
}

/**
 * Load region configuration
 */
const loadRegionConfig = async (): Promise<void> => {
  try {
    // Try to load from Redis first (for dynamic updates)
    if (redisClient) {
      const regionsJson = await redisClient.get("system:regions")
      if (regionsJson) {
        regions = JSON.parse(regionsJson)
        primaryRegion = regions.find((r) => r.primary)?.name || ""
        return
      }
    }

    // Fall back to environment variables
    const regionNames = process.env.REGIONS ? process.env.REGIONS.split(",") : ["us-east-1", "us-west-2", "eu-west-1"]
    const primaryRegionName = process.env.PRIMARY_REGION || regionNames[0]

    regions = regionNames.map((name) => ({
      name,
      apiUrl: process.env[`API_URL_${name.replace(/-/g, "_").toUpperCase()}`] || `https://api-${name}.${config.domain}`,
      primary: name === primaryRegionName,
      active: true,
    }))

    primaryRegion = primaryRegionName

    // Save to Redis for other instances
    if (redisClient) {
      await redisClient.set("system:regions", JSON.stringify(regions))
    }
  } catch (error) {
    logger.error(`Failed to load region configuration: ${error.message}`, error)
    // Fall back to minimal configuration
    regions = [
      {
        name: currentRegion,
        apiUrl: `https://api.${config.domain}`,
        primary: true,
        active: true,
      },
    ]
    primaryRegion = currentRegion
  }
}

/**
 * Start heartbeat for this region
 */
const startHeartbeat = (): void => {
  const interval = Number.parseInt(process.env.REGION_HEARTBEAT_INTERVAL || "10000", 10)

  const sendHeartbeat = async () => {
    if (!redisClient) return

    try {
      const timestamp = Date.now()
      await redisClient.set(`region:heartbeat:${currentRegion}`, timestamp.toString())
      await redisClient.expire(`region:heartbeat:${currentRegion}`, 30) // TTL of 30 seconds

      // Publish region status
      await redisClient.publish(
        "region:status",
        JSON.stringify({
          region: currentRegion,
          status: "active",
          timestamp,
        }),
      )
    } catch (error) {
      logger.error(`Failed to send region heartbeat: ${error.message}`)
    }
  }

  // Send initial heartbeat
  sendHeartbeat()

  // Set up interval
  setInterval(sendHeartbeat, interval)
}

/**
 * Start health check for other regions
 */
const startHealthCheck = (): void => {
  const interval = Number.parseInt(process.env.REGION_HEALTH_CHECK_INTERVAL || "30000", 10)

  const checkRegionsHealth = async () => {
    if (!redisClient) return

    for (const region of regions) {
      if (region.name === currentRegion) continue

      try {
        // Check heartbeat in Redis
        const heartbeat = await redisClient.get(`region:heartbeat:${region.name}`)
        const heartbeatTimestamp = heartbeat ? Number.parseInt(heartbeat, 10) : 0
        const heartbeatAge = Date.now() - heartbeatTimestamp

        // Check API health
        const startTime = Date.now()
        const response = await axios.get(`${region.apiUrl}/health`, {
          timeout: 5000,
          headers: {
            "X-Source-Region": currentRegion,
          },
        })
        const latency = Date.now() - startTime

        // Update region status
        const wasActive = region.active
        region.active = response.status === 200 && heartbeatAge < 60000 // Less than 60 seconds old
        region.latency = latency
        region.lastHeartbeat = heartbeatTimestamp

        // Track metrics
        trackRegionLatency(currentRegion, region.name, "health_check", latency / 1000)
        updateRegionAvailability(region.name, region.active)

        // Log status change
        if (wasActive !== region.active) {
          logger.info(`Region ${region.name} status changed to ${region.active ? "active" : "inactive"}`)

          // Publish region status change
          await redisClient.publish(
            "region:status",
            JSON.stringify({
              region: region.name,
              status: region.active ? "active" : "inactive",
              timestamp: Date.now(),
            }),
          )
        }
      } catch (error) {
        logger.warn(`Failed to check health of region ${region.name}: ${error.message}`)

        // Mark region as inactive
        if (region.active) {
          region.active = false
          updateRegionAvailability(region.name, false)

          // Publish region status change
          await redisClient.publish(
            "region:status",
            JSON.stringify({
              region: region.name,
              status: "inactive",
              timestamp: Date.now(),
            }),
          )
        }
      }
    }

    // Update regions in Redis
    await redisClient.set("system:regions", JSON.stringify(regions))
  }

  // Initial health check
  checkRegionsHealth()

  // Set up interval
  setInterval(checkRegionsHealth, interval)
}

/**
 * Subscribe to region status changes
 */
const subscribeToRegionStatus = (): void => {
  if (!redisClient) return

  const statusChannel = redisClient.duplicate()

  statusChannel.subscribe("region:status", (err) => {
    if (err) {
      logger.error(`Failed to subscribe to region status channel: ${err.message}`)
      return
    }

    logger.info("Subscribed to region status channel")
  })

  statusChannel.on("message", (channel, message) => {
    if (channel !== "region:status") return

    try {
      const status = JSON.parse(message)
      logger.debug(`Received region status update: ${JSON.stringify(status)}`)

      // Update region status
      const region = regions.find((r) => r.name === status.region)
      if (region) {
        const wasActive = region.active
        region.active = status.status === "active"
        region.lastHeartbeat = status.timestamp

        // Log status change
        if (wasActive !== region.active) {
          logger.info(`Region ${region.name} status changed to ${region.active ? "active" : "inactive"}`)
        }
      }
    } catch (error) {
      logger.error(`Failed to process region status message: ${error.message}`)
    }
  })
}

/**
 * Get the current active regions
 * @returns List of active regions
 */
export const getActiveRegions = (): RegionConfig[] => {
  return regions.filter((r) => r.active)
}

/**
 * Get the primary region
 * @returns Primary region configuration
 */
export const getPrimaryRegion = (): RegionConfig | undefined => {
  return regions.find((r) => r.primary)
}

/**
 * Check if the current region is the primary region
 * @returns True if the current region is primary
 */
export const isPrimaryRegion = (): boolean => {
  return currentRegion === primaryRegion
}

/**
 * Make a cross-region API request
 * @param region Target region
 * @param path API path
 * @param method HTTP method
 * @param data Request data
 * @param headers Additional headers
 * @returns API response
 */
export const crossRegionRequest = async <T>(\
  region: string,
  path: string,
  method: string = "GET",
  data?: any,
  headers: Record<string, string> = {}
)
: Promise<T> =>
{
  const targetRegion = regions.find((r) => r.name === region)
  if (!targetRegion || !targetRegion.active) {
    throw new Error(`Region ${region} is not available`)
  }

  const startTime = Date.now()

  try {
    const response = await axios({
      method,
      url: `${targetRegion.apiUrl}${path}`,
      data,
      headers: {
        ...headers,
        "X-Source-Region": currentRegion,
        "X-Cross-Region-Request": "true",
      },
      timeout: 10000,
    })

    // Track latency
    const latency = (Date.now() - startTime) / 1000
    trackRegionLatency(currentRegion, region, `${method}:${path}`, latency)

    return response.data
  } catch (error) {
    logger.error(`Cross-region request to ${region} failed: ${error.message}`)
    throw error
  }
}

/**
 * Replicate data to other regions
 * @param key Redis key
 * @param value Data value
 * @param ttl TTL in seconds (optional)
 */
export const replicateData = async (key: string, value: string, ttl?: number): Promise<void> => {
  if (!redisClient) return

  try {
    // Store in local Redis
    if (ttl) {
      await redisClient.set(key, value, "EX", ttl)
    } else {
      await redisClient.set(key, value)
    }

    // Publish for other regions to consume
    await redisClient.publish(
      "data:replicate",
      JSON.stringify({
        key,
        value,
        ttl,
        sourceRegion: currentRegion,
        timestamp: Date.now(),
      }),
    )
  } catch (error) {
    logger.error(`Failed to replicate data for key ${key}: ${error.message}`)
    throw error
  }
}

/**
 * Subscribe to data replication events
 */
export const subscribeToDataReplication = (): void => {
  if (!redisClient) return

  const replicationChannel = redisClient.duplicate()

  replicationChannel.subscribe("data:replicate", (err) => {
    if (err) {
      logger.error(`Failed to subscribe to data replication channel: ${err.message}`)
      return
    }

    logger.info("Subscribed to data replication channel")
  })

  replicationChannel.on("message", async (channel, message) => {
    if (channel !== "data:replicate") return

    try {
      const data = JSON.parse(message)

      // Skip if this is our own message
      if (data.sourceRegion === currentRegion) return

      // Store the replicated data
      if (data.ttl) {
        await redisClient.set(data.key, data.value, "EX", data.ttl)
      } else {
        await redisClient.set(data.key, data.value)
      }

      // Calculate and track replication lag
      const lag = (Date.now() - data.timestamp) / 1000
      updateCrossRegionReplicationLag(data.sourceRegion, currentRegion, "redis", lag)

      logger.debug(`Replicated data for key ${data.key} from region ${data.sourceRegion} (lag: ${lag.toFixed(3)}s)`)
    } catch (error) {
      logger.error(`Failed to process data replication message: ${error.message}`)
    }
  })
}

/**
 * Get the API URL for a specific region
 * @param region Region name
 * @returns API URL for the region
 */
export const getRegionApiUrl = (region: string): string => {
  const regionConfig = regions.find((r) => r.name === region)
  return regionConfig?.apiUrl || `https://api-${region}.${config.domain}`
}

/**
 * Get the current region
 * @returns Current region name
 */
export const getCurrentRegion = (): string => {
  return currentRegion
}

export default {
  initMultiRegion,
  getActiveRegions,
  getPrimaryRegion,
  isPrimaryRegion,
  crossRegionRequest,
  replicateData,
  subscribeToDataReplication,
  getRegionApiUrl,
  getCurrentRegion,
}

import { createConsumer } from "../utils/kafka-client"
import prisma from "../utils/prisma"
import { logger } from "../utils/logger"
import redisClient from "../utils/redis-client"

export const setupKafkaConsumers = async () => {
  try {
    // Create consumers
    const userEventsConsumer = createConsumer("analytics-user-events")
    const projectEventsConsumer = createConsumer("analytics-project-events")
    const taskEventsConsumer = createConsumer("analytics-task-events")
    const apiEventsConsumer = createConsumer("analytics-api-events")

    // Connect consumers
    await userEventsConsumer.connect()
    await projectEventsConsumer.connect()
    await taskEventsConsumer.connect()
    await apiEventsConsumer.connect()

    // Subscribe to topics
    await userEventsConsumer.subscribe({ topics: ["user-events"] })
    await projectEventsConsumer.subscribe({ topics: ["project-events"] })
    await taskEventsConsumer.subscribe({ topics: ["task-events"] })
    await apiEventsConsumer.subscribe({ topics: ["api-events"] })

    // Process user events
    userEventsConsumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const eventData = JSON.parse(message.value!.toString())
          logger.info(`Received user event: ${eventData.type}`, { topic, partition })

          // Track event
          await prisma.analyticsEvent.create({
            data: {
              name: eventData.type,
              tenantId: eventData.tenantId,
              userId: eventData.userId,
              properties: eventData.data || {},
              timestamp: new Date(eventData.timestamp || Date.now()),
            },
          })

          // Update real-time counters in Redis
          await redisClient.hincrby(`tenant:${eventData.tenantId}:events:count`, eventData.type, 1)

          // If it's a user creation event, update user count
          if (eventData.type === "user_created") {
            await redisClient.hincrby(`tenant:${eventData.tenantId}:stats`, "total_users", 1)
          }
        } catch (error) {
          logger.error("Error processing user event:", error)
        }
      },
    })

    // Process project events
    projectEventsConsumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const eventData = JSON.parse(message.value!.toString())
          logger.info(`Received project event: ${eventData.type}`, { topic, partition })

          // Track event
          await prisma.analyticsEvent.create({
            data: {
              name: eventData.type,
              tenantId: eventData.tenantId,
              userId: eventData.userId,
              properties: eventData.data || {},
              timestamp: new Date(eventData.timestamp || Date.now()),
            },
          })

          // Update real-time counters in Redis
          await redisClient.hincrby(`tenant:${eventData.tenantId}:events:count`, eventData.type, 1)

          // If it's a project creation event, update project count
          if (eventData.type === "project_created") {
            await redisClient.hincrby(`tenant:${eventData.tenantId}:stats`, "total_projects", 1)
          }
        } catch (error) {
          logger.error("Error processing project event:", error)
        }
      },
    })

    // Process task events
    taskEventsConsumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const eventData = JSON.parse(message.value!.toString())
          logger.info(`Received task event: ${eventData.type}`, { topic, partition })

          // Track event
          await prisma.analyticsEvent.create({
            data: {
              name: eventData.type,
              tenantId: eventData.tenantId,
              userId: eventData.userId,
              properties: eventData.data || {},
              timestamp: new Date(eventData.timestamp || Date.now()),
            },
          })

          // Update real-time counters in Redis
          await redisClient.hincrby(`tenant:${eventData.tenantId}:events:count`, eventData.type, 1)

          // If it's a task creation event, update task count
          if (eventData.type === "task_created") {
            await redisClient.hincrby(`tenant:${eventData.tenantId}:stats`, "total_tasks", 1)
          }

          // If it's a task completion event, update completed task count
          if (eventData.type === "task_completed") {
            await redisClient.hincrby(`tenant:${eventData.tenantId}:stats`, "completed_tasks", 1)
          }
        } catch (error) {
          logger.error("Error processing task event:", error)
        }
      },
    })

    // Process API events
    apiEventsConsumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const eventData = JSON.parse(message.value!.toString())
          logger.info(`Received API event: ${eventData.type}`, { topic, partition })

          // Track event
          await prisma.analyticsEvent.create({
            data: {
              name: eventData.type,
              tenantId: eventData.tenantId,
              userId: eventData.userId,
              properties: eventData.data || {},
              timestamp: new Date(eventData.timestamp || Date.now()),
            },
          })

          // Update real-time counters in Redis
          await redisClient.hincrby(`tenant:${eventData.tenantId}:events:count`, eventData.type, 1)

          // Track API call metrics
          if (eventData.type === "api_request") {
            await redisClient.hincrby(`tenant:${eventData.tenantId}:stats`, "api_calls", 1)

            // Track response time
            if (eventData.data?.responseTime) {
              await redisClient.lpush(
                `tenant:${eventData.tenantId}:response_times`,
                eventData.data.responseTime.toString(),
              )
              // Keep only the last 1000 response times
              await redisClient.ltrim(`tenant:${eventData.tenantId}:response_times`, 0, 999)
            }

            // Track errors
            if (eventData.data?.status >= 400) {
              await redisClient.hincrby(`tenant:${eventData.tenantId}:stats`, "api_errors", 1)
            }
          }
        } catch (error) {
          logger.error("Error processing API event:", error)
        }
      },
    })

    logger.info("Kafka consumers set up successfully")
  } catch (error) {
    logger.error("Error setting up Kafka consumers:", error)
    throw error
  }
}

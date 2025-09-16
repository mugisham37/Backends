import { createConsumer } from "../utils/kafka-client"
import { logger } from "../utils/logger"
import { prisma } from "../utils/prisma"
import redisClient from "../utils/redis-client"

export const initKafkaConsumers = async () => {
  try {
    // Handle user events
    const userEventsConsumer = await createConsumer("tenant-service-user-events", ["user-events"], async (message) => {
      try {
        if (message.type === "USER_CREATED") {
          logger.info(`Received USER_CREATED event for user ${message.data.id} in tenant ${message.data.tenantId}`)

          // You could update tenant statistics here
          // For example, count of users per tenant
        }
      } catch (error) {
        logger.error(`Error processing user event: ${error instanceof Error ? error.message : String(error)}`)
      }
    })

    // Handle billing events
    const billingEventsConsumer = await createConsumer(
      "tenant-service-billing-events",
      ["billing-events"],
      async (message) => {
        try {
          if (message.type === "SUBSCRIPTION_UPDATED") {
            logger.info(`Received SUBSCRIPTION_UPDATED event for tenant ${message.data.tenantId}`)

            // Update tenant plan based on subscription
            const { tenantId, plan } = message.data

            await prisma.tenant.update({
              where: { id: tenantId },
              data: { plan },
            })

            // Update tenant settings based on new plan
            const planLimits = {
              free: { maxUsers: 5, maxProjects: 10, maxStorage: 1024 },
              pro: { maxUsers: 20, maxProjects: 50, maxStorage: 5120 },
              enterprise: { maxUsers: 100, maxProjects: 500, maxStorage: 51200 },
            }

            const limits = planLimits[plan as keyof typeof planLimits] || planLimits.free

            await prisma.tenantSettings.update({
              where: { tenantId },
              data: limits,
            })

            // Clear cache
            await redisClient.del(`tenant:${tenantId}`)

            // Get tenant to clear slug and domain cache
            const tenant = await prisma.tenant.findUnique({
              where: { id: tenantId },
            })

            if (tenant) {
              await redisClient.del(`tenant:${tenant.slug}`)
              if (tenant.domain) {
                await redisClient.del(`tenant:${tenant.domain}`)
              }
            }
          }

          if (message.type === "SUBSCRIPTION_CANCELED") {
            logger.info(`Received SUBSCRIPTION_CANCELED event for tenant ${message.data.tenantId}`)

            // Downgrade tenant to free plan
            const { tenantId } = message.data

            await prisma.tenant.update({
              where: { id: tenantId },
              data: { plan: "free" },
            })

            // Update tenant settings to free plan limits
            await prisma.tenantSettings.update({
              where: { tenantId },
              data: { maxUsers: 5, maxProjects: 10, maxStorage: 1024 },
            })

            // Clear cache
            await redisClient.del(`tenant:${tenantId}`)

            // Get tenant to clear slug and domain cache
            const tenant = await prisma.tenant.findUnique({
              where: { id: tenantId },
            })

            if (tenant) {
              await redisClient.del(`tenant:${tenant.slug}`)
              if (tenant.domain) {
                await redisClient.del(`tenant:${tenant.domain}`)
              }
            }
          }
        } catch (error) {
          logger.error(`Error processing billing event: ${error instanceof Error ? error.message : String(error)}`)
        }
      },
    )

    logger.info("Kafka consumers initialized")

    // Handle graceful shutdown
    process.on("SIGTERM", async () => {
      try {
        await userEventsConsumer.disconnect()
        await billingEventsConsumer.disconnect()
        logger.info("Kafka consumers disconnected")
      } catch (error) {
        logger.error(`Error disconnecting Kafka consumers: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
  } catch (error) {
    logger.error(`Failed to initialize Kafka consumers: ${error instanceof Error ? error.message : String(error)}`)
  }
}

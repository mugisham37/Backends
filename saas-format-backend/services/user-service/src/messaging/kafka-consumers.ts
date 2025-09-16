import { createConsumer } from "../utils/kafka-client"
import { logger } from "../utils/logger"
import { prisma } from "../utils/prisma"

export const initKafkaConsumers = async () => {
  try {
    // Handle auth events
    const authEventsConsumer = await createConsumer("user-service-auth-events", ["auth-events"], async (message) => {
      try {
        if (message.type === "USER_LOGGED_IN") {
          logger.info(`Received USER_LOGGED_IN event for user ${message.data.userId}`)

          // Update last login time
          await prisma.user.update({
            where: { id: message.data.userId },
            data: { lastLogin: new Date(message.data.timestamp) },
          })
        }
      } catch (error) {
        logger.error(`Error processing auth event: ${error instanceof Error ? error.message : String(error)}`)
      }
    })

    // Handle tenant events
    const tenantEventsConsumer = await createConsumer(
      "user-service-tenant-events",
      ["tenant-events"],
      async (message) => {
        try {
          if (message.type === "TENANT_DELETED") {
            logger.info(`Received TENANT_DELETED event for tenant ${message.data.id}`)

            // Delete all users for this tenant
            const { count } = await prisma.user.deleteMany({
              where: { tenantId: message.data.id },
            })

            logger.info(`Deleted ${count} users for tenant ${message.data.id}`)
          }
        } catch (error) {
          logger.error(`Error processing tenant event: ${error instanceof Error ? error.message : String(error)}`)
        }
      },
    )

    logger.info("Kafka consumers initialized")

    // Handle graceful shutdown
    process.on("SIGTERM", async () => {
      try {
        await authEventsConsumer.disconnect()
        await tenantEventsConsumer.disconnect()
        logger.info("Kafka consumers disconnected")
      } catch (error) {
        logger.error(`Error disconnecting Kafka consumers: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
  } catch (error) {
    logger.error(`Failed to initialize Kafka consumers: ${error instanceof Error ? error.message : String(error)}`)
  }
}

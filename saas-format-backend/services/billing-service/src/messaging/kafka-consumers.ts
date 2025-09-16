import { createConsumer } from "../utils/kafka-client"
import { logger } from "../utils/logger"
import { prisma } from "../utils/prisma"

export const initKafkaConsumers = async () => {
  try {
    // Handle tenant events
    const tenantEventsConsumer = await createConsumer(
      "billing-service-tenant-events",
      ["tenant-events"],
      async (message) => {
        try {
          if (message.type === "TENANT_CREATED") {
            logger.info(`Received TENANT_CREATED event for tenant ${message.data.id}`)

            // Create a free subscription for the new tenant
            const existingSubscription = await prisma.subscription.findUnique({
              where: { tenantId: message.data.id },
            })

            if (!existingSubscription) {
              await prisma.subscription.create({
                data: {
                  tenantId: message.data.id,
                  plan: "free",
                  status: "active",
                  startDate: new Date(),
                },
              })

              logger.info(`Created free subscription for new tenant ${message.data.id}`)
            }
          }

          if (message.type === "TENANT_DELETED") {
            logger.info(`Received TENANT_DELETED event for tenant ${message.data.id}`)

            // Cancel subscription if exists
            const subscription = await prisma.subscription.findUnique({
              where: { tenantId: message.data.id },
            })

            if (subscription) {
              await prisma.subscription.update({
                where: { tenantId: message.data.id },
                data: {
                  status: "canceled",
                  canceledAt: new Date(),
                },
              })

              logger.info(`Canceled subscription for deleted tenant ${message.data.id}`)
            }
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

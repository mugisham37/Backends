import { createConsumer } from "../utils/kafka-client"
import { logger } from "../utils/logger"
import { prisma } from "../utils/prisma"
import redisClient from "../utils/redis-client"

export const initKafkaConsumers = async () => {
  try {
    // Handle user events
    const userEventsConsumer = await createConsumer("project-service-user-events", ["user-events"], async (message) => {
      try {
        if (message.type === "USER_CREATED") {
          logger.info(`Received USER_CREATED event for user ${message.data.id} in tenant ${message.data.tenantId}`)

          // No action needed for now, but could be used for user-related project operations
        }

        if (message.type === "USER_UPDATED") {
          logger.info(`Received USER_UPDATED event for user ${message.data.id}`)

          // Update user information in project-related data if needed
          // For example, update assignee information in tasks
          if (message.data.name || message.data.avatarUrl) {
            // This is a simplified example - in a real system, you might want to
            // update this information in a background job or use a more efficient approach
            await prisma.task.updateMany({
              where: {
                assigneeId: message.data.id,
              },
              data: {
                assigneeUpdatedAt: new Date(),
              },
            })

            // Clear cache for tasks assigned to this user
            const taskKeys = await redisClient.keys(`task:*:${message.data.id}`)
            if (taskKeys.length > 0) {
              await Promise.all(taskKeys.map((key) => redisClient.del(key)))
            }
          }
        }

        if (message.type === "USER_DELETED") {
          logger.info(`Received USER_DELETED event for user ${message.data.id}`)

          // Handle user deletion - reassign tasks, update project members, etc.
          await prisma.$transaction(async (tx) => {
            // Reassign tasks to null
            await tx.task.updateMany({
              where: {
                assigneeId: message.data.id,
              },
              data: {
                assigneeId: null,
                updatedAt: new Date(),
              },
            })

            // Remove user from project members
            await tx.projectMember.deleteMany({
              where: {
                userId: message.data.id,
              },
            })

            // Update task comments to show "Deleted User"
            await tx.comment.updateMany({
              where: {
                authorId: message.data.id,
              },
              data: {
                authorDeleted: true,
              },
            })
          })

          // Clear cache for tasks assigned to this user
          const taskKeys = await redisClient.keys(`task:*:${message.data.id}`)
          if (taskKeys.length > 0) {
            await Promise.all(taskKeys.map((key) => redisClient.del(key)))
          }

          // Clear cache for projects this user was a member of
          const projectKeys = await redisClient.keys(`project:*:members`)
          if (projectKeys.length > 0) {
            await Promise.all(projectKeys.map((key) => redisClient.del(key)))
          }
        }
      } catch (error) {
        logger.error(`Error processing user event: ${error instanceof Error ? error.message : String(error)}`)
      }
    })

    // Handle tenant events
    const tenantEventsConsumer = await createConsumer(
      "project-service-tenant-events",
      ["tenant-events"],
      async (message) => {
        try {
          if (message.type === "TENANT_CREATED") {
            logger.info(`Received TENANT_CREATED event for tenant ${message.data.id}`)

            // No action needed for now, but could be used to initialize tenant-specific project settings
          }

          if (message.type === "TENANT_UPDATED") {
            logger.info(`Received TENANT_UPDATED event for tenant ${message.data.id}`)

            // Update tenant information in project-related data if needed
            // Clear cache for this tenant's projects
            const projectKeys = await redisClient.keys(`project:${message.data.id}:*`)
            if (projectKeys.length > 0) {
              await Promise.all(projectKeys.map((key) => redisClient.del(key)))
            }
          }

          if (message.type === "TENANT_DELETED") {
            logger.info(`Received TENANT_DELETED event for tenant ${message.data.id}`)

            // Handle tenant deletion - this would typically be handled by database cascading deletes
            // But we might want to perform some cleanup or archiving

            // Clear all cache entries for this tenant
            const allKeys = await redisClient.keys(`*:${message.data.id}:*`)
            if (allKeys.length > 0) {
              await Promise.all(allKeys.map((key) => redisClient.del(key)))
            }
          }

          if (message.type === "TENANT_SETTINGS_UPDATED") {
            logger.info(`Received TENANT_SETTINGS_UPDATED event for tenant ${message.data.tenantId}`)

            // Update project settings based on tenant settings if needed
            // For example, if tenant has a max project limit, we might need to enforce it
            if (message.data.settings.maxProjects) {
              // This is just an example - actual implementation would depend on your requirements
              logger.info(
                `Tenant ${message.data.tenantId} now has a limit of ${message.data.settings.maxProjects} projects`,
              )
            }
          }
        } catch (error) {
          logger.error(`Error processing tenant event: ${error instanceof Error ? error.message : String(error)}`)
        }
      },
    )

    // Handle billing events
    const billingEventsConsumer = await createConsumer(
      "project-service-billing-events",
      ["billing-events"],
      async (message) => {
        try {
          if (message.type === "SUBSCRIPTION_UPDATED" || message.type === "SUBSCRIPTION_CREATED") {
            logger.info(`Received ${message.type} event for tenant ${message.data.tenantId}`)

            // Update project limits based on subscription plan
            const { tenantId, plan } = message.data

            // Define plan limits
            const planLimits = {
              free: { maxProjects: 5, maxTasksPerProject: 20, maxAttachmentSize: 5 },
              pro: { maxProjects: 20, maxTasksPerProject: 100, maxAttachmentSize: 50 },
              enterprise: { maxProjects: -1, maxTasksPerProject: -1, maxAttachmentSize: 500 },
            }

            const limits = planLimits[plan as keyof typeof planLimits] || planLimits.free

            // Store plan limits in database or cache for future reference
            await redisClient.set(
              `tenant:${tenantId}:project_limits`,
              JSON.stringify(limits),
              "EX",
              86400, // Cache for 24 hours
            )

            logger.info(`Updated project limits for tenant ${tenantId} based on ${plan} plan`)
          }

          if (message.type === "SUBSCRIPTION_CANCELED") {
            logger.info(`Received SUBSCRIPTION_CANCELED event for tenant ${message.data.tenantId}`)

            // Downgrade to free plan limits
            const { tenantId } = message.data
            const freePlanLimits = { maxProjects: 5, maxTasksPerProject: 20, maxAttachmentSize: 5 }

            // Store plan limits in database or cache for future reference
            await redisClient.set(
              `tenant:${tenantId}:project_limits`,
              JSON.stringify(freePlanLimits),
              "EX",
              86400, // Cache for 24 hours
            )

            logger.info(`Downgraded project limits for tenant ${tenantId} to free plan`)
          }
        } catch (error) {
          logger.error(`Error processing billing event: ${error instanceof Error ? error.message : String(error)}`)
        }
      },
    )

    logger.info("Kafka consumers initialized for project service")

    // Handle graceful shutdown
    process.on("SIGTERM", async () => {
      try {
        await userEventsConsumer.disconnect()
        await tenantEventsConsumer.disconnect()
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

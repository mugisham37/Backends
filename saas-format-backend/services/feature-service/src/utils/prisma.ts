import { PrismaClient } from "@prisma/client"
import { logger } from "./logger"

// Create Prisma client
export const prisma = new PrismaClient({
  log: [
    {
      emit: "event",
      level: "query",
    },
    {
      emit: "event",
      level: "error",
    },
    {
      emit: "event",
      level: "info",
    },
    {
      emit: "event",
      level: "warn",
    },
  ],
})

// Log Prisma queries in development
if (process.env.NODE_ENV === "development") {
  prisma.$on("query", (e) => {
    logger.debug(`Query: ${e.query}`)
    logger.debug(`Duration: ${e.duration}ms`)
  })
}

// Log Prisma errors
prisma.$on("error", (e) => {
  logger.error(`Prisma error: ${e.message}`)
})

// Handle Prisma connection
prisma
  .$connect()
  .then(() => {
    logger.info("Connected to database")
  })
  .catch((error) => {
    logger.error(`Failed to connect to database: ${error.message}`)
    process.exit(1)
  })

// Handle graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, closing database connection")
  await prisma.$disconnect()
  logger.info("Database connection closed")
})

export default prisma

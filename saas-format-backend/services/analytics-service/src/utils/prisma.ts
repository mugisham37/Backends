import { PrismaClient } from "@prisma/client"

// Create Prisma client instance
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
})

export default prisma

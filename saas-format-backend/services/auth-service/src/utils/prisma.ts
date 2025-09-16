import { PrismaClient } from "@prisma/client"

// Create a singleton Prisma client instance
export const prisma = new PrismaClient()

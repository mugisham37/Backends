import mongoose from "mongoose"
import { MongoMemoryServer } from "mongodb-memory-server"
import { logger } from "../utils/logger"

// Create in-memory MongoDB server
let mongoServer: MongoMemoryServer

// Setup function
export const setupTestDB = async (): Promise<void> => {
  try {
    // Create in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()

    // Set test environment
    process.env.NODE_ENV = "test"

    // Connect to in-memory database
    await mongoose.connect(mongoUri)

    logger.info(`Connected to in-memory MongoDB at ${mongoUri}`)
  } catch (error) {
    logger.error("Error setting up test database:", error)
    throw error
  }
}

// Teardown function
export const teardownTestDB = async (): Promise<void> => {
  try {
    // Disconnect from database
    await mongoose.disconnect()

    // Stop in-memory server
    if (mongoServer) {
      await mongoServer.stop()
    }

    logger.info("Test database teardown complete")
  } catch (error) {
    logger.error("Error tearing down test database:", error)
    throw error
  }
}

// Clear database collections
export const clearDatabase = async (): Promise<void> => {
  try {
    const collections = mongoose.connection.collections

    for (const key in collections) {
      const collection = collections[key]
      await collection.deleteMany({})
    }

    logger.info("Test database cleared")
  } catch (error) {
    logger.error("Error clearing test database:", error)
    throw error
  }
}

// Create test user
export const createTestUser = async (userModel: any, userData: any = {}): Promise<any> => {
  const defaultUser = {
    email: "test@example.com",
    password: "Password123!",
    firstName: "Test",
    lastName: "User",
    role: "admin",
    isActive: true,
  }

  const user = new userModel({
    ...defaultUser,
    ...userData,
  })

  await user.save()
  return user
}

// Create test token
export const createTestToken = async (authService: any, userId: string): Promise<string> => {
  return authService.generateToken(userId)
}

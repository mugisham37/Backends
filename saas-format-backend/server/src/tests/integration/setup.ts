import { execSync } from "child_process"
import { GenericContainer, Network, type StartedNetwork, Wait } from "testcontainers"
import { PostgreSqlContainer } from "testcontainers/modules/postgresql"
import { RedisContainer } from "testcontainers/modules/redis"
import { KafkaContainer } from "testcontainers/modules/kafka"
import { PrismaClient } from "@prisma/client"
import axios from "axios"
import { logger } from "../../utils/logger"

// Global variables for test containers
let network: StartedNetwork
let postgresContainer: PostgreSqlContainer
let redisContainer: RedisContainer
let kafkaContainer: KafkaContainer
let authServiceContainer: GenericContainer
let tenantServiceContainer: GenericContainer
let userServiceContainer: GenericContainer
let projectServiceContainer: GenericContainer
let apiGatewayContainer: GenericContainer

// Global variables for service URLs
export let authServiceUrl: string
export let tenantServiceUrl: string
export let userServiceUrl: string
export let projectServiceUrl: string
export let apiGatewayUrl: string

// Global variables for database clients
export let prisma: PrismaClient

// Setup function to start all containers
export const setupTestEnvironment = async (): Promise<void> => {
  logger.info("Setting up test environment...")

  try {
    // Create a shared network for all containers
    network = await new Network().start()
    const networkName = network.getName()

    logger.info(`Created test network: ${networkName}`)

    // Start PostgreSQL container
    postgresContainer = await new PostgreSqlContainer("postgres:14-alpine")
      .withNetwork(network)
      .withNetworkAliases("postgres")
      .withDatabase("test_db")
      .withUsername("test_user")
      .withPassword("test_password")
      .withExposedPorts(5432)
      .start()

    const postgresPort = postgresContainer.getMappedPort(5432)
    const postgresHost = postgresContainer.getHost()
    const postgresUrl = `postgresql://test_user:test_password@${postgresHost}:${postgresPort}/test_db`

    logger.info(`Started PostgreSQL container: ${postgresUrl}`)

    // Start Redis container
    redisContainer = await new RedisContainer("redis:alpine")
      .withNetwork(network)
      .withNetworkAliases("redis")
      .withExposedPorts(6379)
      .start()

    const redisPort = redisContainer.getMappedPort(6379)
    const redisHost = redisContainer.getHost()
    const redisUrl = `redis://${redisHost}:${redisPort}`

    logger.info(`Started Redis container: ${redisUrl}`)

    // Start Kafka container
    kafkaContainer = await new KafkaContainer("confluentinc/cp-kafka:latest")
      .withNetwork(network)
      .withNetworkAliases("kafka")
      .withExposedPorts(9092)
      .start()

    const kafkaPort = kafkaContainer.getMappedPort(9092)
    const kafkaHost = kafkaContainer.getHost()
    const kafkaBrokers = `${kafkaHost}:${kafkaPort}`

    logger.info(`Started Kafka container: ${kafkaBrokers}`)

    // Run database migrations
    logger.info("Running database migrations...")

    // Set environment variables for Prisma
    process.env.DATABASE_URL = postgresUrl

    // Run Prisma migrations
    execSync("npx prisma migrate deploy", { stdio: "inherit" })

    // Initialize Prisma client
    prisma = new PrismaClient()
    await prisma.$connect()

    logger.info("Database migrations completed")

    // Start Auth Service container
    authServiceContainer = await new GenericContainer("saas-platform/auth-service:test")
      .withNetwork(network)
      .withNetworkAliases("auth-service")
      .withExposedPorts(3001)
      .withEnvironment({
        NODE_ENV: "test",
        PORT: "3001",
        DATABASE_URL: `postgresql://test_user:test_password@postgres:5432/test_db`,
        JWT_SECRET: "test-jwt-secret",
        JWT_EXPIRATION: "1h",
        REDIS_URL: "redis://redis:6379",
        KAFKA_BROKERS: "kafka:9092",
      })
      .withWaitStrategy(Wait.forLogMessage("Auth service started on port 3001"))
      .start()

    authServiceUrl = `http://${authServiceContainer.getHost()}:${authServiceContainer.getMappedPort(3001)}`
    logger.info(`Started Auth Service container: ${authServiceUrl}`)

    // Start Tenant Service container
    tenantServiceContainer = await new GenericContainer("saas-platform/tenant-service:test")
      .withNetwork(network)
      .withNetworkAliases("tenant-service")
      .withExposedPorts(3002)
      .withEnvironment({
        NODE_ENV: "test",
        PORT: "3002",
        DATABASE_URL: `postgresql://test_user:test_password@postgres:5432/test_db`,
        REDIS_URL: "redis://redis:6379",
        KAFKA_BROKERS: "kafka:9092",
      })
      .withWaitStrategy(Wait.forLogMessage("Tenant service started on port 3002"))
      .start()

    tenantServiceUrl = `http://${tenantServiceContainer.getHost()}:${tenantServiceContainer.getMappedPort(3002)}`
    logger.info(`Started Tenant Service container: ${tenantServiceUrl}`)

    // Start User Service container
    userServiceContainer = await new GenericContainer("saas-platform/user-service:test")
      .withNetwork(network)
      .withNetworkAliases("user-service")
      .withExposedPorts(3003)
      .withEnvironment({
        NODE_ENV: "test",
        PORT: "3003",
        DATABASE_URL: `postgresql://test_user:test_password@postgres:5432/test_db`,
        REDIS_URL: "redis://redis:6379",
        KAFKA_BROKERS: "kafka:9092",
      })
      .withWaitStrategy(Wait.forLogMessage("User service started on port 3003"))
      .start()

    userServiceUrl = `http://${userServiceContainer.getHost()}:${userServiceContainer.getMappedPort(3003)}`
    logger.info(`Started User Service container: ${userServiceUrl}`)

    // Start Project Service container
    projectServiceContainer = await new GenericContainer("saas-platform/project-service:test")
      .withNetwork(network)
      .withNetworkAliases("project-service")
      .withExposedPorts(3004)
      .withEnvironment({
        NODE_ENV: "test",
        PORT: "3004",
        DATABASE_URL: `postgresql://test_user:test_password@postgres:5432/test_db`,
        REDIS_URL: "redis://redis:6379",
        KAFKA_BROKERS: "kafka:9092",
      })
      .withWaitStrategy(Wait.forLogMessage("Project service started on port 3004"))
      .start()

    projectServiceUrl = `http://${projectServiceContainer.getHost()}:${projectServiceContainer.getMappedPort(3004)}`
    logger.info(`Started Project Service container: ${projectServiceUrl}`)

    // Start API Gateway container
    apiGatewayContainer = await new GenericContainer("saas-platform/api-gateway:test")
      .withNetwork(network)
      .withNetworkAliases("api-gateway")
      .withExposedPorts(3000)
      .withEnvironment({
        NODE_ENV: "test",
        PORT: "3000",
        AUTH_SERVICE_URL: "http://auth-service:3001",
        TENANT_SERVICE_URL: "http://tenant-service:3002",
        USER_SERVICE_URL: "http://user-service:3003",
        PROJECT_SERVICE_URL: "http://project-service:3004",
        REDIS_URL: "redis://redis:6379",
      })
      .withWaitStrategy(Wait.forLogMessage("API Gateway started on port 3000"))
      .start()

    apiGatewayUrl = `http://${apiGatewayContainer.getHost()}:${apiGatewayContainer.getMappedPort(3000)}`
    logger.info(`Started API Gateway container: ${apiGatewayUrl}`)

    // Wait for all services to be ready
    logger.info("Waiting for all services to be ready...")

    // Check API Gateway health endpoint
    await waitForService(apiGatewayUrl + "/health", 30)

    logger.info("Test environment setup completed successfully")
  } catch (error) {
    logger.error("Failed to set up test environment:", error)
    await teardownTestEnvironment()
    throw error
  }
}

// Teardown function to stop all containers
export const teardownTestEnvironment = async (): Promise<void> => {
  logger.info("Tearing down test environment...")

  try {
    // Disconnect Prisma client
    if (prisma) {
      await prisma.$disconnect()
    }

    // Stop all containers
    const containers = [
      apiGatewayContainer,
      projectServiceContainer,
      userServiceContainer,
      tenantServiceContainer,
      authServiceContainer,
      kafkaContainer,
      redisContainer,
      postgresContainer,
    ]

    for (const container of containers) {
      if (container) {
        await container.stop()
      }
    }

    // Stop network
    if (network) {
      await network.stop()
    }

    logger.info("Test environment teardown completed")
  } catch (error) {
    logger.error("Failed to tear down test environment:", error)
    throw error
  }
}

// Helper function to wait for a service to be ready
const waitForService = async (url: string, timeoutSeconds: number): Promise<void> => {
  const startTime = Date.now()
  const timeoutMs = timeoutSeconds * 1000

  while (Date.now() - startTime < timeoutMs) {
    try {
      await axios.get(url, { timeout: 1000 })
      return
    } catch (error) {
      // Wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  throw new Error(`Service at ${url} did not become ready within ${timeoutSeconds} seconds`)
}

// Helper function to create a test tenant
export const createTestTenant = async (name: string): Promise<any> => {
  const response = await axios.post(`${tenantServiceUrl}/tenants`, {
    name,
    domain: `${name.toLowerCase().replace(/\s+/g, "-")}.example.com`,
    plan: "free",
  })

  return response.data
}

// Helper function to create a test user
export const createTestUser = async (tenantId: string, email: string, password: string): Promise<any> => {
  const response = await axios.post(
    `${authServiceUrl}/auth/register`,
    {
      email,
      password,
      firstName: "Test",
      lastName: "User",
    },
    {
      headers: {
        "X-Tenant-ID": tenantId,
      },
    },
  )

  return response.data
}

// Helper function to authenticate a user
export const authenticateUser = async (tenantId: string, email: string, password: string): Promise<string> => {
  const response = await axios.post(
    `${authServiceUrl}/auth/login`,
    {
      email,
      password,
    },
    {
      headers: {
        "X-Tenant-ID": tenantId,
      },
    },
  )

  return response.data.token
}

// Helper function to create a test project
export const createTestProject = async (
  tenantId: string,
  token: string,
  name: string,
  description: string,
): Promise<any> => {
  const response = await axios.post(
    `${projectServiceUrl}/projects`,
    {
      name,
      description,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Tenant-ID": tenantId,
      },
    },
  )

  return response.data
}

import axios from "axios"
import { setupTestEnvironment, teardownTestEnvironment, createTestTenant, apiGatewayUrl } from "./setup"

describe("Authentication Service Integration Tests", () => {
  // Set timeout for all tests in this suite
  jest.setTimeout(60000)

  // Setup and teardown
  beforeAll(async () => {
    await setupTestEnvironment()
  })

  afterAll(async () => {
    await teardownTestEnvironment()
  })

  // Test variables
  let tenantId: string
  let userEmail: string
  let userPassword: string
  let authToken: string

  // Test registration
  test("should register a new user", async () => {
    // Create a test tenant
    const tenant = await createTestTenant("Test Tenant")
    tenantId = tenant.id

    // Register a new user
    userEmail = `user-${Date.now()}@example.com`
    userPassword = "Password123!"

    const response = await axios.post(
      `${apiGatewayUrl}/api/auth/register`,
      {
        email: userEmail,
        password: userPassword,
        firstName: "Test",
        lastName: "User",
      },
      {
        headers: {
          "X-Tenant-ID": tenantId,
        },
      },
    )

    expect(response.status).toBe(201)
    expect(response.data).toHaveProperty("user")
    expect(response.data).toHaveProperty("token")
    expect(response.data.user.email).toBe(userEmail)
  })

  // Test login
  test("should login with valid credentials", async () => {
    const response = await axios.post(
      `${apiGatewayUrl}/api/auth/login`,
      {
        email: userEmail,
        password: userPassword,
      },
      {
        headers: {
          "X-Tenant-ID": tenantId,
        },
      },
    )

    expect(response.status).toBe(200)
    expect(response.data).toHaveProperty("user")
    expect(response.data).toHaveProperty("token")
    expect(response.data.user.email).toBe(userEmail)

    // Save token for later tests
    authToken = response.data.token
  })

  // Test login with invalid credentials
  test("should fail to login with invalid credentials", async () => {
    try {
      await axios.post(
        `${apiGatewayUrl}/api/auth/login`,
        {
          email: userEmail,
          password: "WrongPassword123!",
        },
        {
          headers: {
            "X-Tenant-ID": tenantId,
          },
        },
      )
      // If we reach here, the test should fail
      expect(true).toBe(false)
    } catch (error) {
      expect(error.response.status).toBe(401)
    }
  })

  // Test get current user
  test("should get current user with valid token", async () => {
    const response = await axios.get(`${apiGatewayUrl}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "X-Tenant-ID": tenantId,
      },
    })

    expect(response.status).toBe(200)
    expect(response.data).toHaveProperty("id")
    expect(response.data).toHaveProperty("email")
    expect(response.data.email).toBe(userEmail)
  })

  // Test get current user with invalid token
  test("should fail to get current user with invalid token", async () => {
    try {
      await axios.get(`${apiGatewayUrl}/api/users/me`, {
        headers: {
          Authorization: "Bearer invalid-token",
          "X-Tenant-ID": tenantId,
        },
      })
      // If we reach here, the test should fail
      expect(true).toBe(false)
    } catch (error) {
      expect(error.response.status).toBe(401)
    }
  })

  // Test password reset request
  test("should request password reset", async () => {
    const response = await axios.post(
      `${apiGatewayUrl}/api/auth/forgot-password`,
      {
        email: userEmail,
      },
      {
        headers: {
          "X-Tenant-ID": tenantId,
        },
      },
    )

    expect(response.status).toBe(200)
    expect(response.data).toHaveProperty("message")
  })

  // Test logout
  test("should logout user", async () => {
    const response = await axios.post(
      `${apiGatewayUrl}/api/auth/logout`,
      {},
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "X-Tenant-ID": tenantId,
        },
      },
    )

    expect(response.status).toBe(200)
    expect(response.data).toHaveProperty("message")
  })
})

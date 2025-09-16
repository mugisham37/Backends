import axios from "axios"
import { setupTestEnvironment, teardownTestEnvironment, apiGatewayUrl, authenticateUser, createTestUser } from "./setup"

describe("Tenant Service Integration Tests", () => {
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
  let adminToken: string
  let tenantId: string
  let tenantName: string
  let tenantDomain: string

  // Test tenant creation
  test("should create a new tenant", async () => {
    // First, authenticate as admin
    adminToken = await authenticateUser("system", "admin@example.com", "admin123")

    // Create a new tenant
    tenantName = `Test Tenant ${Date.now()}`
    tenantDomain = `test-tenant-${Date.now()}.example.com`

    const response = await axios.post(
      `${apiGatewayUrl}/api/tenants`,
      {
        name: tenantName,
        domain: tenantDomain,
        plan: "free",
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      },
    )

    expect(response.status).toBe(201)
    expect(response.data).toHaveProperty("id")
    expect(response.data).toHaveProperty("name")
    expect(response.data).toHaveProperty("domain")
    expect(response.data.name).toBe(tenantName)
    expect(response.data.domain).toBe(tenantDomain)

    tenantId = response.data.id
  })

  // Test get tenant by ID
  test("should get tenant by ID", async () => {
    const response = await axios.get(`${apiGatewayUrl}/api/tenants/${tenantId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    })

    expect(response.status).toBe(200)
    expect(response.data).toHaveProperty("id")
    expect(response.data).toHaveProperty("name")
    expect(response.data).toHaveProperty("domain")
    expect(response.data.id).toBe(tenantId)
    expect(response.data.name).toBe(tenantName)
    expect(response.data.domain).toBe(tenantDomain)
  })

  // Test get all tenants
  test("should get all tenants", async () => {
    const response = await axios.get(`${apiGatewayUrl}/api/tenants`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    })

    expect(response.status).toBe(200)
    expect(Array.isArray(response.data)).toBe(true)
    expect(response.data.length).toBeGreaterThan(0)

    // Check if our created tenant is in the list
    const createdTenant = response.data.find((tenant: any) => tenant.id === tenantId)
    expect(createdTenant).toBeDefined()
    expect(createdTenant.name).toBe(tenantName)
    expect(createdTenant.domain).toBe(tenantDomain)
  })

  // Test update tenant
  test("should update tenant", async () => {
    const updatedName = `${tenantName} Updated`
    const updatedDomain = `updated-${tenantDomain}`

    const response = await axios.put(
      `${apiGatewayUrl}/api/tenants/${tenantId}`,
      {
        name: updatedName,
        domain: updatedDomain,
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      },
    )

    expect(response.status).toBe(200)
    expect(response.data).toHaveProperty("id")
    expect(response.data).toHaveProperty("name")
    expect(response.data).toHaveProperty("domain")
    expect(response.data.id).toBe(tenantId)
    expect(response.data.name).toBe(updatedName)
    expect(response.data.domain).toBe(updatedDomain)

    // Update our variables for later tests
    tenantName = updatedName
    tenantDomain = updatedDomain
  })

  // Test tenant user management
  test("should add user to tenant", async () => {
    // Create a test user
    const userEmail = `user-${Date.now()}@example.com`
    const userPassword = "Password123!"
    const user = await createTestUser(tenantId, userEmail, userPassword)

    // Add user to tenant
    const response = await axios.post(
      `${apiGatewayUrl}/api/tenants/${tenantId}/users`,
      {
        userId: user.id,
        role: "user",
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      },
    )

    expect(response.status).toBe(200)
    expect(response.data).toHaveProperty("userId")
    expect(response.data).toHaveProperty("tenantId")
    expect(response.data).toHaveProperty("role")
    expect(response.data.userId).toBe(user.id)
    expect(response.data.tenantId).toBe(tenantId)
    expect(response.data.role).toBe("user")
  })

  // Test get tenant users
  test("should get tenant users", async () => {
    const response = await axios.get(`${apiGatewayUrl}/api/tenants/${tenantId}/users`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    })

    expect(response.status).toBe(200)
    expect(Array.isArray(response.data)).toBe(true)
    expect(response.data.length).toBeGreaterThan(0)
  })

  // Test tenant deletion
  test("should delete tenant", async () => {
    const response = await axios.delete(`${apiGatewayUrl}/api/tenants/${tenantId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    })

    expect(response.status).toBe(200)
    expect(response.data).toHaveProperty("message")
  })

  // Test tenant not found after deletion
  test("should not find deleted tenant", async () => {
    try {
      await axios.get(`${apiGatewayUrl}/api/tenants/${tenantId}`, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
      // If we reach here, the test should fail
      expect(true).toBe(false)
    } catch (error) {
      expect(error.response.status).toBe(404)
    }
  })
})

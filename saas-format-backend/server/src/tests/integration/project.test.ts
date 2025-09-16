import axios from "axios"
import {
  setupTestEnvironment,
  teardownTestEnvironment,
  apiGatewayUrl,
  createTestTenant,
  createTestUser,
  authenticateUser,
} from "./setup"

describe("Project Service Integration Tests", () => {
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
  let userId: string
  let userToken: string
  let projectId: string
  let projectName: string
  let projectDescription: string
  let taskId: string

  // Test setup
  test("should set up test data", async () => {
    // Create a test tenant
    const tenant = await createTestTenant(`Project Test Tenant ${Date.now()}`)
    tenantId = tenant.id

    // Create a test user
    const userEmail = `project-user-${Date.now()}@example.com`
    const userPassword = "Password123!"
    const user = await createTestUser(tenantId, userEmail, userPassword)
    userId = user.id

    // Authenticate as the test user
    userToken = await authenticateUser(tenantId, userEmail, userPassword)

    expect(tenantId).toBeDefined()
    expect(userId).toBeDefined()
    expect(userToken).toBeDefined()
  })

  // Test project creation
  test("should create a new project", async () => {
    projectName = `Test Project ${Date.now()}`
    projectDescription = "This is a test project for integration testing"

    const response = await axios.post(
      `${apiGatewayUrl}/api/projects`,
      {
        name: projectName,
        description: projectDescription,
      },
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
          "X-Tenant-ID": tenantId,
        },
      },
    )

    expect(response.status).toBe(201)
    expect(response.data).toHaveProperty("id")
    expect(response.data).toHaveProperty("name")
    expect(response.data).toHaveProperty("description")
    expect(response.data.name).toBe(projectName)
    expect(response.data.description).toBe(projectDescription)

    projectId = response.data.id
  })

  // Test get project by ID
  test("should get project by ID", async () => {
    const response = await axios.get(`${apiGatewayUrl}/api/projects/${projectId}`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
        "X-Tenant-ID": tenantId,
      },
    })

    expect(response.status).toBe(200)
    expect(response.data).toHaveProperty("id")
    expect(response.data).toHaveProperty("name")
    expect(response.data).toHaveProperty("description")
    expect(response.data.id).toBe(projectId)
    expect(response.data.name).toBe(projectName)
    expect(response.data.description).toBe(projectDescription)
  })

  // Test get all projects
  test("should get all projects", async () => {
    const response = await axios.get(`${apiGatewayUrl}/api/projects`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
        "X-Tenant-ID": tenantId,
      },
    })

    expect(response.status).toBe(200)
    expect(Array.isArray(response.data)).toBe(true)
    expect(response.data.length).toBeGreaterThan(0)

    // Check if our created project is in the list
    const createdProject = response.data.find((project: any) => project.id === projectId)
    expect(createdProject).toBeDefined()
    expect(createdProject.name).toBe(projectName)
    expect(createdProject.description).toBe(projectDescription)
  })

  // Test update project
  test("should update project", async () => {
    const updatedName = `${projectName} Updated`
    const updatedDescription = `${projectDescription} Updated`

    const response = await axios.put(
      `${apiGatewayUrl}/api/projects/${projectId}`,
      {
        name: updatedName,
        description: updatedDescription,
      },
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
          "X-Tenant-ID": tenantId,
        },
      },
    )

    expect(response.status).toBe(200)
    expect(response.data).toHaveProperty("id")
    expect(response.data).toHaveProperty("name")
    expect(response.data).toHaveProperty("description")
    expect(response.data.id).toBe(projectId)
    expect(response.data.name).toBe(updatedName)
    expect(response.data.description).toBe(updatedDescription)

    // Update our variables for later tests
    projectName = updatedName
    projectDescription = updatedDescription
  })

  // Test create task
  test("should create a task in the project", async () => {
    const taskName = `Test Task ${Date.now()}`
    const taskDescription = "This is a test task for integration testing"

    const response = await axios.post(
      `${apiGatewayUrl}/api/projects/${projectId}/tasks`,
      {
        name: taskName,
        description: taskDescription,
        status: "TODO",
        priority: "MEDIUM",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      },
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
          "X-Tenant-ID": tenantId,
        },
      },
    )

    expect(response.status).toBe(201)
    expect(response.data).toHaveProperty("id")
    expect(response.data).toHaveProperty("name")
    expect(response.data).toHaveProperty("description")
    expect(response.data).toHaveProperty("status")
    expect(response.data).toHaveProperty("priority")
    expect(response.data).toHaveProperty("projectId")
    expect(response.data.name).toBe(taskName)
    expect(response.data.description).toBe(taskDescription)
    expect(response.data.status).toBe("TODO")
    expect(response.data.priority).toBe("MEDIUM")
    expect(response.data.projectId).toBe(projectId)

    taskId = response.data.id
  })

  // Test get tasks for project
  test("should get tasks for project", async () => {
    const response = await axios.get(`${apiGatewayUrl}/api/projects/${projectId}/tasks`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
        "X-Tenant-ID": tenantId,
      },
    })

    expect(response.status).toBe(200)
    expect(Array.isArray(response.data)).toBe(true)
    expect(response.data.length).toBeGreaterThan(0)

    // Check if our created task is in the list
    const createdTask = response.data.find((task: any) => task.id === taskId)
    expect(createdTask).toBeDefined()
    expect(createdTask.projectId).toBe(projectId)
  })

  // Test update task
  test("should update task", async () => {
    const response = await axios.put(
      `${apiGatewayUrl}/api/projects/${projectId}/tasks/${taskId}`,
      {
        status: "IN_PROGRESS",
      },
      {
        headers: {
          Authorization: `Bearer ${userToken}`,
          "X-Tenant-ID": tenantId,
        },
      },
    )

    expect(response.status).toBe(200)
    expect(response.data).toHaveProperty("id")
    expect(response.data).toHaveProperty("status")
    expect(response.data.id).toBe(taskId)
    expect(response.data.status).toBe("IN_PROGRESS")
  })

  // Test delete task
  test("should delete task", async () => {
    const response = await axios.delete(`${apiGatewayUrl}/api/projects/${projectId}/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
        "X-Tenant-ID": tenantId,
      },
    })

    expect(response.status).toBe(200)
    expect(response.data).toHaveProperty("message")
  })

  // Test project deletion
  test("should delete project", async () => {
    const response = await axios.delete(`${apiGatewayUrl}/api/projects/${projectId}`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
        "X-Tenant-ID": tenantId,
      },
    })

    expect(response.status).toBe(200)
    expect(response.data).toHaveProperty("message")
  })

  // Test project not found after deletion
  test("should not find deleted project", async () => {
    try {
      await axios.get(`${apiGatewayUrl}/api/projects/${projectId}`, {
        headers: {
          Authorization: `Bearer ${userToken}`,
          "X-Tenant-ID": tenantId,
        },
      })
      // If we reach here, the test should fail
      expect(true).toBe(false)
    } catch (error) {
      expect(error.response.status).toBe(404)
    }
  })
})

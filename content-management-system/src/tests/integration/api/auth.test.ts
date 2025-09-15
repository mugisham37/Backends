import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals"
import request from "supertest"
import { createApp } from "../../../app"
import { setupTestDB, teardownTestDB, clearDatabase, createTestUser } from "../../setup"
import { UserModel } from "../../../db/models/user.model"
import type { Express } from "express"

describe("Auth API", () => {
  let app: Express

  beforeAll(async () => {
    await setupTestDB()
    app = await createApp()
  })

  afterAll(async () => {
    await teardownTestDB()
  })

  beforeEach(async () => {
    await clearDatabase()
  })

  describe("POST /api/v1/auth/register", () => {
    it("should register a new user", async () => {
      const userData = {
        email: "newuser@example.com",
        password: "Password123!",
        firstName: "New",
        lastName: "User",
      }

      const response = await request(app).post("/api/v1/auth/register").send(userData).expect(201)

      expect(response.body.status).toBe("success")
      expect(response.body.data).toBeDefined()
      expect(response.body.data.user).toBeDefined()
      expect(response.body.data.user.email).toBe(userData.email)
      expect(response.body.data.tokens).toBeDefined()
    })

    it("should return 400 if required fields are missing", async () => {
      const userData = {
        email: "incomplete@example.com",
        // Missing password and other fields
      }

      const response = await request(app).post("/api/v1/auth/register").send(userData).expect(400)

      expect(response.body.status).toBe("error")
    })

    it("should return 409 if email already exists", async () => {
      const userData = {
        email: "existing@example.com",
        password: "Password123!",
        firstName: "Existing",
        lastName: "User",
      }

      // Create user first
      await createTestUser(UserModel, userData)

      // Try to register with same email
      const response = await request(app).post("/api/v1/auth/register").send(userData).expect(409)

      expect(response.body.status).toBe("error")
    })
  })

  describe("POST /api/v1/auth/login", () => {
    it("should login a user with correct credentials", async () => {
      const userData = {
        email: "loginuser@example.com",
        password: "Password123!",
        firstName: "Login",
        lastName: "User",
      }

      // Create user first
      await createTestUser(UserModel, userData)

      // Login
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: userData.email,
          password: userData.password,
        })
        .expect(200)

      expect(response.body.status).toBe("success")
      expect(response.body.data).toBeDefined()
      expect(response.body.data.user).toBeDefined()
      expect(response.body.data.tokens).toBeDefined()
    })

    it("should return 401 if credentials are incorrect", async () => {
      const userData = {
        email: "wrongpass@example.com",
        password: "Password123!",
        firstName: "Wrong",
        lastName: "Pass",
      }

      // Create user first
      await createTestUser(UserModel, userData)

      // Try to login with wrong password
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: userData.email,
          password: "WrongPassword123!",
        })
        .expect(401)

      expect(response.body.status).toBe("error")
    })
  })

  describe("POST /api/v1/auth/refresh-token", () => {
    it("should refresh tokens with valid refresh token", async () => {
      // Create user and get tokens
      const userData = {
        email: "refresh@example.com",
        password: "Password123!",
      }

      // Register to get tokens
      const registerResponse = await request(app)
        .post("/api/v1/auth/register")
        .send({
          ...userData,
          firstName: "Refresh",
          lastName: "User",
        })
        .expect(201)

      const refreshToken = registerResponse.body.data.tokens.refreshToken

      // Refresh token
      const response = await request(app).post("/api/v1/auth/refresh-token").send({ refreshToken }).expect(200)

      expect(response.body.status).toBe("success")
      expect(response.body.data).toBeDefined()
      expect(response.body.data.tokens).toBeDefined()
      expect(response.body.data.tokens.accessToken).toBeDefined()
      expect(response.body.data.tokens.refreshToken).toBeDefined()
    })

    it("should return 401 with invalid refresh token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/refresh-token")
        .send({ refreshToken: "invalid-token" })
        .expect(401)

      expect(response.body.status).toBe("error")
    })
  })
})

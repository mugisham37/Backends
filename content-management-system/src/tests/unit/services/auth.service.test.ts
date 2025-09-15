import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals"
import { setupTestDB, teardownTestDB, clearDatabase, createTestUser } from "../../setup"
import { AuthService } from "../../../services/auth.service"
import { UserModel } from "../../../db/models/user.model"
import { ApiError } from "../../../utils/errors"

describe("AuthService", () => {
  let authService: AuthService

  beforeAll(async () => {
    await setupTestDB()
    authService = new AuthService()
  })

  afterAll(async () => {
    await teardownTestDB()
  })

  beforeEach(async () => {
    await clearDatabase()
  })

  describe("register", () => {
    it("should register a new user", async () => {
      const userData = {
        email: "newuser@example.com",
        password: "Password123!",
        firstName: "New",
        lastName: "User",
      }

      const result = await authService.register(userData)

      expect(result).toBeDefined()
      expect(result.user).toBeDefined()
      expect(result.user.email).toBe(userData.email)
      expect(result.user.firstName).toBe(userData.firstName)
      expect(result.user.lastName).toBe(userData.lastName)
      expect(result.user.password).toBeUndefined() // Password should not be returned
      expect(result.tokens).toBeDefined()
      expect(result.tokens.accessToken).toBeDefined()
      expect(result.tokens.refreshToken).toBeDefined()
    })

    it("should throw an error if email already exists", async () => {
      const userData = {
        email: "existing@example.com",
        password: "Password123!",
        firstName: "Existing",
        lastName: "User",
      }

      // Create user first
      await createTestUser(UserModel, userData)

      // Try to register with same email
      await expect(authService.register(userData)).rejects.toThrow(ApiError)
    })
  })

  describe("login", () => {
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
      const result = await authService.login(userData.email, userData.password)

      expect(result).toBeDefined()
      expect(result.user).toBeDefined()
      expect(result.user.email).toBe(userData.email)
      expect(result.tokens).toBeDefined()
      expect(result.tokens.accessToken).toBeDefined()
      expect(result.tokens.refreshToken).toBeDefined()
    })

    it("should throw an error if email does not exist", async () => {
      await expect(authService.login("nonexistent@example.com", "Password123!")).rejects.toThrow(ApiError)
    })

    it("should throw an error if password is incorrect", async () => {
      const userData = {
        email: "wrongpass@example.com",
        password: "Password123!",
        firstName: "Wrong",
        lastName: "Pass",
      }

      // Create user first
      await createTestUser(UserModel, userData)

      // Try to login with wrong password
      await expect(authService.login(userData.email, "WrongPassword123!")).rejects.toThrow(ApiError)
    })
  })

  describe("refreshToken", () => {
    it("should generate new tokens with valid refresh token", async () => {
      const user = await createTestUser(UserModel)
      const refreshToken = await authService.generateRefreshToken(user._id)

      const result = await authService.refreshToken(refreshToken)

      expect(result).toBeDefined()
      expect(result.accessToken).toBeDefined()
      expect(result.refreshToken).toBeDefined()
    })

    it("should throw an error with invalid refresh token", async () => {
      await expect(authService.refreshToken("invalid-token")).rejects.toThrow(ApiError)
    })
  })
})

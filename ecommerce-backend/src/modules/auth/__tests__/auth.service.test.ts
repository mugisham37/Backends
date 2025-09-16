/**
 * Authentication Service Tests
 * Unit tests for the authentication service
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthService } from "../auth.service.js";
import { JWTService } from "../jwt.service.js";
import { AppError } from "../../../core/errors/app-error.js";

// Mock database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Mock JWT service
const mockJWTService = {
  generateTokens: vi.fn(),
  verifyAccessToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  refreshAccessToken: vi.fn(),
};

describe("AuthService", () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService(mockDb as any, mockJWTService as any);
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      const registerInput = {
        email: "test@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
      };

      const mockUser = {
        id: "user-id",
        email: registerInput.email,
        firstName: registerInput.firstName,
        lastName: registerInput.lastName,
        role: "customer",
        password: "hashed-password",
      };

      const mockTokens = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
      };

      // Mock database calls
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No existing user
          }),
        }),
      });

      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockUser]),
        }),
      });

      mockJWTService.generateTokens.mockReturnValue(mockTokens);

      const result = await authService.register(registerInput);

      expect(result.user.email).toBe(registerInput.email);
      expect(result.tokens).toBe(mockTokens);
      expect(result.user.password).toBeUndefined();
    });

    it("should throw error if user already exists", async () => {
      const registerInput = {
        email: "existing@example.com",
        password: "password123",
        firstName: "John",
        lastName: "Doe",
      };

      // Mock existing user
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "existing-user" }]),
          }),
        }),
      });

      await expect(authService.register(registerInput)).rejects.toThrow(
        AppError
      );
    });
  });

  describe("login", () => {
    it("should login user with valid credentials", async () => {
      const loginInput = {
        email: "test@example.com",
        password: "password123",
      };

      const mockUser = {
        id: "user-id",
        email: loginInput.email,
        password: "hashed-password",
        status: "active",
        role: "customer",
      };

      const mockTokens = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
      };

      // Mock database calls
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue({}),
        }),
      });

      mockJWTService.generateTokens.mockReturnValue(mockTokens);

      // Mock bcrypt compare - need to mock the actual method used in the service
      const bcrypt = await import("bcryptjs");
      vi.spyOn(bcrypt, "compare").mockResolvedValue(true);

      const result = await authService.login(loginInput);

      expect(result.user.email).toBe(loginInput.email);
      expect(result.tokens).toBe(mockTokens);
    });

    it("should throw error for invalid credentials", async () => {
      const loginInput = {
        email: "test@example.com",
        password: "wrong-password",
      };

      // Mock no user found
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(authService.login(loginInput)).rejects.toThrow(AppError);
    });
  });

  describe("refreshToken", () => {
    it("should refresh access token with valid refresh token", async () => {
      const refreshInput = {
        refreshToken: "valid-refresh-token",
      };

      const mockUser = {
        id: "user-id",
        email: "test@example.com",
        status: "active",
        role: "customer",
      };

      const mockRefreshPayload = {
        userId: "user-id",
        tokenVersion: 1,
      };

      // Mock JWT verification
      mockJWTService.verifyRefreshToken.mockReturnValue(mockRefreshPayload);
      mockJWTService.refreshAccessToken.mockReturnValue("new-access-token");

      // Mock database call
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      const result = await authService.refreshToken(refreshInput);

      expect(result.accessToken).toBe("new-access-token");
    });
  });
});

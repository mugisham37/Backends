/**
 * Authentication Integration Tests
 * Simple integration tests to verify the authentication system works
 */

import { describe, it, expect } from "vitest";
import { JWTService } from "../jwt.service.js";
import { AppError } from "../../../core/errors/app-error.js";

describe("Authentication Integration", () => {
  describe("JWT Service Integration", () => {
    it("should generate and verify tokens correctly", () => {
      // Set up environment
      process.env.JWT_ACCESS_SECRET =
        "test-access-secret-key-for-testing-purposes-only";
      process.env.JWT_REFRESH_SECRET =
        "test-refresh-secret-key-for-testing-purposes-only";

      const jwtService = new JWTService();
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        role: "customer",
      };

      // Generate tokens
      const tokens = jwtService.generateTokens(mockUser);
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();

      // Verify access token
      const accessPayload = jwtService.verifyAccessToken(tokens.accessToken);
      expect(accessPayload.userId).toBe(mockUser.id);
      expect(accessPayload.email).toBe(mockUser.email);
      expect(accessPayload.role).toBe(mockUser.role);

      // Verify refresh token
      const refreshPayload = jwtService.verifyRefreshToken(tokens.refreshToken);
      expect(refreshPayload.userId).toBe(mockUser.id);

      // Generate new access token from refresh token
      const newAccessToken = jwtService.refreshAccessToken(
        tokens.refreshToken,
        mockUser
      );
      expect(newAccessToken).toBeDefined();

      // Verify new access token
      const newPayload = jwtService.verifyAccessToken(newAccessToken);
      expect(newPayload.userId).toBe(mockUser.id);
    });

    it("should handle token extraction correctly", () => {
      process.env.JWT_ACCESS_SECRET =
        "test-access-secret-key-for-testing-purposes-only";

      const jwtService = new JWTService();

      // Test valid Bearer token
      const token = jwtService.extractTokenFromHeader("Bearer abc123");
      expect(token).toBe("abc123");

      // Test invalid formats
      expect(jwtService.extractTokenFromHeader("Invalid")).toBeNull();
      expect(jwtService.extractTokenFromHeader("")).toBeNull();
      expect(jwtService.extractTokenFromHeader(undefined)).toBeNull();
    });

    it("should handle invalid tokens correctly", () => {
      process.env.JWT_ACCESS_SECRET =
        "test-access-secret-key-for-testing-purposes-only";

      const jwtService = new JWTService();

      // Test invalid access token
      expect(() => {
        jwtService.verifyAccessToken("invalid-token");
      }).toThrow(AppError);

      // Test invalid refresh token
      expect(() => {
        jwtService.verifyRefreshToken("invalid-refresh-token");
      }).toThrow(AppError);
    });
  });

  describe("Security Configuration", () => {
    it("should validate required environment variables", () => {
      // This test ensures JWT service requires proper configuration
      delete process.env.JWT_ACCESS_SECRET;
      delete process.env.JWT_REFRESH_SECRET;

      expect(() => {
        new JWTService();
      }).toThrow("JWT secrets must be configured");
    });
  });
});

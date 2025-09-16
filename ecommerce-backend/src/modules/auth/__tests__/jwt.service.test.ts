/**
 * JWT Service Tests
 * Unit tests for JWT token generation and validation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import { JWTService } from "../jwt.service.js";
import { AppError } from "../../../core/errors/app-error.js";

// Mock environment variables
vi.mock("../../../shared/config/env.config.js", () => ({
  config: {
    jwt: {
      accessSecret: "test-access-secret-key-for-testing-purposes-only",
      refreshSecret: "test-refresh-secret-key-for-testing-purposes-only",
    },
  },
}));

describe("JWTService", () => {
  let jwtService: JWTService;
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    role: "customer",
  };

  beforeEach(() => {
    // Set environment variables
    process.env.JWT_ACCESS_SECRET =
      "test-access-secret-key-for-testing-purposes-only";
    process.env.JWT_REFRESH_SECRET =
      "test-refresh-secret-key-for-testing-purposes-only";
    process.env.JWT_ACCESS_EXPIRY = "15m";
    process.env.JWT_REFRESH_EXPIRY = "7d";
    process.env.JWT_ISSUER = "test-api";
    process.env.JWT_AUDIENCE = "test-client";

    jwtService = new JWTService();
  });

  describe("generateTokens", () => {
    it("should generate access and refresh tokens", () => {
      const tokens = jwtService.generateTokens(mockUser);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(typeof tokens.accessToken).toBe("string");
      expect(typeof tokens.refreshToken).toBe("string");
    });

    it("should generate tokens with correct payload", () => {
      const tokens = jwtService.generateTokens(mockUser);

      // Decode without verification to check payload
      const accessPayload = jwt.decode(tokens.accessToken) as any;
      const refreshPayload = jwt.decode(tokens.refreshToken) as any;

      expect(accessPayload.userId).toBe(mockUser.id);
      expect(accessPayload.email).toBe(mockUser.email);
      expect(accessPayload.role).toBe(mockUser.role);

      expect(refreshPayload.userId).toBe(mockUser.id);
      expect(refreshPayload.tokenVersion).toBe(1);
    });
  });

  describe("verifyAccessToken", () => {
    it("should verify valid access token", () => {
      const tokens = jwtService.generateTokens(mockUser);
      const payload = jwtService.verifyAccessToken(tokens.accessToken);

      expect(payload.userId).toBe(mockUser.id);
      expect(payload.email).toBe(mockUser.email);
      expect(payload.role).toBe(mockUser.role);
    });

    it("should throw error for invalid token", () => {
      expect(() => {
        jwtService.verifyAccessToken("invalid-token");
      }).toThrow(AppError);
    });

    it("should throw error for expired token", () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: mockUser.id, email: mockUser.email, role: mockUser.role },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "-1s", issuer: "test-api", audience: "test-client" }
      );

      expect(() => {
        jwtService.verifyAccessToken(expiredToken);
      }).toThrow(AppError);
    });
  });

  describe("verifyRefreshToken", () => {
    it("should verify valid refresh token", () => {
      const tokens = jwtService.generateTokens(mockUser);
      const payload = jwtService.verifyRefreshToken(tokens.refreshToken);

      expect(payload.userId).toBe(mockUser.id);
      expect(payload.tokenVersion).toBe(1);
    });

    it("should throw error for invalid refresh token", () => {
      expect(() => {
        jwtService.verifyRefreshToken("invalid-refresh-token");
      }).toThrow(AppError);
    });
  });

  describe("refreshAccessToken", () => {
    it("should generate new access token from valid refresh token", () => {
      const tokens = jwtService.generateTokens(mockUser);
      const newAccessToken = jwtService.refreshAccessToken(
        tokens.refreshToken,
        mockUser
      );

      expect(newAccessToken).toBeDefined();
      expect(typeof newAccessToken).toBe("string");

      // Verify the new token
      const payload = jwtService.verifyAccessToken(newAccessToken);
      expect(payload.userId).toBe(mockUser.id);
    });

    it("should throw error if refresh token belongs to different user", () => {
      const tokens = jwtService.generateTokens(mockUser);
      const differentUser = { ...mockUser, id: "different-user-id" };

      expect(() => {
        jwtService.refreshAccessToken(tokens.refreshToken, differentUser);
      }).toThrow(AppError);
    });
  });

  describe("extractTokenFromHeader", () => {
    it("should extract token from Bearer header", () => {
      const token = "sample-token";
      const authHeader = `Bearer ${token}`;

      const extracted = jwtService.extractTokenFromHeader(authHeader);
      expect(extracted).toBe(token);
    });

    it("should return null for invalid header format", () => {
      expect(jwtService.extractTokenFromHeader("Invalid header")).toBeNull();
      expect(jwtService.extractTokenFromHeader("Bearer")).toBeNull();
      expect(jwtService.extractTokenFromHeader("")).toBeNull();
      expect(jwtService.extractTokenFromHeader(undefined)).toBeNull();
    });
  });

  describe("getTokenExpiration", () => {
    it("should return expiration date for valid token", () => {
      const tokens = jwtService.generateTokens(mockUser);
      const expiration = jwtService.getTokenExpiration(tokens.accessToken);

      expect(expiration).toBeInstanceOf(Date);
      expect(expiration!.getTime()).toBeGreaterThan(Date.now());
    });

    it("should return null for invalid token", () => {
      const expiration = jwtService.getTokenExpiration("invalid-token");
      expect(expiration).toBeNull();
    });
  });

  describe("isTokenExpired", () => {
    it("should return false for valid token", () => {
      const tokens = jwtService.generateTokens(mockUser);
      const isExpired = jwtService.isTokenExpired(tokens.accessToken);

      expect(isExpired).toBe(false);
    });

    it("should return true for expired token", () => {
      const expiredToken = jwt.sign(
        { userId: mockUser.id },
        process.env.JWT_ACCESS_SECRET!,
        { expiresIn: "-1s" }
      );

      const isExpired = jwtService.isTokenExpired(expiredToken);
      expect(isExpired).toBe(true);
    });

    it("should return true for invalid token", () => {
      const isExpired = jwtService.isTokenExpired("invalid-token");
      expect(isExpired).toBe(true);
    });
  });
});

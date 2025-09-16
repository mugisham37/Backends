/**
 * JWT Service
 * Handles JWT token generation, validation, and refresh token mechanism
 */

import jwt, { type SignOptions } from "jsonwebtoken";

import { AppError } from "../../core/errors/app-error.js";
import type { User } from "../../core/database/schema/users.js";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}

export class JWTService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET!;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET!;
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || "15m";
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || "7d";
    this.issuer = process.env.JWT_ISSUER || "ecommerce-api";
    this.audience = process.env.JWT_AUDIENCE || "ecommerce-client";

    if (!this.accessTokenSecret || !this.refreshTokenSecret) {
      throw new Error("JWT secrets must be configured");
    }
  }

  /**
   * Generate access and refresh token pair
   */
  generateTokens(user: Pick<User, "id" | "email" | "role">): TokenPair {
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessTokenOptions: SignOptions = {
      expiresIn: this.accessTokenExpiry as any,
      issuer: this.issuer,
      audience: this.audience,
      subject: user.id,
    };

    const accessToken = jwt.sign(
      payload,
      this.accessTokenSecret,
      accessTokenOptions
    );

    const refreshPayload: RefreshTokenPayload = {
      userId: user.id,
      tokenVersion: 1, // Can be incremented to invalidate all refresh tokens
    };

    const refreshTokenOptions: SignOptions = {
      expiresIn: this.refreshTokenExpiry as any,
      issuer: this.issuer,
      audience: this.audience,
      subject: user.id,
    };

    const refreshToken = jwt.sign(
      refreshPayload,
      this.refreshTokenSecret,
      refreshTokenOptions
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
      }) as TokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError("Access token expired", 401, "TOKEN_EXPIRED");
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError("Invalid access token", 401, "INVALID_TOKEN");
      }
      throw new AppError("Token verification failed", 401, "TOKEN_ERROR");
    }
  }

  /**
   * Verify and decode refresh token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
      }) as RefreshTokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(
          "Refresh token expired",
          401,
          "REFRESH_TOKEN_EXPIRED"
        );
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError(
          "Invalid refresh token",
          401,
          "INVALID_REFRESH_TOKEN"
        );
      }
      throw new AppError(
        "Refresh token verification failed",
        401,
        "REFRESH_TOKEN_ERROR"
      );
    }
  }

  /**
   * Generate new access token from refresh token
   */
  refreshAccessToken(
    refreshToken: string,
    user: Pick<User, "id" | "email" | "role">
  ): string {
    // Verify refresh token first
    const refreshPayload = this.verifyRefreshToken(refreshToken);

    // Ensure the refresh token belongs to the user
    if (refreshPayload.userId !== user.id) {
      throw new AppError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
    }

    // Generate new access token
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const tokenOptions: SignOptions = {
      expiresIn: this.accessTokenExpiry as any,
      issuer: this.issuer,
      audience: this.audience,
      subject: user.id,
    };

    return jwt.sign(payload, this.accessTokenSecret, tokenOptions);
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return null;
    }

    return parts[1];
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      if (!decoded?.exp) return null;
      return new Date(decoded.exp * 1000);
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return true;
    return expiration < new Date();
  }
}

/**
 * JWT Utilities
 * Handles JWT token generation and verification
 */

import jwt from "jsonwebtoken";

export interface JWTPayload {
  userId: string;
  role?: string;
  type?: "access" | "refresh";
  iat?: number;
  exp?: number;
}

// Get JWT secrets from environment
const getAccessSecret = (): string => {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET environment variable is required");
  }
  return secret;
};

const getRefreshSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET environment variable is required");
  }
  return secret;
};

// Generate JWT token
export const generateJWT = async (
  payload: Omit<JWTPayload, "iat" | "exp">,
  expiresIn: string = "15m"
): Promise<string> => {
  const secret =
    payload.type === "refresh" ? getRefreshSecret() : getAccessSecret();

  return jwt.sign(payload, secret, {
    expiresIn,
    issuer: "ecommerce-api",
    audience: "ecommerce-client",
  });
};

// Verify JWT token
export const verifyJWT = async (
  token: string,
  type: "access" | "refresh" = "access"
): Promise<JWTPayload> => {
  const secret = type === "refresh" ? getRefreshSecret() : getAccessSecret();

  try {
    const payload = jwt.verify(token, secret, {
      issuer: "ecommerce-api",
      audience: "ecommerce-client",
    }) as JWTPayload;

    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error("Token expired");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error("Invalid token");
    }
    throw new Error("Token verification failed");
  }
};

// Decode JWT token without verification (for debugging)
export const decodeJWT = (token: string): JWTPayload | null => {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
};

// Generate token pair (access + refresh)
export const generateTokenPair = async (payload: {
  userId: string;
  role: string;
}) => {
  const [accessToken, refreshToken] = await Promise.all([
    generateJWT({ ...payload, type: "access" }, "15m"),
    generateJWT({ ...payload, type: "refresh" }, "7d"),
  ]);

  return {
    accessToken,
    refreshToken,
  };
};

// Extract token from Authorization header
export const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
};

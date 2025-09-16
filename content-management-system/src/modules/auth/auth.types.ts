import type { User } from "../../core/database/schema/auth.schema.js";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResult {
  user: User;
  tokens: TokenPair;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface UserPayload {
  id: string;
  email: string;
  role: string;
  tenantId?: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  role?: string;
  tenantId?: string;
}

export interface UpdateUserData {
  email?: string;
  role?: string;
  tenantId?: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  bcryptRounds: number;
}

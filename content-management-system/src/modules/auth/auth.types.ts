import type { User } from "../../core/database/schema/auth.schema.ts";
import type { Result } from "../../core/types/result.types";

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

export interface IAuthService {
  authenticate(credentials: LoginCredentials): Promise<Result<AuthResult>>;
  refreshToken(refreshToken: string): Promise<Result<TokenPair>>;
  createUser(userData: CreateUserData): Promise<Result<User>>;
  updateUser(id: string, userData: UpdateUserData): Promise<Result<User>>;
  deleteUser(id: string): Promise<Result<void>>;
  getUserById(id: string): Promise<Result<User>>;
  getUserByEmail(email: string): Promise<Result<User>>;
  validateToken(token: string): Promise<Result<UserPayload>>;
  revokeToken(token: string): Promise<Result<void>>;
}

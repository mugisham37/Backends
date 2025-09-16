/**
 * Auth Client
 *
 * Handles authentication-related API requests
 */

import type { AxiosInstance } from "axios"
import type {
  ApiClientConfig,
  BaseClient,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from "./types"

export class AuthClient implements BaseClient {
  private api: AxiosInstance
  private config: ApiClientConfig

  constructor(api: AxiosInstance, config: ApiClientConfig) {
    this.api = api
    this.config = config
  }

  /**
   * Set the authentication token
   * @param token JWT token
   */
  setToken(token: string): void {
    this.config.token = token
  }

  /**
   * Set the tenant ID
   * @param tenantId Tenant ID
   */
  setTenantId(tenantId: string): void {
    this.config.tenantId = tenantId
  }

  /**
   * Set the API key
   * @param apiKey API key
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey
  }

  /**
   * Set the region
   * @param region AWS region
   */
  setRegion(region: string): void {
    this.config.region = region
  }

  /**
   * Log in with email and password
   * @param data Login request data
   * @returns Login response with token and user
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await this.api.post<LoginResponse>("/auth/login", data)
    return response.data
  }

  /**
   * Register a new user
   * @param data Registration request data
   * @returns Registration response with token and user
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await this.api.post<RegisterResponse>("/auth/register", data)
    return response.data
  }

  /**
   * Refresh an authentication token
   * @param data Refresh token request data
   * @returns New tokens
   */
  async refreshToken(data: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    const response = await this.api.post<RefreshTokenResponse>("/auth/refresh-token", data)
    return response.data
  }

  /**
   * Log out the current user
   * @returns Success message
   */
  async logout(): Promise<{ message: string }> {
    const response = await this.api.post<{ message: string }>("/auth/logout")
    return response.data
  }

  /**
   * Request a password reset
   * @param data Forgot password request data
   * @returns Success message
   */
  async forgotPassword(data: ForgotPasswordRequest): Promise<{ message: string }> {
    const response = await this.api.post<{ message: string }>("/auth/forgot-password", data)
    return response.data
  }

  /**
   * Reset a password with a token
   * @param data Reset password request data
   * @returns Success message
   */
  async resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
    const response = await this.api.post<{ message: string }>("/auth/reset-password", data)
    return response.data
  }

  /**
   * Verify an email with a token
   * @param token Verification token
   * @returns Success message
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const response = await this.api.post<{ message: string }>("/auth/verify-email", { token })
    return response.data
  }

  /**
   * Get the current user
   * @returns Current user
   */
  async getCurrentUser(): Promise<{ user: any }> {
    const response = await this.api.get<{ user: any }>("/auth/me")
    return response.data
  }

  /**
   * Change the current user's password
   * @param currentPassword Current password
   * @param newPassword New password
   * @returns Success message
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const response = await this.api.post<{ message: string }>("/auth/change-password", {
      currentPassword,
      newPassword,
    })
    return response.data
  }
}

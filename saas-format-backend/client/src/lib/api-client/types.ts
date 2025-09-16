/**
 * API Client Types
 */

import type { AxiosRequestConfig, AxiosResponse, AxiosError } from "axios"

// API Client Configuration
export interface ApiClientConfig {
  baseUrl: string
  apiKey?: string
  token?: string
  tenantId?: string
  timeout: number
  retries: number
  retryDelay: number
  onError?: (error: AxiosError) => void
  onRequest?: (config: AxiosRequestConfig) => AxiosRequestConfig
  onResponse?: (response: AxiosResponse) => AxiosResponse
  debug: boolean
  region?: string
}

// API Client Options (for constructor)
export interface ApiClientOptions {
  baseUrl?: string
  apiKey?: string
  token?: string
  tenantId?: string
  timeout?: number
  retries?: number
  retryDelay?: number
  onError?: (error: AxiosError) => void
  onRequest?: (config: AxiosRequestConfig) => AxiosRequestConfig
  onResponse?: (response: AxiosResponse) => AxiosResponse
  debug?: boolean
  region?: string
}

// Base Client Interface
export interface BaseClient {
  setToken(token: string): void
  setTenantId(tenantId: string): void
  setApiKey(apiKey: string): void
  setRegion(region: string): void
}

// Pagination Parameters
export interface PaginationParams {
  page?: number
  limit?: number
  sort?: string
  order?: "asc" | "desc"
}

// Pagination Response
export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

// Auth Types
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  refreshToken: string
  user: User
}

export interface RegisterRequest {
  email: string
  password: string
  firstName: string
  lastName: string
}

export interface RegisterResponse {
  token: string
  refreshToken: string
  user: User
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface RefreshTokenResponse {
  token: string
  refreshToken: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  password: string
}

// User Types
export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface UpdateUserRequest {
  firstName?: string
  lastName?: string
  email?: string
  role?: string
  status?: string
}

// Tenant Types
export interface Tenant {
  id: string
  name: string
  domain: string
  plan: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface CreateTenantRequest {
  name: string
  domain: string
  plan: string
}

export interface UpdateTenantRequest {
  name?: string
  domain?: string
  plan?: string
  status?: string
}

// Project Types
export interface Project {
  id: string
  name: string
  description: string
  status: string
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface CreateProjectRequest {
  name: string
  description: string
  status?: string
}

export interface UpdateProjectRequest {
  name?: string
  description?: string
  status?: string
}

// Task Types
export interface Task {
  id: string
  projectId: string
  name: string
  description: string
  status: string
  priority: string
  dueDate?: string
  assignedTo?: string
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface CreateTaskRequest {
  projectId: string
  name: string
  description: string
  status?: string
  priority?: string
  dueDate?: string
  assignedTo?: string
}

export interface UpdateTaskRequest {
  name?: string
  description?: string
  status?: string
  priority?: string
  dueDate?: string
  assignedTo?: string
}

// Billing Types
export interface Subscription {
  id: string
  tenantId: string
  plan: string
  status: string
  startDate: string
  endDate?: string
  trialEndsAt?: string
  canceledAt?: string
  createdAt: string
  updatedAt: string
}

export interface Plan {
  id: string
  name: string
  description: string
  price: number
  currency: string
  interval: string
  features: string[]
  createdAt: string
  updatedAt: string
}

export interface Invoice {
  id: string
  tenantId: string
  subscriptionId: string
  amount: number
  currency: string
  status: string
  dueDate: string
  paidAt?: string
  createdAt: string
  updatedAt: string
}

export interface CreateSubscriptionRequest {
  plan: string
  paymentMethodId?: string
}

export interface UpdateSubscriptionRequest {
  plan?: string
  status?: string
}

// Feature Flag Types
export interface FeatureFlag {
  id: string
  name: string
  description: string
  enabled: boolean
  tenantId?: string
  rules?: FeatureFlagRule[]
  createdAt: string
  updatedAt: string
}

export interface FeatureFlagRule {
  id: string
  featureFlagId: string
  attribute: string
  operator: string
  value: string
  createdAt: string
  updatedAt: string
}

export interface CreateFeatureFlagRequest {
  name: string
  description: string
  enabled: boolean
  tenantId?: string
  rules?: Omit<FeatureFlagRule, "id" | "featureFlagId" | "createdAt" | "updatedAt">[]
}

export interface UpdateFeatureFlagRequest {
  name?: string
  description?: string
  enabled?: boolean
  rules?: Omit<FeatureFlagRule, "id" | "featureFlagId" | "createdAt" | "updatedAt">[]
}

export interface EvaluateFeatureFlagRequest {
  userId: string
  context?: Record<string, any>
}

export interface EvaluateFeatureFlagResponse {
  enabled: boolean
  reason?: string
}

// Analytics Types
export interface AnalyticsEvent {
  id: string
  tenantId: string
  userId?: string
  event: string
  properties: Record<string, any>
  timestamp: string
}

export interface CreateAnalyticsEventRequest {
  event: string
  properties: Record<string, any>
  userId?: string
  timestamp?: string
}

export interface AnalyticsMetric {
  id: string
  tenantId: string
  name: string
  value: number
  dimensions: Record<string, string>
  timestamp: string
}

export interface AnalyticsReport {
  id: string
  tenantId: string
  name: string
  description: string
  query: string
  schedule?: string
  lastRun?: string
  createdAt: string
  updatedAt: string
}

export interface CreateAnalyticsReportRequest {
  name: string
  description: string
  query: string
  schedule?: string
}

export interface UpdateAnalyticsReportRequest {
  name?: string
  description?: string
  query?: string
  schedule?: string
}

export interface RunAnalyticsReportRequest {
  parameters?: Record<string, any>
}

export interface RunAnalyticsReportResponse {
  reportId: string
  results: any[]
  metadata: {
    executionTime: number
    rowCount: number
    timestamp: string
  }
}

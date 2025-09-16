/**
 * SaaS Platform API Client
 *
 * This is the main entry point for the API client library.
 * It provides a convenient way to interact with the SaaS Platform API.
 */

import { AuthClient } from "./auth-client"
import { TenantClient } from "./tenant-client"
import { UserClient } from "./user-client"
import { ProjectClient } from "./project-client"
import { TaskClient } from "./task-client"
import { BillingClient } from "./billing-client"
import { FeatureFlagClient } from "./feature-flag-client"
import { AnalyticsClient } from "./analytics-client"
import type { ApiClientConfig, ApiClientOptions } from "./types"
import { createApiInstance } from "./api-instance"

export class SaaSPlatformClient {
  private config: ApiClientConfig

  // API clients for different services
  public auth: AuthClient
  public tenants: TenantClient
  public users: UserClient
  public projects: ProjectClient
  public tasks: TaskClient
  public billing: BillingClient
  public featureFlags: FeatureFlagClient
  public analytics: AnalyticsClient

  /**
   * Create a new SaaS Platform API client
   * @param options Client configuration options
   */
  constructor(options: ApiClientOptions = {}) {
    // Set up configuration
    this.config = {
      baseUrl: options.baseUrl || "https://api.saas-platform.com",
      apiKey: options.apiKey,
      token: options.token,
      tenantId: options.tenantId,
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
      retryDelay: options.retryDelay || 1000,
      onError: options.onError,
      onRequest: options.onRequest,
      onResponse: options.onResponse,
      debug: options.debug || false,
      region: options.region,
    }

    // Create API instance
    const api = createApiInstance(this.config)

    // Initialize service clients
    this.auth = new AuthClient(api, this.config)
    this.tenants = new TenantClient(api, this.config)
    this.users = new UserClient(api, this.config)
    this.projects = new ProjectClient(api, this.config)
    this.tasks = new TaskClient(api, this.config)
    this.billing = new BillingClient(api, this.config)
    this.featureFlags = new FeatureFlagClient(api, this.config)
    this.analytics = new AnalyticsClient(api, this.config)
  }

  /**
   * Set the authentication token
   * @param token JWT token
   */
  setToken(token: string): void {
    this.config.token = token

    // Update token in all clients
    this.auth.setToken(token)
    this.tenants.setToken(token)
    this.users.setToken(token)
    this.projects.setToken(token)
    this.tasks.setToken(token)
    this.billing.setToken(token)
    this.featureFlags.setToken(token)
    this.analytics.setToken(token)
  }

  /**
   * Set the tenant ID
   * @param tenantId Tenant ID
   */
  setTenantId(tenantId: string): void {
    this.config.tenantId = tenantId

    // Update tenant ID in all clients
    this.auth.setTenantId(tenantId)
    this.tenants.setTenantId(tenantId)
    this.users.setTenantId(tenantId)
    this.projects.setTenantId(tenantId)
    this.tasks.setTenantId(tenantId)
    this.billing.setTenantId(tenantId)
    this.featureFlags.setTenantId(tenantId)
    this.analytics.setTenantId(tenantId)
  }

  /**
   * Set the API key
   * @param apiKey API key
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey

    // Update API key in all clients
    this.auth.setApiKey(apiKey)
    this.tenants.setApiKey(apiKey)
    this.users.setApiKey(apiKey)
    this.projects.setApiKey(apiKey)
    this.tasks.setApiKey(apiKey)
    this.billing.setApiKey(apiKey)
    this.featureFlags.setApiKey(apiKey)
    this.analytics.setApiKey(apiKey)
  }

  /**
   * Set the region
   * @param region AWS region
   */
  setRegion(region: string): void {
    this.config.region = region

    // Update region in all clients
    this.auth.setRegion(region)
    this.tenants.setRegion(region)
    this.users.setRegion(region)
    this.projects.setRegion(region)
    this.tasks.setRegion(region)
    this.billing.setRegion(region)
    this.featureFlags.setRegion(region)
    this.analytics.setRegion(region)
  }
}

// Export types
export * from "./types"

// Export individual clients
export { AuthClient } from "./auth-client"
export { TenantClient } from "./tenant-client"
export { UserClient } from "./user-client"
export { ProjectClient } from "./project-client"
export { TaskClient } from "./task-client"
export { BillingClient } from "./billing-client"
export { FeatureFlagClient } from "./feature-flag-client"
export { AnalyticsClient } from "./analytics-client"

// Default export
export default SaaSPlatformClient

/**
 * API Instance Creator
 *
 * Creates and configures an Axios instance for API requests
 */

import axios, { type AxiosInstance, type AxiosError, type AxiosRequestConfig } from "axios"
import type { ApiClientConfig } from "./types"

/**
 * Create a configured Axios instance for API requests
 * @param config API client configuration
 * @returns Configured Axios instance
 */
export const createApiInstance = (config: ApiClientConfig): AxiosInstance => {
  // Create Axios instance with base configuration
  const instance = axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeout,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  })

  // Request interceptor
  instance.interceptors.request.use((requestConfig) => {
    // Add authentication headers if available
    if (config.token) {
      requestConfig.headers.Authorization = `Bearer ${config.token}`
    } else if (config.apiKey) {
      requestConfig.headers["X-API-Key"] = config.apiKey
    }

    // Add tenant header if available
    if (config.tenantId) {
      requestConfig.headers["X-Tenant-ID"] = config.tenantId
    }

    // Add region header if available
    if (config.region) {
      requestConfig.headers["X-Region"] = config.region
    }

    // Add request timestamp for performance tracking
    requestConfig.headers["X-Request-Time"] = Date.now().toString()

    // Add correlation ID for request tracing
    requestConfig.headers["X-Correlation-ID"] = generateCorrelationId()

    // Debug logging
    if (config.debug) {
      console.log(`API Request: ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`, {
        headers: requestConfig.headers,
        data: requestConfig.data,
      })
    }

    // Apply custom request handler if provided
    if (config.onRequest) {
      return config.onRequest(requestConfig)
    }

    return requestConfig
  })

  // Response interceptor
  instance.interceptors.response.use(
    (response) => {
      // Calculate request duration
      const requestTime = Number.parseInt(response.config.headers["X-Request-Time"] as string)
      const responseTime = Date.now() - requestTime

      // Debug logging
      if (config.debug) {
        console.log(
          `API Response (${responseTime}ms): ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`,
          {
            data: response.data,
          },
        )
      }

      // Apply custom response handler if provided
      if (config.onResponse) {
        return config.onResponse(response)
      }

      return response
    },
    async (error: AxiosError) => {
      // Debug logging
      if (config.debug) {
        console.error("API Error:", error.response?.data || error.message)
      }

      // Apply custom error handler if provided
      if (config.onError) {
        config.onError(error)
      }

      // Retry logic for certain errors
      if (shouldRetry(error) && error.config) {
        const retryConfig = error.config as AxiosRequestConfig & { _retryCount?: number }
        retryConfig._retryCount = retryConfig._retryCount || 0

        if (retryConfig._retryCount < config.retries) {
          retryConfig._retryCount++

          // Wait before retrying (with exponential backoff)
          const delay = config.retryDelay * Math.pow(2, retryConfig._retryCount - 1)
          await new Promise((resolve) => setTimeout(resolve, delay))

          // Retry the request
          return instance(retryConfig)
        }
      }

      return Promise.reject(error)
    },
  )

  return instance
}

/**
 * Determine if a request should be retried based on the error
 * @param error Axios error
 * @returns True if the request should be retried
 */
const shouldRetry = (error: AxiosError): boolean => {
  // Don't retry if there's no response (e.g., network error)
  if (!error.response) {
    return true
  }

  // Don't retry for client errors (except 429 Too Many Requests)
  const status = error.response.status
  if (status >= 400 && status < 500 && status !== 429) {
    return false
  }

  // Retry for server errors and rate limiting
  return true
}

/**
 * Generate a correlation ID for request tracing
 * @returns Correlation ID
 */
const generateCorrelationId = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

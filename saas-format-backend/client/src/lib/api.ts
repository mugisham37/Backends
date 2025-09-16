"use client"

import axios, { type AxiosError } from "axios"
import Cookies from "js-cookie"
import { jwtDecode } from "jwt-decode"
import { toast } from "@/components/ui/use-toast"
import { trackError } from "./analytics"
import { useAppStore } from "@/lib/state/store"
import { queueOfflineAction, OfflineActionType, getCachedData, cacheData } from "@/lib/offline-storage"

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api"

// Default request timeout in milliseconds
const DEFAULT_TIMEOUT = 30000

// Interface for API request options
interface ApiRequestOptions extends RequestInit {
  timeout?: number
  useCache?: boolean
  cacheTTL?: number
  offlineSupport?: boolean
  retries?: number
  retryDelay?: number
}

// Interface for API error
export interface ApiError extends Error {
  status?: number
  data?: any
}

/**
 * Create a fetch request with timeout
 * @param url Request URL
 * @param options Request options
 * @returns Promise that resolves with the fetch response
 */
const fetchWithTimeout = async (url: string, options: ApiRequestOptions = {}): Promise<Response> => {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * Handle API response
 * @param response Fetch response
 * @returns Promise that resolves with the parsed response data
 */ \
const handleResponse = async <T>(response: Response)
: Promise<T> =>
{
  // Check if the response is OK (status in the range 200-299)
  if (!response.ok) {
    const error: ApiError = new Error(`API Error: ${response.status} ${response.statusText}`)
    error.status = response.status

    try {
      error.data = await response.json()
    } catch {
      // If the response is not JSON, use the status text
      error.data = { message: response.statusText }
    }

    throw error
  }

  // Check if the response is empty
  const contentType = response.headers.get("content-type")
  if (contentType && contentType.includes("application/json")) {
    return await response.json()
  }

  return (await response.text()) as unknown as T
}

/**
 * Make an API request with retry logic
 * @param url Request URL
 * @param options Request options
 * @returns Promise that resolves with the parsed response data
 */
const apiRequest = async <T>(url: string, options: ApiRequestOptions = {})
: Promise<T> =>
{
  const {
    retries = 3,
    retryDelay = 1000,
    useCache = false,
    cacheTTL,
    offlineSupport = false,
    ...fetchOptions
  } = options

  // Check if offline and handle accordingly
  if (!navigator.onLine) {
    if (offlineSupport && fetchOptions.method === "GET") {
      // Try to get from cache if offline
      const cachedData = await getCachedData(url)
      if (cachedData) {
        return cachedData
      }
    }

    if (offlineSupport && ["POST", "PUT", "DELETE"].includes(fetchOptions.method || "GET")) {
      // Queue for later if it's a mutation
      const body = fetchOptions.body ? JSON.parse(fetchOptions.body as string) : {}
      const type =
        fetchOptions.method === "POST"
          ? OfflineActionType.CREATE
          : fetchOptions.method === "PUT"
            ? OfflineActionType.UPDATE
            : fetchOptions.method === "DELETE"

      await queueOfflineAction(type, url.replace(API_BASE_URL, ""), body)

      // Return a mock response for offline mutations
      return {
        success: true,
        offline: true,
        message: "Your request has been queued and will be processed when you are back online.",
      } as unknown as T
    }

    // If not cacheable or not a mutation with offline support, throw error
    const error: ApiError = new Error("You are offline")
    error.status = 0
    throw error
  }

  // Check cache first if useCache is true
  if (useCache && fetchOptions.method === "GET") {
    const cachedData = await getCachedData(url)
    if (cachedData) {
      return cachedData
    }
  }

  // Attempt the request with retries
  let lastError: Error | null = null
  let delay = retryDelay

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, fetchOptions)
      const data = await handleResponse<T>(response)

      // Cache the response if useCache is true
      if (useCache && fetchOptions.method === "GET") {
        await cacheData(url, data, cacheTTL)
      }

      return data
    } catch (error) {
      lastError = error

      // Don't retry if it's a client error (4xx)
      if (error.status && error.status >= 400 && error.status < 500) {
        throw error
      }

      // Don't retry if it's an abort error
      if (error.name === "AbortError") {
        throw error
      }

      // If this was the last attempt, throw the error
      if (attempt === retries) {
        throw error
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay *= 2 // Exponential backoff
    }
  }

  // This should never happen, but TypeScript requires it
  throw lastError || new Error("Unknown error")
}

// Create axios instance
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 seconds timeout
})

// Error handler with retry capability
const handleApiError = (error: unknown, retryCallback?: () => Promise<any>) => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message: string; errors?: any }>

    // Handle specific error cases
    if (axiosError.response?.status === 429) {
      toast({
        title: "Rate limit exceeded",
        description: "Please try again later.",
        variant: "destructive",
      })
    } else if (axiosError.response?.status === 403) {
      toast({
        title: "Permission denied",
        description: "You don't have permission to perform this action.",
        variant: "destructive",
      })
    } else if (axiosError.response?.status === 404) {
      toast({
        title: "Not found",
        description: "The requested resource was not found.",
        variant: "destructive",
      })
    } else if (axiosError.response?.status === 500) {
      toast({
        title: "Server error",
        description: "An unexpected server error occurred. Please try again later.",
        variant: "destructive",
      })

      // Offer retry for server errors
      if (retryCallback) {
        toast({
          title: "Retry available",
          description: "Click to retry your request",
          action: (
            <button
              onClick={() => {
                toast({
                  title: "Retrying...",
                  description: "Attempting to retry your request",
                })
                retryCallback().catch(console.error)
              }}
              className="bg-primary text-white px-3 py-2 rounded-md text-xs font-medium"
            >
              Retry
            </button>
          ),
        })
      }
    } else if (axiosError.code === "ECONNABORTED") {
      toast({
        title: "Request timeout",
        description: "Please check your connection and try again.",
        variant: "destructive",
      })
    } else if (!axiosError.response && axiosError.request) {
      toast({
        title: "Network error",
        description: "Please check your connection and try again.",
        variant: "destructive",
      })
    }

    // Log error for debugging and analytics
    console.error(
      "API Error:",
      axiosError.response?.data?.message || axiosError.message,
      axiosError.response?.data?.errors,
    )

    // Track error in analytics
    trackError(
      "api_error",
      axiosError.response?.data?.message || axiosError.message,
      JSON.stringify({
        status: axiosError.response?.status,
        url: axiosError.config?.url,
        method: axiosError.config?.method,
      }),
    )
  } else {
    console.error("Unexpected error:", error)
    toast({
      title: "Unexpected error",
      description: "An unexpected error occurred. Please try again.",
      variant: "destructive",
    })

    // Track unknown error
    trackError("unknown_error", String(error))
  }
}

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get("token")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Add tenant header if available
    const tenantId = Cookies.get("tenantId")
    if (tenantId) {
      config.headers["X-Tenant-ID"] = tenantId
    }

    // Add request timestamp for performance tracking
    config.headers["X-Request-Time"] = Date.now().toString()

    // Add correlation ID for request tracing
    config.headers["X-Correlation-ID"] = crypto.randomUUID()

    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Calculate and log request duration for performance monitoring
    const requestTime = Number.parseInt(response.config.headers["X-Request-Time"] as string)
    const responseTime = Date.now() - requestTime

    // Log slow requests (over 1000ms)
    if (responseTime > 1000) {
      console.warn(`Slow API request: ${response.config.url} took ${responseTime}ms`)
    }

    return response
  },
  async (error) => {
    const originalRequest = error.config

    // If error is 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // Try to refresh token
        const refreshToken = Cookies.get("refreshToken")
        if (!refreshToken) {
          throw new Error("No refresh token available")
        }

        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api"}/auth/refresh-token`,
          { refreshToken },
        )

        const { token } = response.data.data

        // Update token in cookies
        Cookies.set("token", token, { secure: true, sameSite: "strict" })

        // Update authorization header
        originalRequest.headers.Authorization = `Bearer ${token}`

        // Retry original request
        return api(originalRequest)
      } catch (refreshError) {
        // If refresh fails, redirect to login
        Cookies.remove("token")
        Cookies.remove("refreshToken")
        Cookies.remove("tenantId")

        // Only redirect if in browser environment
        if (typeof window !== "undefined") {
          toast({
            title: "Session expired",
            description: "Your session has expired. Please log in again.",
            variant: "destructive",
          })
          window.location.href = "/auth/login"
        }

        return Promise.reject(refreshError)
      }
    }

    // Create retry callback for the error handler
    const retryCallback = originalRequest ? () => api(originalRequest) : undefined

    handleApiError(error, retryCallback)
    return Promise.reject(error)
  },
)

// Check if token is expired
export const isTokenExpired = (): boolean => {
  const token = Cookies.get("token")
  if (!token) return true

  try {
    const decoded: any = jwtDecode(token)
    const currentTime = Date.now() / 1000

    // Consider token expired 5 minutes before actual expiry to avoid edge cases
    return decoded.exp < currentTime + 300
  } catch (error) {
    return true
  }
}

// Cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number }>()

// Cache TTL in milliseconds (default: 5 minutes)
const DEFAULT_CACHE_TTL = 5 * 60 * 1000

/**
 * Make a GET request to the API
 * @param endpoint API endpoint
 * @param options Request options
 * @returns Promise that resolves with the parsed response data
 */
export const apiGet = async <T>(endpoint: string, options: ApiRequestOptions = {})
: Promise<T> =>
{
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`
  const { headers = {}, ...rest } = options

  // Get auth token from store
  const token = useAppStore.getState().user?.token

  return apiRequest<T>(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    useCache: true, // Enable caching for GET requests by default
    offlineSupport: true, // Enable offline support for GET requests by default
    ...rest,
  })
}

/**
 * Make a POST request to the API
 * @param endpoint API endpoint
 * @param data Request body data
 * @param options Request options
 * @returns Promise that resolves with the parsed response data
 */
export const apiPost = async <T>(endpoint: string, data: any, options: ApiRequestOptions = {})
: Promise<T> =>
{
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`
  const { headers = {}, ...rest } = options

  // Get auth token from store
  const token = useAppStore.getState().user?.token

  return apiRequest<T>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: JSON.stringify(data),
    offlineSupport: true, // Enable offline support for POST requests by default
    ...rest,
  })
}

/**
 * Make a PUT request to the API
 * @param endpoint API endpoint
 * @param data Request body data
 * @param options Request options
 * @returns Promise that resolves with the parsed response data
 */
export const apiPut = async <T>(endpoint: string, data: any, options: ApiRequestOptions = {})
: Promise<T> =>
{
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`
  const { headers = {}, ...rest } = options

  // Get auth token from store
  const token = useAppStore.getState().user?.token

  return apiRequest<T>(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: JSON.stringify(data),
    offlineSupport: true, // Enable offline support for PUT requests by default
    ...rest,
  })
}

/**
 * Make a PATCH request to the API
 * @param endpoint API endpoint
 * @param data Request body data
 * @param options Request options
 * @returns Promise that resolves with the parsed response data
 */
export const apiPatch = async <T>(endpoint: string, data: any, options: ApiRequestOptions = {})
: Promise<T> =>
{
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`
  const { headers = {}, ...rest } = options

  // Get auth token from store
  const token = useAppStore.getState().user?.token

  return apiRequest<T>(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: JSON.stringify(data),
    offlineSupport: true, // Enable offline support for PATCH requests by default
    ...rest,
  })
}

/**
 * Make a DELETE request to the API
 * @param endpoint API endpoint
 * @param options Request options
 * @returns Promise that resolves with the parsed response data
 */
export const apiDelete = async <T>(endpoint: string, options: ApiRequestOptions = {})
: Promise<T> =>
{
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`
  const { headers = {}, ...rest } = options

  // Get auth token from store
  const token = useAppStore.getState().user?.token

  return apiRequest<T>(url, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    offlineSupport: true, // Enable offline support for DELETE requests by default
    ...rest,
  })
}

/**
 * Upload a file to the API
 * @param endpoint API endpoint
 * @param file File to upload
 * @param additionalData Additional form data
 * @param options Request options
 * @returns Promise that resolves with the parsed response data
 */
export const apiUploadFile = async <T>(
  endpoint: string,
  file: File,
  additionalData: Record<string, string> = {},
  options: ApiRequestOptions = {},
)
: Promise<T> =>
{
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`
  const { headers = {}, ...rest } = options

  // Get auth token from store
  const token = useAppStore.getState().user?.token

  // Create form data
  const formData = new FormData()
  formData.append("file", file)

  // Add additional data
  Object.entries(additionalData).forEach(([key, value]) => {
    formData.append(key, value)
  })

  return apiRequest<T>(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: formData,
    ...rest,
  })
}

/**
 * Download a file from the API
 * @param endpoint API endpoint
 * @param filename Filename to save as
 * @param options Request options
 * @returns Promise that resolves when the file is downloaded
 */
export const apiDownloadFile = async (
  endpoint: string,
  filename: string,
  options: ApiRequestOptions = {},
): Promise<void> => {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`
  const { headers = {}, ...rest } = options

  // Get auth token from store
  const token = useAppStore.getState().user?.token

  try {
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...rest,
    })

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }

    // Get the blob from the response
    const blob = await response.blob()

    // Create a download link and click it
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  } catch (error) {
    console.error("File download failed:", error)
    trackError("file_download_error", error.message)
    throw error
  }
}

/**
 * React hook to handle API errors
 * @returns Function to handle API errors
 */
export const useApiErrorHandler = () => {
  const handleApiError = (error: any, fallbackMessage = "An error occurred") => {
    if (error.status === 401) {
      // Handle unauthorized error (e.g., redirect to login)
      useAppStore.getState().resetState()
      window.location.href = "/auth/login"
      return
    }

    // Get error message
    const errorMessage = error.data?.message || error.message || fallbackMessage

    // Track error
    trackError("api_error", errorMessage, JSON.stringify(error))

    // Return the error message for display
    return errorMessage
  }

  return handleApiError
}

// Clear cache for specific URL pattern or all cache
export const clearApiCache = (urlPattern?: string): void => {
  if (!urlPattern) {
    apiCache.clear()
    return
  }

  // Clear cache entries that match the URL pattern
  for (const key of apiCache.keys()) {
    if (key.startsWith(urlPattern)) {
      apiCache.delete(key)
    }
  }
}

export default api

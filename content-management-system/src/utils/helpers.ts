import type { Request } from "express"

/**
 * Parse pagination parameters from request query
 */
export const parsePaginationParams = (query: any): { page: number; limit: number } => {
  const page = query.page ? Number.parseInt(query.page as string, 10) : 1
  const limit = query.limit ? Number.parseInt(query.limit as string, 10) : 20

  return {
    page: page > 0 ? page : 1,
    limit: limit > 0 && limit <= 100 ? limit : 20,
  }
}

/**
 * Generate a slug from a string
 */
export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, "") // Trim - from end of text
}

/**
 * Get client IP address from request
 */
export const getClientIp = (req: Request): string => {
  const forwardedFor = req.headers["x-forwarded-for"]
  if (forwardedFor) {
    return (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(",")[0]).trim()
  }
  return req.socket.remoteAddress || ""
}

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

/**
 * Generate a random string
 */
export const generateRandomString = (length = 10): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Deep merge objects
 */
export const deepMerge = (target: any, source: any): any => {
  const output = { ...target }

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] })
        } else {
          output[key] = deepMerge(target[key], source[key])
        }
      } else {
        Object.assign(output, { [key]: source[key] })
      }
    })
  }

  return output
}

/**
 * Check if value is an object
 */
export const isObject = (item: any): boolean => {
  return item && typeof item === "object" && !Array.isArray(item)
}

/**
 * Sanitize object for logging (remove sensitive fields)
 */
export const sanitizeForLogging = (obj: any, sensitiveFields: string[] = ["password", "token", "secret"]): any => {
  if (!obj) return obj
  if (typeof obj !== "object") return obj

  const result: any = Array.isArray(obj) ? [] : {}

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (sensitiveFields.includes(key)) {
        result[key] = "[REDACTED]"
      } else if (typeof obj[key] === "object") {
        result[key] = sanitizeForLogging(obj[key], sensitiveFields)
      } else {
        result[key] = obj[key]
      }
    }
  }

  return result
}

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Truncate string to a maximum length
 */
export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + "..."
}

/**
 * Convert string to title case
 */
export const toTitleCase = (str: string): string => {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase())
}

/**
 * Parse boolean from various input types
 */
export const parseBoolean = (value: any): boolean => {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const lowercased = value.toLowerCase()
    return lowercased === "true" || lowercased === "yes" || lowercased === "1"
  }
  if (typeof value === "number") return value === 1
  return false
}

/**
 * Get date range from period
 */
export const getDateRangeFromPeriod = (
  period: "today" | "yesterday" | "last7days" | "last30days" | "thisMonth" | "lastMonth" | "custom",
  customStart?: Date,
  customEnd?: Date,
): { startDate: Date; endDate: Date } => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  switch (period) {
    case "today":
      return {
        startDate: today,
        endDate: tomorrow,
      }
    case "yesterday":
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return {
        startDate: yesterday,
        endDate: today,
      }
    case "last7days":
      const last7days = new Date(today)
      last7days.setDate(last7days.getDate() - 7)
      return {
        startDate: last7days,
        endDate: tomorrow,
      }
    case "last30days":
      const last30days = new Date(today)
      last30days.setDate(last30days.getDate() - 30)
      return {
        startDate: last30days,
        endDate: tomorrow,
      }
    case "thisMonth":
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return {
        startDate: thisMonthStart,
        endDate: nextMonthStart,
      }
    case "lastMonth":
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const thisMonthStart2 = new Date(now.getFullYear(), now.getMonth(), 1)
      return {
        startDate: lastMonthStart,
        endDate: thisMonthStart2,
      }
    case "custom":
      if (!customStart || !customEnd) {
        throw new Error("Custom date range requires both start and end dates")
      }
      return {
        startDate: customStart,
        endDate: customEnd,
      }
    default:
      return {
        startDate: today,
        endDate: tomorrow,
      }
  }
}

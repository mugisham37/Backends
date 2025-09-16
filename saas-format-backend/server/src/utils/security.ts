import crypto from "crypto"
import type { Request, Response, NextFunction } from "express"
import { logger } from "./logger"
import { ApiError } from "./api-error"
import { config } from "../config"

// Generate a random string
export const generateRandomString = (length: number): string => {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length)
}

// Generate a secure hash
export const generateHash = (data: string, salt: string): string => {
  const hmac = crypto.createHmac("sha256", salt)
  hmac.update(data)
  return hmac.digest("hex")
}

// Generate a secure password hash
export const hashPassword = (password: string): { hash: string; salt: string } => {
  const salt = generateRandomString(16)
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex")
  return { hash, salt }
}

// Verify a password against a hash
export const verifyPassword = (password: string, hash: string, salt: string): boolean => {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex")
  return hash === verifyHash
}

// Generate a secure token
export const generateToken = (length = 32): string => {
  return crypto.randomBytes(length).toString("hex")
}

// Sanitize user input to prevent XSS
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
}

// CSRF protection middleware
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  if (!config.security.csrfProtection) {
    return next()
  }

  // Skip CSRF check for GET, HEAD, OPTIONS requests
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    // Generate and set CSRF token if it doesn't exist
    if (!req.cookies[config.security.csrfCookieName]) {
      const csrfToken = generateToken()
      res.cookie(config.security.csrfCookieName, csrfToken, {
        httpOnly: true,
        secure: config.environment !== "development",
        sameSite: "strict",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      })
    }
    return next()
  }

  // For other methods (POST, PUT, DELETE, PATCH), validate the CSRF token
  const csrfCookie = req.cookies[config.security.csrfCookieName]
  const csrfHeader = req.headers[config.security.csrfHeaderName.toLowerCase()] as string

  if (!csrfCookie || !csrfHeader) {
    logger.warn(`CSRF token missing: cookie=${!!csrfCookie}, header=${!!csrfHeader}`)
    return next(new ApiError("CSRF token missing", 403))
  }

  if (csrfCookie !== csrfHeader) {
    logger.warn("CSRF token mismatch")
    return next(new ApiError("CSRF token invalid", 403))
  }

  next()
}

// Content Security Policy middleware
export const contentSecurityPolicy = (req: Request, res: Response, next: NextFunction): void => {
  // Set Content Security Policy header
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://api.example.com wss://api.example.com; " +
      "frame-ancestors 'none'; " +
      "form-action 'self';",
  )
  next()
}

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Set security headers
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("X-XSS-Protection", "1; mode=block")
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), interest-cohort=()")

  // Set Strict Transport Security header in production
  if (config.environment === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
  }

  next()
}

// Encrypt data
export const encryptData = (data: string, key: string): string => {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv)
  let encrypted = cipher.update(data, "utf8", "hex")
  encrypted += cipher.final("hex")
  return `${iv.toString("hex")}:${encrypted}`
}

// Decrypt data
export const decryptData = (encryptedData: string, key: string): string => {
  const [ivHex, encryptedText] = encryptedData.split(":")
  const iv = Buffer.from(ivHex, "hex")
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key, "hex"), iv)
  let decrypted = decipher.update(encryptedText, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}

// Generate a secure encryption key
export const generateEncryptionKey = (): string => {
  return crypto.randomBytes(32).toString("hex")
}

// Validate email format
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Validate password strength
export const isStrongPassword = (password: string): boolean => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/
  return passwordRegex.test(password)
}

export default {
  generateRandomString,
  generateHash,
  hashPassword,
  verifyPassword,
  generateToken,
  sanitizeInput,
  csrfProtection,
  contentSecurityPolicy,
  securityHeaders,
  encryptData,
  decryptData,
  generateEncryptionKey,
  isValidEmail,
  isStrongPassword,
}

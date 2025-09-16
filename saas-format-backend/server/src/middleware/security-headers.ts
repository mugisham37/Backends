import type { Request, Response, NextFunction } from "express"
import { config } from "../config"

/**
 * Security headers middleware
 *
 * This middleware adds security headers to all responses.
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Content Security Policy
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

  // Strict Transport Security
  if (config.environment === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
  }

  // X-Content-Type-Options
  res.setHeader("X-Content-Type-Options", "nosniff")

  // X-Frame-Options
  res.setHeader("X-Frame-Options", "DENY")

  // X-XSS-Protection
  res.setHeader("X-XSS-Protection", "1; mode=block")

  // Referrer-Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")

  // Permissions-Policy
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), interest-cohort=()")

  next()
}

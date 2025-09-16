import type { Request, Response, NextFunction } from "express"
import { randomBytes } from "crypto"
import { config } from "../config"
import { ApiError } from "../utils/api-error"

/**
 * CSRF protection middleware
 *
 * This middleware implements CSRF protection using the double submit cookie pattern.
 * It sets a CSRF token in a cookie and expects the same token in a header for non-GET requests.
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF protection if disabled in config
  if (!config.security.csrfProtection) {
    return next()
  }

  const { csrfCookieName, csrfHeaderName } = config.security

  // For GET, HEAD, OPTIONS requests, set the CSRF token if it doesn't exist
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    // Check if CSRF cookie exists
    if (!req.cookies[csrfCookieName]) {
      // Generate a new CSRF token
      const csrfToken = randomBytes(32).toString("hex")

      // Set the CSRF token in a cookie
      res.cookie(csrfCookieName, csrfToken, {
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
  const csrfCookie = req.cookies[csrfCookieName]
  const csrfHeader = req.headers[csrfHeaderName.toLowerCase()] as string

  // If either the cookie or header is missing, reject the request
  if (!csrfCookie || !csrfHeader) {
    return next(new ApiError("CSRF token missing", 403))
  }

  // If the tokens don't match, reject the request
  if (csrfCookie !== csrfHeader) {
    return next(new ApiError("CSRF token invalid", 403))
  }

  // CSRF validation passed
  next()
}

import type { Request, Response, NextFunction } from "express"
import { logger } from "../utils/logger"

export class ApiError extends Error {
  statusCode: number
  errors?: any

  constructor(statusCode: number, message: string, errors?: any) {
    super(message)
    this.statusCode = statusCode
    this.errors = errors
    this.name = "ApiError"

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor)
  }
}

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  // Log the error
  logger.error(`${err.name}: ${err.message}`)
  logger.debug(err.stack || "No stack trace available")

  // Handle specific error types
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      status: "error",
      statusCode: err.statusCode,
      message: err.message,
      errors: err.errors,
    })
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({
      status: "error",
      statusCode: 401,
      message: "Unauthorized: Invalid or expired token",
    })
  }

  // Default to 500 server error
  return res.status(500).json({
    status: "error",
    statusCode: 500,
    message: "Internal Server Error",
  })
}

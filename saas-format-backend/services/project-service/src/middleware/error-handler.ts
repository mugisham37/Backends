import type { Request, Response, NextFunction } from "express"
import { logger } from "../utils/logger"
import { ApiError } from "../utils/api-error"

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

  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      status: "error",
      statusCode: 400,
      message: "Validation Error",
      errors: err.message,
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

  // Handle database errors
  if (err.name === "PrismaClientKnownRequestError") {
    return res.status(400).json({
      status: "error",
      statusCode: 400,
      message: "Database Error",
      errors: err.message,
    })
  }

  // Default to 500 server error
  return res.status(500).json({
    status: "error",
    statusCode: 500,
    message: "Internal Server Error",
  })
}

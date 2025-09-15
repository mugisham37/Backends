import type { Request, Response, NextFunction } from "express"
import { ApiError } from "../utils/errors"
import { logger } from "../utils/logger"

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log error
  logger.error(err)

  // Check if error is an ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    })
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      status: "error",
      message: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    })
  }

  // Handle MongoDB duplicate key error
  if (err.name === "MongoError" && (err as any).code === 11000) {
    return res.status(409).json({
      status: "error",
      message: "Duplicate key error",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack, details: err }),
    })
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      status: "error",
      message: "Invalid token",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    })
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      status: "error",
      message: "Token expired",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    })
  }

  // Handle multer errors
  if (err.name === "MulterError") {
    return res.status(400).json({
      status: "error",
      message: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    })
  }

  // Handle other errors
  return res.status(500).json({
    status: "error",
    message: "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  })
}

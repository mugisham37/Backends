import type { NextFunction, Request, Response } from "express";
import { HTTP_STATUS } from "../constants/index.ts";
import { ApiError } from "../utils/errors.ts";
import { logger } from "../utils/logger.ts";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log error
  logger.error("Error occurred in error handler:", err);

  // Check if error is an ApiError
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      status: "error",
      message: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      status: "error",
      message: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // Handle MongoDB duplicate key error
  if (err.name === "MongoError" && (err as any).code === 11000) {
    return res.status(HTTP_STATUS.CONFLICT).json({
      status: "error",
      message: "Duplicate key error",
      ...(process.env.NODE_ENV === "development" && {
        stack: err.stack,
        details: err,
      }),
    });
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      status: "error",
      message: "Invalid token",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      status: "error",
      message: "Token expired",
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // Handle multer errors
  if (err.name === "MulterError") {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      status: "error",
      message: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // Handle other errors
  return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    status: "error",
    message: "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api-error";
import { createRequestLogger } from "../config/logger";
import { translateError } from "../utils/translate";
import mongoose from "mongoose";
import Joi from "joi";

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestLogger = createRequestLogger(req.id);
  const language = req.language || "en";

  // Log error
  requestLogger.error(`Error: ${err.message}`);
  requestLogger.error(err.stack || "No stack trace");

  // Default error status and message
  let statusCode = 500;
  let message = translateError("server", {}, language);
  let errorDetails: any = null;

  // Handle specific error types
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = translateError("validation", {}, language);
    errorDetails = Object.keys(err.errors).reduce((acc: Record<string, string>, key: string) => {
      acc[key] = err.errors[key].message;
      return acc;
    }, {});
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err instanceof Joi.ValidationError) {
    statusCode = 400;
    message = translateError("validation", {}, language);
    errorDetails = err.details.map((detail) => ({
      message: detail.message,
      path: detail.path,
      type: detail.type,
    }));
  } else if (err.name === "MongoServerError" && (err as any).code === 11000) {
    statusCode = 400;
    const keyValue = (err as any).keyValue;
    const duplicateKey = Object.keys(keyValue)[0];
    message = `Duplicate value for ${duplicateKey}: ${keyValue[duplicateKey]}`;
  } else if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = translateError("auth.invalidToken", {}, language);
  } else if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = translateError("auth.tokenExpired", {}, language);
  } else if (err.name === "PayloadTooLargeError") {
    statusCode = 413;
    message = translateError("payloadTooLarge", {}, language);
  } else if (err.name === "SyntaxError" && (err as any).type === "entity.parse.failed") {
    statusCode = 400;
    message = translateError("invalidJson", {}, language);
  }

  // Send error response
  res.status(statusCode).json({
    status: "error",
    message,
    error:
      process.env.NODE_ENV === "development"
        ? {
            name: err.name,
            details: errorDetails,
            stack: err.stack,
          }
        : undefined,
    requestId: req.id,
  });
};

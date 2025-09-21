import { HTTP_STATUS } from "../constants/index.ts";

export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string): ApiError {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message);
  }

  static unauthorized(message: string): ApiError {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message);
  }

  static forbidden(message: string): ApiError {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message);
  }

  static notFound(message: string): ApiError {
    return new ApiError(HTTP_STATUS.NOT_FOUND, message);
  }

  static methodNotAllowed(message: string): ApiError {
    return new ApiError(HTTP_STATUS.METHOD_NOT_ALLOWED, message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(HTTP_STATUS.CONFLICT, message);
  }

  static unprocessableEntity(message: string): ApiError {
    return new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, message);
  }

  static tooManyRequests(message: string): ApiError {
    return new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, message);
  }

  static internalServerError(message: string): ApiError {
    return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message, false);
  }

  static serviceUnavailable(message: string): ApiError {
    return new ApiError(HTTP_STATUS.SERVICE_UNAVAILABLE, message, false);
  }

  static paymentRequired(message: string): ApiError {
    return new ApiError(402, message);
  }

  static validationError(message: string, details?: any): ApiError {
    const error = new ApiError(400, message);
    (error as any).details = details;
    return error;
  }
}

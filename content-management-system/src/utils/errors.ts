export class ApiError extends Error {
  statusCode: number
  isOperational: boolean

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor)
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, message)
  }

  static unauthorized(message: string): ApiError {
    return new ApiError(401, message)
  }

  static forbidden(message: string): ApiError {
    return new ApiError(403, message)
  }

  static notFound(message: string): ApiError {
    return new ApiError(404, message)
  }

  static methodNotAllowed(message: string): ApiError {
    return new ApiError(405, message)
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, message)
  }

  static unprocessableEntity(message: string): ApiError {
    return new ApiError(422, message)
  }

  static tooManyRequests(message: string): ApiError {
    return new ApiError(429, message)
  }

  static internalServerError(message: string): ApiError {
    return new ApiError(500, message, false)
  }

  static serviceUnavailable(message: string): ApiError {
    return new ApiError(503, message, false)
  }

  static paymentRequired(message: string): ApiError {
    return new ApiError(402, message)
  }
}

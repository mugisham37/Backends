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

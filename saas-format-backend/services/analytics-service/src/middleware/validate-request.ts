import type { Request, Response, NextFunction } from "express"
import { validationResult } from "express-validator"
import { ApiError } from "../utils/api-error"

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req)

  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation Error", errors.array())
  }

  next()
}

import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/errors.ts";

// Simple Joi-like interface for backward compatibility
interface ValidationSchema {
  validate(data: any, options?: any): { error?: any; value: any };
}

export const validateRequest = (schema: ValidationSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(
      {
        body: req.body,
        query: req.query,
        params: req.params,
      },
      { abortEarly: false }
    );

    if (error) {
      const errorMessage =
        error.details?.map((detail: any) => detail.message).join(", ") ||
        "Validation error";

      const errorDetails =
        error.details?.reduce((acc: any, detail: any) => {
          const path = detail.path?.join(".") || "unknown";
          acc[path] = detail.message;
          return acc;
        }, {}) || {};

      return next(ApiError.validationError(errorMessage, errorDetails));
    }

    // Replace request properties with validated versions
    req.body = value.body;
    req.query = value.query;
    req.params = value.params;

    next();
  };
};

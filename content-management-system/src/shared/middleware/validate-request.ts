import type { NextFunction, Request, Response } from "express";
import type Joi from "joi";
import { ApiError } from "../utils/errors";

export const validateRequest = (schema: Joi.ObjectSchema) => {
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
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(", ");

      const errorDetails = error.details.reduce((acc: any, detail) => {
        const path = detail.path.join(".");
        acc[path] = detail.message;
        return acc;
      }, {});

      return next(ApiError.validationError(errorMessage, errorDetails));
    }

    // Replace request properties with validated versions
    req.body = value.body;
    req.query = value.query;
    req.params = value.params;

    next();
  };
};

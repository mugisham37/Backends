/**
 * Request ID middleware for correlation tracking
 */

import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  req.id = (req.headers["x-request-id"] as string) || randomUUID();
  res.setHeader("X-Request-ID", req.id);
  next();
};

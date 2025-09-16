import type { Request, Response } from "express"

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({
    status: "error",
    statusCode: 404,
    message: "Resource not found",
  })
}

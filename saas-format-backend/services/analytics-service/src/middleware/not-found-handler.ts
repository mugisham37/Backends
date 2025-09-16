import type { Request, Response } from "express"

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    status: "error",
    statusCode: 404,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  })
}

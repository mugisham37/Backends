import type { Request, Response } from "express"
import swaggerSpec from "../config/swagger"

/**
 * Serve Swagger specification
 * @route GET /api/v1/docs/swagger.json
 * @access Public
 */
export const getSwaggerSpec = (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json")
  res.send(swaggerSpec)
}

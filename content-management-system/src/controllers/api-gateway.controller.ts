import type { Request, Response, NextFunction } from "express"
import { apiGatewayService } from "../services/api-gateway.service"
import type { RouteMethod, RouteStatus } from "../db/models/api-gateway.model"

export class ApiGatewayController {
  /**
   * Create a new route
   */
  public createRoute = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { path, method, target, status, description, isPublic, rateLimit, caching, transformation } = req.body
      const tenantId = (req as any).tenant?._id

      const route = await apiGatewayService.createRoute({
        path,
        method,
        target,
        status,
        description,
        isPublic,
        rateLimit,
        caching,
        transformation,
        tenantId,
      })

      res.status(201).json({
        status: "success",
        data: {
          route,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update a route
   */
  public updateRoute = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const { path, method, target, status, description, isPublic, rateLimit, caching, transformation } = req.body

      const route = await apiGatewayService.updateRoute(id, {
        path,
        method,
        target,
        status,
        description,
        isPublic,
        rateLimit,
        caching,
        transformation,
      })

      res.status(200).json({
        status: "success",
        data: {
          route,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete a route
   */
  public deleteRoute = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      await apiGatewayService.deleteRoute(id)

      res.status(200).json({
        status: "success",
        message: "Route deleted successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get a route by ID
   */
  public getRouteById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      const route = await apiGatewayService.getRouteById(id)

      res.status(200).json({
        status: "success",
        data: {
          route,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * List routes
   */
  public listRoutes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit, status, method, search } = req.query
      const tenantId = (req as any).tenant?._id

      const result = await apiGatewayService.listRoutes({
        page: page ? Number.parseInt(page as string, 10) : undefined,
        limit: limit ? Number.parseInt(limit as string, 10) : undefined,
        status: status as RouteStatus,
        method: method as RouteMethod,
        search: search as string,
        tenantId,
      })

      res.status(200).json({
        status: "success",
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Handle API request
   */
  public handleRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const path = req.path
      const method = req.method
      const headers = req.headers as Record<string, string>
      const query = req.query as Record<string, string>
      const body = req.body
      const tenantId = (req as any).tenant?._id

      const response = await apiGatewayService.handleRequest(path, method, headers, query, body, tenantId)

      // Set response headers
      for (const [key, value] of Object.entries(response.headers)) {
        if (key.toLowerCase() !== "content-length") {
          res.setHeader(key, value)
        }
      }

      res.status(response.status).json(response.data)
    } catch (error) {
      next(error)
    }
  }

  /**
   * Clear cache
   */
  public clearCache = async (req: Request, res: Response, next: NextFunction) => {
    try {
      apiGatewayService.clearCache()

      res.status(200).json({
        status: "success",
        message: "API gateway cache cleared",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Reload routes
   */
  public reloadRoutes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await apiGatewayService.reloadRoutes()

      res.status(200).json({
        status: "success",
        message: "API gateway routes reloaded",
      })
    } catch (error) {
      next(error)
    }
  }
}

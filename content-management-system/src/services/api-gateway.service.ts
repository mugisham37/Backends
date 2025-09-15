import { EventEmitter } from "events"
import { logger } from "../utils/logger"
import { ApiError } from "../utils/errors"
import { withCache } from "../db/redis"
import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios"
import { createHmac } from "crypto"
import { RouteModel, type IRoute, type RouteMethod, RouteStatus } from "../db/models/api-gateway.model"
import { VM } from "vm2"

// Define route types
export enum RouteType {
  PROXY = "proxy",
  REDIRECT = "redirect",
  FUNCTION = "function",
}

// Define route methods
export type ApiGatewayRouteMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD" | "ALL"

// Define route interface
export interface Route {
  id: string
  tenantId?: string
  name: string
  description?: string
  type: RouteType
  methods: ApiGatewayRouteMethod[]
  source: string
  target: string
  isActive: boolean
  config: {
    headers?: Record<string, string>
    queryParams?: Record<string, string>
    timeout?: number
    cacheEnabled?: boolean
    cacheTtl?: number
    rateLimit?: {
      limit: number
      window: number
    }
    authRequired?: boolean
    roles?: string[]
    plugins?: string[]
    transformRequest?: string
    transformResponse?: string
    errorHandler?: string
  }
  createdAt: Date
  updatedAt: Date
}

// Define route cache
interface RouteCache {
  routes: Map<string, Route>
  patterns: Map<string, Route[]>
  lastUpdated: Date
}

// API Gateway service
export class ApiGatewayService extends EventEmitter {
  private routeCache: Map<string, IRoute> = new Map()
  private transformationCache: Map<string, Function> = new Map()

  constructor() {
    super()
    this.setMaxListeners(100) // Allow more listeners
    // Initialize route cache
    this.loadRoutesToCache().catch((error) => {
      logger.error("Error loading routes to cache:", error)
    })
  }

  /**
   * Initialize the API Gateway service
   */
  public async initialize(): Promise<void> {
    try {
      logger.info("Initializing API gateway service...")

      // Load routes from database into cache
      await this.loadRoutesToCache()

      logger.info("API gateway service initialized")
    } catch (error) {
      logger.error("Error initializing API gateway service:", error)
      throw error
    }
  }

  /**
   * Load routes from storage
   */
  private async loadRoutes(): Promise<void> {
    try {
      // In a real implementation, this would load routes from a database
      // For now, we'll use a simple in-memory implementation
      this.routeCache = {
        routes: new Map(),
        patterns: new Map(),
        lastUpdated: new Date(),
      }

      // Add some example routes
      this.addRoute({
        id: "example-route",
        name: "Example Route",
        description: "An example route",
        type: RouteType.PROXY,
        methods: ["GET", "POST"],
        source: "/api/example",
        target: "https://example.com/api",
        isActive: true,
        config: {
          headers: {
            "X-API-Key": "example-key",
          },
          cacheEnabled: true,
          cacheTtl: 300,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      logger.info(`Loaded ${this.routeCache.routes.size} routes`)
    } catch (error) {
      logger.error("Error loading routes:", error)
      throw error
    }
  }

  /**
   * Load routes from database into cache
   */
  private async loadRoutesToCache(): Promise<void> {
    try {
      // Clear cache
      this.routeCache.clear()
      this.transformationCache.clear()

      // Get all active routes
      const routes = await RouteModel.find({ status: RouteStatus.ACTIVE })

      // Add routes to cache
      for (const route of routes) {
        const cacheKey = this.getRouteCacheKey(route.path, route.method, route.tenantId?.toString())
        this.routeCache.set(cacheKey, route)

        // Precompile transformations
        if (route.transformation) {
          if (route.transformation.request) {
            this.compileTransformation(route._id.toString(), "request", route.transformation.request)
          }
          if (route.transformation.response) {
            this.compileTransformation(route._id.toString(), "response", route.transformation.response)
          }
        }
      }

      logger.info(`Loaded ${routes.length} routes into cache`)
    } catch (error) {
      logger.error("Error loading routes to cache:", error)
      throw error
    }
  }

  /**
   * Get route cache key
   */
  private getRouteCacheKey(path: string, method: string, tenantId?: string): string {
    return tenantId ? `${method}:${path}:${tenantId}` : `${method}:${path}`
  }

  /**
   * Compile transformation code
   */
  private compileTransformation(routeId: string, type: "request" | "response", code: string): Function {
    try {
      const cacheKey = `${routeId}:${type}`

      // Check if already compiled
      if (this.transformationCache.has(cacheKey)) {
        return this.transformationCache.get(cacheKey)!
      }

      // Compile code
      const vm = new VM({
        timeout: 1000, // 1 second timeout
        sandbox: {},
      })

      const fn = vm.run(`(function(data) { ${code} })`)

      // Cache compiled function
      this.transformationCache.set(cacheKey, fn)

      return fn
    } catch (error) {
      logger.error(`Error compiling ${type} transformation for route ${routeId}:`, error)
      throw error
    }
  }

  /**
   * Add a route to the cache
   */
  private addRoute(route: Route): void {
    // Add to direct routes
    this.routeCache.routes.set(route.id, route)

    // Add to pattern routes
    const pattern = this.getRoutePattern(route.source)
    if (!this.routeCache.patterns.has(pattern)) {
      this.routeCache.patterns.set(pattern, [])
    }
    this.routeCache.patterns.get(pattern)?.push(route)

    // Sort pattern routes by specificity (most specific first)
    this.routeCache.patterns.get(pattern)?.sort((a, b) => {
      return b.source.length - a.source.length
    })
  }

  /**
   * Get a route pattern (for pattern matching)
   */
  private getRoutePattern(source: string): string {
    // Convert path parameters to a pattern
    // e.g. /api/users/:id -> /api/users/*
    return source.replace(/\/:[^/]+/g, "/*")
  }

  /**
   * Find a route for a request
   */
  public findRoute(path: string, method: string, tenantId?: string): Route | null {
    try {
      // Check if routes need to be reloaded
      const now = new Date()
      if (now.getTime() - this.routeCache.lastUpdated.getTime() > 60000) {
        // Reload routes every minute
        setImmediate(() => this.loadRoutes())
      }

      // Find matching pattern
      const patterns = Array.from(this.routeCache.patterns.keys())
      for (const pattern of patterns) {
        if (this.matchesPattern(path, pattern)) {
          const routes = this.routeCache.patterns.get(pattern) || []
          for (const route of routes) {
            // Check if route is active
            if (!route.isActive) continue

            // Check if method matches
            if (route.methods.includes("ALL") || route.methods.includes(method as ApiGatewayRouteMethod)) {
              // Check if tenant matches
              if (route.tenantId && tenantId && route.tenantId !== tenantId) continue

              // Check if path matches exactly
              if (this.matchesPath(path, route.source)) {
                return route
              }
            }
          }
        }
      }

      return null
    } catch (error) {
      logger.error("Error finding route:", error)
      return null
    }
  }

  /**
   * Check if a path matches a pattern
   */
  private matchesPattern(path: string, pattern: string): boolean {
    const pathParts = path.split("/")
    const patternParts = pattern.split("/")

    if (pathParts.length < patternParts.length) {
      return false
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === "*") {
        continue
      }
      if (pathParts[i] !== patternParts[i]) {
        return false
      }
    }

    return true
  }

  /**
   * Check if a path matches a route source
   */
  private matchesPath(path: string, source: string): boolean {
    const pathParts = path.split("/")
    const sourceParts = source.split("/")

    if (pathParts.length !== sourceParts.length) {
      return false
    }

    for (let i = 0; i < sourceParts.length; i++) {
      if (sourceParts[i].startsWith(":")) {
        continue
      }
      if (pathParts[i] !== sourceParts[i]) {
        return false
      }
    }

    return true
  }

  /**
   * Extract path parameters from a path
   */
  private extractPathParams(path: string, source: string): Record<string, string> {
    const params: Record<string, string> = {}
    const pathParts = path.split("/")
    const sourceParts = source.split("/")

    for (let i = 0; i < sourceParts.length; i++) {
      if (sourceParts[i].startsWith(":")) {
        const paramName = sourceParts[i].substring(1)
        params[paramName] = pathParts[i]
      }
    }

    return params
  }

  /**
   * Create a route
   */
  public async createRoute(params: Omit<Route, "id" | "createdAt" | "updatedAt">): Promise<Route> {
    try {
      // In a real implementation, this would create a route in a database
      // For now, we'll use a simple in-memory implementation
      const route: Route = {
        ...params,
        id: `route-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Add to cache
      this.addRoute(route)

      // Emit event
      this.emit("route:created", route)

      return route
    } catch (error) {
      logger.error("Error creating route:", error)
      throw error
    }
  }

  /**
   * Create a new route
   */
  public async createRoute(data: {
    path: string
    method: RouteMethod
    target: string
    status?: RouteStatus
    description?: string
    isPublic?: boolean
    rateLimit?: {
      limit: number
      window: number
    }
    caching?: {
      enabled: boolean
      ttl: number
    }
    transformation?: {
      request?: string
      response?: string
    }
    tenantId?: string
  }): Promise<IRoute> {
    try {
      const { path, method, target, status, description, isPublic, rateLimit, caching, transformation, tenantId } = data

      // Check if route already exists
      const existingRoute = await RouteModel.findOne({
        path,
        method,
        ...(tenantId ? { tenantId } : { tenantId: { $exists: false } }),
      })

      if (existingRoute) {
        throw ApiError.conflict("Route already exists")
      }

      // Validate transformations
      if (transformation) {
        if (transformation.request) {
          try {
            this.compileTransformation("temp", "request", transformation.request)
          } catch (error) {
            throw ApiError.badRequest(`Invalid request transformation: ${error.message}`)
          }
        }
        if (transformation.response) {
          try {
            this.compileTransformation("temp", "response", transformation.response)
          } catch (error) {
            throw ApiError.badRequest(`Invalid response transformation: ${error.message}`)
          }
        }
      }

      // Create route
      const route = new RouteModel({
        path,
        method,
        target,
        status: status || RouteStatus.ACTIVE,
        description,
        isPublic: isPublic !== undefined ? isPublic : false,
        rateLimit,
        caching,
        transformation,
        ...(tenantId && { tenantId }),
      })

      await route.save()

      // Update cache if route is active
      if (route.status === RouteStatus.ACTIVE) {
        const cacheKey = this.getRouteCacheKey(route.path, route.method, route.tenantId?.toString())
        this.routeCache.set(cacheKey, route)

        // Compile transformations
        if (route.transformation) {
          if (route.transformation.request) {
            this.compileTransformation(route._id.toString(), "request", route.transformation.request)
          }
          if (route.transformation.response) {
            this.compileTransformation(route._id.toString(), "response", route.transformation.response)
          }
        }
      }

      logger.info(`Route created: ${route.method} ${route.path}`)

      return route
    } catch (error) {
      logger.error("Error creating route:", error)
      throw error
    }
  }

  /**
   * Update a route
   */
  public async updateRoute(id: string, params: Partial<Omit<Route, "id" | "createdAt" | "updatedAt">>): Promise<Route> {
    try {
      // Find route
      const route = this.routeCache.routes.get(id)
      if (!route) {
        throw ApiError.notFound("Route not found")
      }

      // Update route
      const updatedRoute: Route = {
        ...route,
        ...params,
        updatedAt: new Date(),
      }

      // Update cache
      this.routeCache.routes.set(id, updatedRoute)

      // Update pattern cache
      const oldPattern = this.getRoutePattern(route.source)
      const newPattern = this.getRoutePattern(updatedRoute.source)

      if (oldPattern !== newPattern) {
        // Remove from old pattern
        const oldPatternRoutes = this.routeCache.patterns.get(oldPattern) || []
        this.routeCache.patterns.set(
          oldPattern,
          oldPatternRoutes.filter((r) => r.id !== id),
        )

        // Add to new pattern
        if (!this.routeCache.patterns.has(newPattern)) {
          this.routeCache.patterns.set(newPattern, [])
        }
        this.routeCache.patterns.get(newPattern)?.push(updatedRoute)

        // Sort pattern routes
        this.routeCache.patterns.get(newPattern)?.sort((a, b) => {
          return b.source.length - a.source.length
        })
      } else {
        // Update in existing pattern
        const patternRoutes = this.routeCache.patterns.get(oldPattern) || []
        const index = patternRoutes.findIndex((r) => r.id === id)
        if (index !== -1) {
          patternRoutes[index] = updatedRoute
          this.routeCache.patterns.set(oldPattern, patternRoutes)
        }
      }

      // Emit event
      this.emit("route:updated", updatedRoute)

      return updatedRoute
    } catch (error) {
      logger.error("Error updating route:", error)
      throw error
    }
  }

  /**
   * Update a route
   */
  public async updateRoute(
    id: string,
    data: Partial<{
      path: string
      method: RouteMethod
      target: string
      status: RouteStatus
      description: string
      isPublic: boolean
      rateLimit: {
        limit: number
        window: number
      }
      caching: {
        enabled: boolean
        ttl: number
      }
      transformation: {
        request?: string
        response?: string
      }
    }>,
  ): Promise<IRoute> {
    try {
      const route = await RouteModel.findById(id)

      if (!route) {
        throw ApiError.notFound("Route not found")
      }

      // Check if path and method are being updated and if they already exist
      if ((data.path && data.path !== route.path) || (data.method && data.method !== route.method)) {
        const existingRoute = await RouteModel.findOne({
          path: data.path || route.path,
          method: data.method || route.method,
          tenantId: route.tenantId,
          _id: { $ne: route._id },
        })

        if (existingRoute) {
          throw ApiError.conflict("Route with this path and method already exists")
        }
      }

      // Validate transformations
      if (data.transformation) {
        if (data.transformation.request) {
          try {
            this.compileTransformation("temp", "request", data.transformation.request)
          } catch (error) {
            throw ApiError.badRequest(`Invalid request transformation: ${error.message}`)
          }
        }
        if (data.transformation.response) {
          try {
            this.compileTransformation("temp", "response", data.transformation.response)
          } catch (error) {
            throw ApiError.badRequest(`Invalid response transformation: ${error.message}`)
          }
        }
      }

      // Update route
      Object.assign(route, data)
      await route.save()

      // Update cache
      const oldCacheKey = this.getRouteCacheKey(route.path, route.method, route.tenantId?.toString())
      this.routeCache.delete(oldCacheKey)

      if (route.status === RouteStatus.ACTIVE) {
        const newCacheKey = this.getRouteCacheKey(route.path, route.method, route.tenantId?.toString())
        this.routeCache.set(newCacheKey, route)

        // Clear and recompile transformations
        const requestCacheKey = `${route._id}:request`
        const responseCacheKey = `${route._id}:response`
        this.transformationCache.delete(requestCacheKey)
        this.transformationCache.delete(responseCacheKey)

        if (route.transformation) {
          if (route.transformation.request) {
            this.compileTransformation(route._id.toString(), "request", route.transformation.request)
          }
          if (route.transformation.response) {
            this.compileTransformation(route._id.toString(), "response", route.transformation.response)
          }
        }
      }

      logger.info(`Route updated: ${route.method} ${route.path}`)

      return route
    } catch (error) {
      logger.error(`Error updating route ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a route
   */
  public async deleteRoute(id: string): Promise<void> {
    try {
      // Find route
      const route = this.routeCache.routes.get(id)
      if (!route) {
        throw ApiError.notFound("Route not found")
      }

      // Remove from cache
      this.routeCache.routes.delete(id)

      // Remove from pattern cache
      const pattern = this.getRoutePattern(route.source)
      const patternRoutes = this.routeCache.patterns.get(pattern) || []
      this.routeCache.patterns.set(
        pattern,
        patternRoutes.filter((r) => r.id !== id),
      )

      // Emit event
      this.emit("route:deleted", route)
    } catch (error) {
      logger.error("Error deleting route:", error)
      throw error
    }
  }

  /**
   * Delete a route
   */
  public async deleteRoute(id: string): Promise<void> {
    try {
      const route = await RouteModel.findById(id)

      if (!route) {
        throw ApiError.notFound("Route not found")
      }

      await RouteModel.findByIdAndDelete(id)

      // Remove from cache
      const cacheKey = this.getRouteCacheKey(route.path, route.method, route.tenantId?.toString())
      this.routeCache.delete(cacheKey)

      // Remove transformations from cache
      const requestCacheKey = `${route._id}:request`
      const responseCacheKey = `${route._id}:response`
      this.transformationCache.delete(requestCacheKey)
      this.transformationCache.delete(responseCacheKey)

      logger.info(`Route deleted: ${route.method} ${route.path}`)
    } catch (error) {
      logger.error(`Error deleting route ${id}:`, error)
      throw error
    }
  }

  /**
   * Get a route by ID
   */
  public async getRoute(id: string): Promise<Route> {
    try {
      // Find route
      const route = this.routeCache.routes.get(id)
      if (!route) {
        throw ApiError.notFound("Route not found")
      }

      return route
    } catch (error) {
      logger.error("Error getting route:", error)
      throw error
    }
  }

  /**
   * Get a route by ID
   */
  public async getRouteById(id: string): Promise<IRoute> {
    try {
      const route = await RouteModel.findById(id)

      if (!route) {
        throw ApiError.notFound("Route not found")
      }

      return route
    } catch (error) {
      logger.error(`Error getting route by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Get a route by path and method
   */
  public async getRouteByPathAndMethod(path: string, method: string, tenantId?: string): Promise<IRoute | null> {
    try {
      // Try to get from cache first
      const cacheKey = this.getRouteCacheKey(path, method, tenantId)
      if (this.routeCache.has(cacheKey)) {
        return this.routeCache.get(cacheKey)!
      }

      // If not in cache, get from database
      const route = await RouteModel.findOne({
        path,
        method,
        status: RouteStatus.ACTIVE,
        ...(tenantId ? { tenantId } : { tenantId: { $exists: false } }),
      })

      return route
    } catch (error) {
      logger.error(`Error getting route by path ${path} and method ${method}:`, error)
      throw error
    }
  }

  /**
   * Get all routes
   */
  public async getRoutes(
    params: {
      tenantId?: string
      type?: RouteType
      isActive?: boolean
      search?: string
    } = {},
  ): Promise<Route[]> {
    try {
      const { tenantId, type, isActive, search } = params

      // Filter routes
      let routes = Array.from(this.routeCache.routes.values())

      if (tenantId) {
        routes = routes.filter((r) => !r.tenantId || r.tenantId === tenantId)
      }

      if (type) {
        routes = routes.filter((r) => r.type === type)
      }

      if (isActive !== undefined) {
        routes = routes.filter((r) => r.isActive === isActive)
      }

      if (search) {
        const searchLower = search.toLowerCase()
        routes = routes.filter(
          (r) =>
            r.name.toLowerCase().includes(searchLower) ||
            r.description?.toLowerCase().includes(searchLower) ||
            r.source.toLowerCase().includes(searchLower) ||
            r.target.toLowerCase().includes(searchLower),
        )
      }

      return routes
    } catch (error) {
      logger.error("Error getting routes:", error)
      throw error
    }
  }

  /**
   * List routes with pagination and filtering
   */
  public async listRoutes(options: {
    page?: number
    limit?: number
    status?: RouteStatus
    method?: RouteMethod
    search?: string
    tenantId?: string
  }): Promise<{
    routes: IRoute[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    try {
      const { page = 1, limit = 10, status, method, search, tenantId } = options

      // Build query
      const query: any = {}

      if (status) {
        query.status = status
      }

      if (method) {
        query.method = method
      }

      if (search) {
        query.$or = [
          { path: { $regex: search, $options: "i" } },
          { target: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ]
      }

      if (tenantId) {
        query.tenantId = tenantId
      } else {
        query.tenantId = { $exists: false }
      }

      // Count total
      const total = await RouteModel.countDocuments(query)

      // Get routes
      const routes = await RouteModel.find(query)
        .sort({ path: 1, method: 1 })
        .skip((page - 1) * limit)
        .limit(limit)

      return {
        routes,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    } catch (error) {
      logger.error("Error listing routes:", error)
      throw error
    }
  }

  /**
   * Handle a request
   */
  public async handleRequest(req: any, res: any): Promise<void> {
    try {
      const path = req.path
      const method = req.method
      const tenantId = req.tenantId

      // Find route
      const route = this.findRoute(path, method, tenantId)
      if (!route) {
        throw ApiError.notFound("Route not found")
      }

      // Check authentication
      if (route.config.authRequired && !req.user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check roles
      if (route.config.roles && route.config.roles.length > 0 && req.user) {
        const userRole = req.user.role
        if (!route.config.roles.includes(userRole)) {
          throw ApiError.forbidden("Insufficient permissions")
        }
      }

      // Check rate limit
      if (route.config.rateLimit) {
        // In a real implementation, this would check a rate limiter
        // For now, we'll skip this
      }

      // Extract path parameters
      const pathParams = this.extractPathParams(path, route.source)

      // Handle route based on type
      switch (route.type) {
        case RouteType.PROXY:
          await this.handleProxyRoute(route, req, res, pathParams)
          break
        case RouteType.REDIRECT:
          this.handleRedirectRoute(route, req, res, pathParams)
          break
        case RouteType.FUNCTION:
          await this.handleFunctionRoute(route, req, res, pathParams)
          break
        default:
          throw ApiError.badRequest("Invalid route type")
      }
    } catch (error) {
      // Handle error
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          status: "error",
          message: error.message,
        })
      } else {
        logger.error("Error handling request:", error)
        res.status(500).json({
          status: "error",
          message: "Internal server error",
        })
      }
    }
  }

  /**
   * Handle API request
   */
  public async handleRequest(
    path: string,
    method: string,
    headers: Record<string, string>,
    query: Record<string, string>,
    body: any,
    tenantId?: string,
  ): Promise<{
    status: number
    headers: Record<string, string>
    data: any
  }> {
    try {
      // Find route
      const route = await this.getRouteByPathAndMethod(path, method, tenantId)

      if (!route) {
        throw ApiError.notFound("Route not found")
      }

      // Check if route is public or user is authenticated
      if (!route.isPublic && !headers.authorization) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check rate limit
      if (route.rateLimit) {
        // TODO: Implement rate limiting
      }

      // Check if response is cached
      if (route.caching?.enabled) {
        const cacheKey = `gateway:${method}:${path}:${JSON.stringify(query)}:${JSON.stringify(body)}`
        const cachedResponse = await withCache(
          cacheKey,
          async () => {
            return this.proxyRequest(route, headers, query, body)
          },
          { ttl: route.caching.ttl },
        )
        return cachedResponse
      }

      // Proxy request
      return this.proxyRequest(route, headers, query, body)
    } catch (error) {
      logger.error(`Error handling request ${method} ${path}:`, error)
      throw error
    }
  }

  /**
   * Handle a proxy route
   */
  private async handleProxyRoute(route: Route, req: any, res: any, pathParams: Record<string, string>): Promise<void> {
    try {
      // Build target URL
      let targetUrl = route.target
      for (const [key, value] of Object.entries(pathParams)) {
        targetUrl = targetUrl.replace(`:${key}`, value)
      }

      // Add query parameters
      const queryParams = new URLSearchParams(req.query)
      if (route.config.queryParams) {
        for (const [key, value] of Object.entries(route.config.queryParams)) {
          queryParams.set(key, value)
        }
      }
      if (queryParams.toString()) {
        targetUrl += `?${queryParams.toString()}`
      }

      // Check cache
      if (route.config.cacheEnabled) {
        const cacheKey = `api-gateway:${route.id}:${targetUrl}:${req.method}`
        const cachedResponse = await withCache(
          cacheKey,
          async () => {
            return await this.makeProxyRequest(route, req, targetUrl)
          },
          { ttl: route.config.cacheTtl || 300 },
        )

        // Send response
        res.status(cachedResponse.status)
        res.set(cachedResponse.headers)
        res.send(cachedResponse.data)
        return
      }

      // Make request
      const response = await this.makeProxyRequest(route, req, targetUrl)

      // Send response
      res.status(response.status)
      res.set(response.headers)
      res.send(response.data)
    } catch (error) {
      logger.error("Error handling proxy route:", error)
      throw error
    }
  }

  /**
   * Proxy request to target
   */
  private async proxyRequest(
    route: IRoute,
    headers: Record<string, string>,
    query: Record<string, string>,
    body: any,
  ): Promise<{
    status: number
    headers: Record<string, string>
    data: any
  }> {
    try {
      // Apply request transformation if configured
      let transformedBody = body
      if (route.transformation?.request) {
        const transformFn = this.compileTransformation(route._id.toString(), "request", route.transformation.request)
        transformedBody = transformFn(body)
      }

      // Prepare request config
      const config: AxiosRequestConfig = {
        method: route.method as any,
        url: route.target,
        headers: {
          ...headers,
          "x-forwarded-by": "cms-api-gateway",
        },
        params: query,
        data: transformedBody,
        validateStatus: () => true, // Don't throw on any status code
      }

      // Send request
      const response: AxiosResponse = await axios(config)

      // Apply response transformation if configured
      let transformedData = response.data
      if (route.transformation?.response) {
        const transformFn = this.compileTransformation(route._id.toString(), "response", route.transformation.response)
        transformedData = transformFn(response.data)
      }

      return {
        status: response.status,
        headers: response.headers as any,
        data: transformedData,
      }
    } catch (error) {
      logger.error(`Error proxying request to ${route.target}:`, error)
      throw ApiError.internalServerError("Error proxying request")
    }
  }

  /**
   * Make a proxy request
   */
  private async makeProxyRequest(route: Route, req: any, targetUrl: string): Promise<AxiosResponse> {
    try {
      // Build request config
      const config: AxiosRequestConfig = {
        method: req.method,
        url: targetUrl,
        headers: {
          ...req.headers,
          host: new URL(targetUrl).host,
        },
        data: req.body,
        timeout: route.config.timeout || 30000,
        validateStatus: () => true, // Don't throw on error status codes
      }

      // Add custom headers
      if (route.config.headers) {
        config.headers = {
          ...config.headers,
          ...route.config.headers,
        }
      }

      // Transform request
      if (route.config.transformRequest) {
        // In a real implementation, this would execute a function
        // For now, we'll skip this
      }

      // Make request
      const response = await axios(config)

      // Transform response
      if (route.config.transformResponse) {
        // In a real implementation, this would execute a function
        // For now, we'll skip this
      }

      return response
    } catch (error) {
      logger.error("Error making proxy request:", error)
      throw error
    }
  }

  /**
   * Handle a redirect route
   */
  private handleRedirectRoute(route: Route, req: any, res: any, pathParams: Record<string, string>): void {
    try {
      // Build target URL
      let targetUrl = route.target
      for (const [key, value] of Object.entries(pathParams)) {
        targetUrl = targetUrl.replace(`:${key}`, value)
      }

      // Add query parameters
      const queryParams = new URLSearchParams(req.query)
      if (route.config.queryParams) {
        for (const [key, value] of Object.entries(route.config.queryParams)) {
          queryParams.set(key, value)
        }
      }
      if (queryParams.toString()) {
        targetUrl += `?${queryParams.toString()}`
      }

      // Redirect
      res.redirect(targetUrl)
    } catch (error) {
      logger.error("Error handling redirect route:", error)
      throw error
    }
  }

  /**
   * Handle a function route
   */
  private async handleFunctionRoute(
    route: Route,
    req: any,
    res: any,
    pathParams: Record<string, string>,
  ): Promise<void> {
    try {
      // In a real implementation, this would execute a function
      // For now, we'll return a simple response
      res.status(200).json({
        status: "success",
        message: "Function route executed successfully",
        route: route.id,
        pathParams,
      })
    } catch (error) {
      logger.error("Error handling function route:", error)
      throw error
    }
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.routeCache.clear()
    this.transformationCache.clear()
    logger.info("API gateway cache cleared")
  }

  /**
   * Reload routes
   */
  public async reloadRoutes(): Promise<void> {
    await this.loadRoutesToCache()
    logger.info("API gateway routes reloaded")
  }

  /**
   * Generate an API key
   */
  public generateApiKey(name: string, tenantId?: string): { key: string; secret: string } {
    const key = `key_${this.generateRandomString(24)}`
    const secret = `secret_${this.generateRandomString(32)}`

    // In a real implementation, this would store the key in a database
    // For now, we'll just return the key and secret

    return { key, secret }
  }

  /**
   * Generate a random string
   */
  private generateRandomString(length: number): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = ""
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  /**
   * Verify an API key
   */
  public verifyApiKey(key: string, signature: string, timestamp: string, payload: string): boolean {
    // In a real implementation, this would look up the key in a database
    // For now, we'll use a hardcoded secret
    const secret = "example_secret"

    // Verify signature
    const expectedSignature = this.generateSignature(secret, timestamp, payload)
    return signature === expectedSignature
  }

  /**
   * Generate a signature
   */
  private generateSignature(secret: string, timestamp: string, payload: string): string {
    const hmac = createHmac("sha256", secret)
    hmac.update(`${timestamp}.${payload}`)
    return hmac.digest("hex")
  }
}

// Export singleton instance
export const apiGatewayService = new ApiGatewayService()

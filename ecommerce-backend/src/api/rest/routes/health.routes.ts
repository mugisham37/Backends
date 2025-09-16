/**
 * Health check REST API routes
 * System monitoring and status endpoints
 */

import { Router, Request, Response } from "express";
import {
  ResponseBuilder,
  HTTP_STATUS,
} from "../../../shared/utils/response.utils";

export class HealthController {
  private router = Router();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get("/", this.getHealth.bind(this));
    this.router.get("/detailed", this.getDetailedHealth.bind(this));
    this.router.get("/ready", this.getReadiness.bind(this));
    this.router.get("/live", this.getLiveness.bind(this));
  }

  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || "1.0.0",
        environment: process.env.NODE_ENV || "development",
      };

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(health, { requestId: req.id }));
    } catch (error) {
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error("Health check failed", "HEALTH_CHECK_FAILED")
        );
    }
  }

  async getDetailedHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || "1.0.0",
        environment: process.env.NODE_ENV || "development",
        system: {
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            external: Math.round(process.memoryUsage().external / 1024 / 1024),
          },
          cpu: process.cpuUsage(),
        },
        services: {
          database: await this.checkDatabaseHealth(),
          redis: await this.checkRedisHealth(),
          storage: await this.checkStorageHealth(),
        },
      };

      const allServicesHealthy = Object.values(health.services).every(
        (service) => service.status === "healthy"
      );

      const statusCode = allServicesHealthy
        ? HTTP_STATUS.OK
        : HTTP_STATUS.SERVICE_UNAVAILABLE;

      res
        .status(statusCode)
        .json(ResponseBuilder.success(health, { requestId: req.id }));
    } catch (error) {
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(
            "Detailed health check failed",
            "DETAILED_HEALTH_CHECK_FAILED"
          )
        );
    }
  }

  async getReadiness(req: Request, res: Response): Promise<void> {
    try {
      // Check if all critical services are ready
      const services = {
        database: await this.checkDatabaseHealth(),
        redis: await this.checkRedisHealth(),
      };

      const allReady = Object.values(services).every(
        (service) => service.status === "healthy"
      );

      const readiness = {
        ready: allReady,
        timestamp: new Date().toISOString(),
        services,
      };

      const statusCode = allReady
        ? HTTP_STATUS.OK
        : HTTP_STATUS.SERVICE_UNAVAILABLE;

      res
        .status(statusCode)
        .json(ResponseBuilder.success(readiness, { requestId: req.id }));
    } catch (error) {
      res
        .status(HTTP_STATUS.SERVICE_UNAVAILABLE)
        .json(
          ResponseBuilder.error(
            "Readiness check failed",
            "READINESS_CHECK_FAILED"
          )
        );
    }
  }

  async getLiveness(req: Request, res: Response): Promise<void> {
    try {
      // Simple liveness check - just verify the process is running
      const liveness = {
        alive: true,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(liveness, { requestId: req.id }));
    } catch (error) {
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(
            "Liveness check failed",
            "LIVENESS_CHECK_FAILED"
          )
        );
    }
  }

  private async checkDatabaseHealth(): Promise<{
    status: string;
    responseTime?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();

      // TODO: Implement actual database health check
      // await this.databaseService.ping();

      const responseTime = Date.now() - startTime;

      return {
        status: "healthy",
        responseTime,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error:
          error instanceof Error ? error.message : "Database connection failed",
      };
    }
  }

  private async checkRedisHealth(): Promise<{
    status: string;
    responseTime?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();

      // TODO: Implement actual Redis health check
      // await this.redisService.ping();

      const responseTime = Date.now() - startTime;

      return {
        status: "healthy",
        responseTime,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error:
          error instanceof Error ? error.message : "Redis connection failed",
      };
    }
  }

  private async checkStorageHealth(): Promise<{
    status: string;
    responseTime?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();

      // TODO: Implement actual storage health check
      // await this.storageService.ping();

      const responseTime = Date.now() - startTime;

      return {
        status: "healthy",
        responseTime,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error:
          error instanceof Error ? error.message : "Storage service failed",
      };
    }
  }

  getRouter(): Router {
    return this.router;
  }
}

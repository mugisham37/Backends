/**
 * REST API main router
 * Combines all route controllers with versioning
 */

import { Router } from "express";
import { AuthController } from "./routes/auth.routes";
import { UserController } from "./routes/user.routes";
import { VendorController } from "./routes/vendor.routes";
import { ProductController } from "./routes/product.routes";
import { OrderController } from "./routes/order.routes";
import { HealthController } from "./routes/health.routes";
import { requestIdMiddleware } from "../../shared/middleware/request-id.middleware";
import { apiVersionMiddleware } from "../../shared/middleware/api-version.middleware";
import {
  requestLoggingMiddleware,
  performanceMiddleware,
} from "../../shared/middleware/request-logging.middleware";
import {
  ResponseBuilder,
  HTTP_STATUS,
} from "../../shared/utils/response.utils";

export class RestApiRouter {
  private router = Router();

  constructor() { // private orderService: OrderService // private productService: ProductService, // private vendorService: VendorService, // private userService: UserService, // private authService: AuthService, // TODO: Inject services when available
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    // Add request ID middleware for correlation tracking
    this.router.use(requestIdMiddleware);

    // Add performance monitoring (disabled in test environment)
    if (process.env.NODE_ENV !== "test") {
      this.router.use(performanceMiddleware);
    }

    // Add request/response logging (disabled in test environment)
    if (process.env.NODE_ENV !== "test") {
      this.router.use(
        requestLoggingMiddleware({
          logRequests: true,
          logResponses: true,
          logHeaders: process.env.NODE_ENV === "development",
          logBody: process.env.NODE_ENV === "development",
          excludePaths: ["/health", "/favicon.ico"],
        })
      );
    }

    // Add API versioning
    this.router.use(
      apiVersionMiddleware({
        defaultVersion: "v1",
        supportedVersions: ["v1"],
        deprecatedVersions: [],
      })
    );

    // Add common security headers
    this.router.use((req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-XSS-Protection", "1; mode=block");
      next();
    });
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.router.get("/health", (req, res) => {
      res.status(HTTP_STATUS.OK).json(
        ResponseBuilder.success(
          {
            status: "healthy",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
          },
          { requestId: req.id }
        )
      );
    });

    // API info endpoint
    this.router.get("/", (req, res) => {
      const baseUrl = `${req.protocol}://${req.get("host")}/api/v1`;

      res.status(HTTP_STATUS.OK).json(
        ResponseBuilder.success(
          {
            name: "E-commerce REST API",
            version: "v1",
            description:
              "Modern e-commerce backend API with clean architecture",
            documentation: `${baseUrl}/docs`,
            endpoints: {
              health: `${baseUrl}/health`,
              auth: `${baseUrl}/auth`,
              users: `${baseUrl}/users`,
              vendors: `${baseUrl}/vendors`,
              products: `${baseUrl}/products`,
              orders: `${baseUrl}/orders`,
            },
            features: [
              "JWT Authentication",
              "Role-based Access Control",
              "Request/Response Logging",
              "API Versioning",
              "Standardized Error Handling",
              "Performance Monitoring",
            ],
          },
          {
            requestId: req.id,
            processingTime: res.getHeader("X-Response-Time") as number,
          }
        )
      );
    });

    // Initialize controllers with placeholder services
    // TODO: Replace with actual service instances
    const authController = new AuthController();
    const userController = new UserController();
    const vendorController = new VendorController(null as any); // TODO: Inject VendorService
    const productController = new ProductController(null as any); // TODO: Inject ProductService
    const orderController = new OrderController();
    const healthController = new HealthController();

    // Mount route controllers
    this.router.use("/auth", authController.getRouter());
    this.router.use("/users", userController.getRouter());
    this.router.use("/vendors", vendorController.getRouter());
    this.router.use("/products", productController.getRouter());
    this.router.use("/orders", orderController.getRouter());
    this.router.use("/health", healthController.getRouter());
  }

  private initializeErrorHandling(): void {
    // 404 handler for unmatched routes
    this.router.use("*", (req, res) => {
      res
        .status(HTTP_STATUS.NOT_FOUND)
        .json(
          ResponseBuilder.error(
            `Route ${req.method} ${req.originalUrl} not found`,
            "ROUTE_NOT_FOUND",
            undefined,
            { requestId: req.id }
          )
        );
    });

    // Global error handler
    this.router.use((error: Error, req: any, res: any, next: any) => {
      console.error("REST API Error:", error);

      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(
            "Internal server error",
            "INTERNAL_ERROR",
            process.env.NODE_ENV === "development" ? error.stack : undefined,
            { requestId: req.id }
          )
        );
    });
  }

  getRouter(): Router {
    return this.router;
  }
}

// Factory function for creating REST API router
export const createRestApiRouter =
  (): // TODO: Add service parameters when available
  // authService: AuthService,
  // userService: UserService,
  // vendorService: VendorService,
  // productService: ProductService,
  // orderService: OrderService
  Router => {
    const restApi = new RestApiRouter();
    // TODO: Pass services
    // authService,
    // userService,
    // vendorService,
    // productService,
    // orderService

    return restApi.getRouter();
  };

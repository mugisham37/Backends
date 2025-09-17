/**
 * Security Configuration
 * Centralized security setup and configuration
 */

import type { FastifyInstance } from "fastify";
import { JWTService } from "../../modules/auth/jwt.service.js";
import { RBACService } from "../../modules/auth/rbac.service.js";
import {
  createAuthMiddleware,
  createRBACMiddleware,
  securityMiddleware,
  securityConfigs,
  getRateLimitMiddleware,
  rateLimitConfigs,
  bruteForceConfigs,
} from "../middleware/index.js";
import { db } from "../../core/database/connection.js";
import { config } from "./env.config.js";
import { logger } from "../utils/logger.js";

export interface SecuritySetupOptions {
  enableRateLimit?: boolean;
  enableBruteForceProtection?: boolean;
  enableSecurityHeaders?: boolean;
  enableInputSanitization?: boolean;
  enableCORS?: boolean;
  corsOrigins?: string | string[] | boolean;
}

export class SecurityConfig {
  private jwtService: JWTService;
  private rbacService: RBACService;
  private authMiddleware: any;
  private rbacMiddleware: any;
  private rateLimitMiddleware: any;

  constructor() {
    this.jwtService = new JWTService();
    this.rbacService = new RBACService(db);
    this.authMiddleware = createAuthMiddleware(this.jwtService);
    this.rbacMiddleware = createRBACMiddleware(this.rbacService);
    this.rateLimitMiddleware = getRateLimitMiddleware();
  }

  /**
   * Setup comprehensive security for Fastify instance
   */
  async setupSecurity(
    fastify: FastifyInstance,
    options: SecuritySetupOptions = {}
  ): Promise<void> {
    const {
      enableRateLimit = true,
      enableBruteForceProtection = true,
      enableSecurityHeaders = true,
      enableInputSanitization = true,
      enableCORS = true,
      corsOrigins = config.nodeEnv === "development" ? true : false,
    } = options;

    // Security headers
    if (enableSecurityHeaders) {
      const securityConfig =
        config.nodeEnv === "production"
          ? securityConfigs.strict
          : securityConfigs.development;

      fastify.addHook(
        "preHandler",
        securityMiddleware.securityHeaders(securityConfig)
      );
    }

    // Input sanitization
    if (enableInputSanitization) {
      fastify.addHook(
        "preHandler",
        securityMiddleware.sanitizeInput({
          maxLength: 10000,
          allowedTags: [], // No HTML tags allowed by default
        })
      );
    }

    // CORS
    if (enableCORS) {
      fastify.addHook(
        "preHandler",
        securityMiddleware.corsMiddleware({
          origin: corsOrigins,
          credentials: true,
          methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
          allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "X-Request-ID",
            "X-API-Version",
          ],
          exposedHeaders: [
            "X-Request-ID",
            "X-RateLimit-Remaining",
            "X-RateLimit-Reset",
          ],
        })
      );
    }

    // Global rate limiting
    if (enableRateLimit) {
      const globalRateLimit = this.rateLimitMiddleware.createRateLimit(
        rateLimitConfigs.api
      );
      fastify.addHook("preHandler", globalRateLimit);
    }

    // Request size limiting
    fastify.addHook(
      "preHandler",
      securityMiddleware.requestSizeLimit(10 * 1024 * 1024)
    ); // 10MB

    // Add security context to request
    fastify.decorateRequest("security", {
      isAuthenticated: false,
      user: null,
      permissions: [],
      roles: [],
    });
  }

  /**
   * Get authentication middleware
   */
  getAuthMiddleware() {
    return this.authMiddleware;
  }

  /**
   * Get RBAC middleware
   */
  getRBACMiddleware() {
    return this.rbacMiddleware;
  }

  /**
   * Get rate limiting middleware
   */
  getRateLimitMiddleware() {
    return this.rateLimitMiddleware;
  }

  /**
   * Get JWT service
   */
  getJWTService() {
    return this.jwtService;
  }

  /**
   * Get RBAC service
   */
  getRBACService() {
    return this.rbacService;
  }

  /**
   * Create endpoint-specific rate limiting
   */
  createEndpointRateLimit(endpoint: keyof typeof rateLimitConfigs) {
    return this.rateLimitMiddleware.createRateLimit(rateLimitConfigs[endpoint]);
  }

  /**
   * Create brute force protection
   */
  createBruteForceProtection(type: keyof typeof bruteForceConfigs) {
    return this.rateLimitMiddleware.createBruteForceProtection(
      bruteForceConfigs[type]
    );
  }

  /**
   * Setup default RBAC roles and permissions
   */
  async setupDefaultRBAC(): Promise<void> {
    try {
      // Create default permissions
      const defaultPermissions = [
        // User permissions
        {
          name: "users:create",
          description: "Create users",
          resource: "users",
          action: "create",
        },
        {
          name: "users:read",
          description: "Read users",
          resource: "users",
          action: "read",
        },
        {
          name: "users:update",
          description: "Update users",
          resource: "users",
          action: "update",
        },
        {
          name: "users:delete",
          description: "Delete users",
          resource: "users",
          action: "delete",
        },

        // Product permissions
        {
          name: "products:create",
          description: "Create products",
          resource: "products",
          action: "create",
        },
        {
          name: "products:read",
          description: "Read products",
          resource: "products",
          action: "read",
        },
        {
          name: "products:update",
          description: "Update products",
          resource: "products",
          action: "update",
        },
        {
          name: "products:delete",
          description: "Delete products",
          resource: "products",
          action: "delete",
        },

        // Order permissions
        {
          name: "orders:create",
          description: "Create orders",
          resource: "orders",
          action: "create",
        },
        {
          name: "orders:read",
          description: "Read orders",
          resource: "orders",
          action: "read",
        },
        {
          name: "orders:update",
          description: "Update orders",
          resource: "orders",
          action: "update",
        },
        {
          name: "orders:delete",
          description: "Delete orders",
          resource: "orders",
          action: "delete",
        },

        // Vendor permissions
        {
          name: "vendors:create",
          description: "Create vendors",
          resource: "vendors",
          action: "create",
        },
        {
          name: "vendors:read",
          description: "Read vendors",
          resource: "vendors",
          action: "read",
        },
        {
          name: "vendors:update",
          description: "Update vendors",
          resource: "vendors",
          action: "update",
        },
        {
          name: "vendors:delete",
          description: "Delete vendors",
          resource: "vendors",
          action: "delete",
        },

        // Admin permissions
        {
          name: "roles:manage",
          description: "Manage roles",
          resource: "roles",
          action: "manage",
        },
        {
          name: "analytics:read",
          description: "View analytics",
          resource: "analytics",
          action: "read",
        },
        {
          name: "system:configure",
          description: "Configure system",
          resource: "system",
          action: "configure",
        },
      ];

      for (const permission of defaultPermissions) {
        try {
          await this.rbacService.createPermission(permission);
        } catch (error) {
          // Permission might already exist, continue
        }
      }

      // Create default roles
      const defaultRoles = [
        { name: "admin", description: "System administrator", isSystem: true },
        { name: "vendor", description: "Vendor user", isSystem: true },
        { name: "customer", description: "Customer user", isSystem: true },
        {
          name: "moderator",
          description: "Content moderator",
          isSystem: false,
        },
      ];

      for (const role of defaultRoles) {
        try {
          await this.rbacService.createRole(role);
        } catch (error) {
          // Role might already exist, continue
        }
      }

      // Assign permissions to roles
      const rolePermissions = [
        // Admin gets all permissions
        { role: "admin", permissions: defaultPermissions.map((p) => p.name) },

        // Vendor permissions
        {
          role: "vendor",
          permissions: [
            "products:create",
            "products:read",
            "products:update",
            "products:delete",
            "orders:read",
            "orders:update",
            "vendors:read",
            "vendors:update",
          ],
        },

        // Customer permissions
        {
          role: "customer",
          permissions: [
            "products:read",
            "orders:create",
            "orders:read",
            "users:read",
            "users:update", // Own profile only
          ],
        },

        // Moderator permissions
        {
          role: "moderator",
          permissions: [
            "products:read",
            "products:update",
            "users:read",
            "orders:read",
            "vendors:read",
          ],
        },
      ];

      for (const { role, permissions } of rolePermissions) {
        for (const permission of permissions) {
          try {
            await this.rbacService.assignPermissionToRole(role, permission);
          } catch (error) {
            // Permission might already be assigned, continue
          }
        }
      }

      logger.info("✅ Default RBAC setup completed");
    } catch (error) {
      logger.error("❌ Failed to setup default RBAC:", error);
    }
  }
}

// Singleton instance
let securityConfig: SecurityConfig | null = null;

export const getSecurityConfig = (): SecurityConfig => {
  if (!securityConfig) {
    securityConfig = new SecurityConfig();
  }
  return securityConfig;
};

// Export commonly used security configurations
export const securityPresets = {
  // Strict security for production APIs
  production: {
    enableRateLimit: true,
    enableBruteForceProtection: true,
    enableSecurityHeaders: true,
    enableInputSanitization: true,
    enableCORS: true,
    corsOrigins: false, // Must be explicitly configured
  },

  // Development-friendly settings
  development: {
    enableRateLimit: false,
    enableBruteForceProtection: false,
    enableSecurityHeaders: true,
    enableInputSanitization: true,
    enableCORS: true,
    corsOrigins: true,
  },

  // Testing environment
  test: {
    enableRateLimit: false,
    enableBruteForceProtection: false,
    enableSecurityHeaders: false,
    enableInputSanitization: true,
    enableCORS: true,
    corsOrigins: true,
  },
};

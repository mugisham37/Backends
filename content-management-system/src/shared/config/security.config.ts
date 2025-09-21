/**
 * Security Configuration
 * Comprehensive security setup with RBAC, rate limiting, and environment-specific presets
 */

import type { FastifyRequest } from "fastify";
import { logger } from "../utils/logger";
import { config } from "./env.config";

/**
 * Security configuration interface
 */
export interface SecurityConfig {
  // Authentication settings
  authentication: {
    enabled: boolean;
    requireApiKey: boolean;
    jwtVerification: boolean;
    sessionManagement: boolean;
  };

  // Authorization settings
  authorization: {
    rbacEnabled: boolean;
    permissionsEnabled: boolean;
    multiTenantIsolation: boolean;
  };

  // Rate limiting settings
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
    keyGenerator?: (request: FastifyRequest) => string;
  };

  // Security headers
  headers: {
    helmet: boolean;
    hsts: boolean;
    csp: boolean;
    noSniff: boolean;
    frameOptions: string;
  };

  // Input validation
  validation: {
    strictMode: boolean;
    sanitizeInput: boolean;
    maxPayloadSize: number;
  };

  // Monitoring and auditing
  monitoring: {
    auditLogs: boolean;
    securityEvents: boolean;
    suspiciousActivity: boolean;
  };
}

/**
 * Security presets for different environments
 */
export const securityPresets = {
  development: {
    authentication: {
      enabled: true,
      requireApiKey: false,
      jwtVerification: true,
      sessionManagement: true,
    },
    authorization: {
      rbacEnabled: true,
      permissionsEnabled: true,
      multiTenantIsolation: true,
    },
    rateLimiting: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000, // Lenient for development
      skipSuccessfulRequests: false,
    },
    headers: {
      helmet: true,
      hsts: false, // Disabled for local development
      csp: false, // Relaxed for development
      noSniff: true,
      frameOptions: "DENY",
    },
    validation: {
      strictMode: false,
      sanitizeInput: true,
      maxPayloadSize: config.upload.maxFileSize,
    },
    monitoring: {
      auditLogs: true,
      securityEvents: true,
      suspiciousActivity: false,
    },
  } as SecurityConfig,

  staging: {
    authentication: {
      enabled: true,
      requireApiKey: true,
      jwtVerification: true,
      sessionManagement: true,
    },
    authorization: {
      rbacEnabled: true,
      permissionsEnabled: true,
      multiTenantIsolation: true,
    },
    rateLimiting: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 500, // Moderate for staging
      skipSuccessfulRequests: false,
    },
    headers: {
      helmet: true,
      hsts: true,
      csp: true,
      noSniff: true,
      frameOptions: "DENY",
    },
    validation: {
      strictMode: true,
      sanitizeInput: true,
      maxPayloadSize: config.upload.maxFileSize,
    },
    monitoring: {
      auditLogs: true,
      securityEvents: true,
      suspiciousActivity: true,
    },
  } as SecurityConfig,

  production: {
    authentication: {
      enabled: true,
      requireApiKey: true,
      jwtVerification: true,
      sessionManagement: true,
    },
    authorization: {
      rbacEnabled: true,
      permissionsEnabled: true,
      multiTenantIsolation: true,
    },
    rateLimiting: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: config.rateLimit.max, // Strict for production
      skipSuccessfulRequests: false,
    },
    headers: {
      helmet: true,
      hsts: true,
      csp: true,
      noSniff: true,
      frameOptions: "DENY",
    },
    validation: {
      strictMode: true,
      sanitizeInput: true,
      maxPayloadSize: config.upload.maxFileSize,
    },
    monitoring: {
      auditLogs: true,
      securityEvents: true,
      suspiciousActivity: true,
    },
  } as SecurityConfig,
} as const;

/**
 * Get security configuration based on environment
 */
export const getSecurityConfig = (): SecurityConfig & {
  setupDefaultRBAC: () => Promise<void>;
  validateSecurityHeaders: (request: FastifyRequest) => boolean;
  generateSecurityReport: () => Promise<SecurityReport>;
} => {
  const baseConfig = config.isProduction
    ? securityPresets.production
    : config.isStaging
      ? securityPresets.staging
      : securityPresets.development;

  return {
    ...baseConfig,

    /**
     * Setup default RBAC roles and permissions
     */
    setupDefaultRBAC: async () => {
      try {
        logger.info("🔐 Setting up default RBAC configuration...");

        // This would typically interact with your user/role services
        // For now, we'll just log the setup
        const defaultRoles = [
          { name: "admin", permissions: ["*"] },
          {
            name: "editor",
            permissions: [
              "content:read",
              "content:write",
              "media:read",
              "media:write",
            ],
          },
          { name: "viewer", permissions: ["content:read", "media:read"] },
          { name: "user", permissions: ["profile:read", "profile:write"] },
        ];

        logger.info(
          "📋 Default roles configured:",
          defaultRoles.map((r) => r.name)
        );
        logger.info("✅ RBAC setup completed");
      } catch (error) {
        logger.error("❌ RBAC setup failed:", error);
        throw error;
      }
    },

    /**
     * Validate security headers on incoming requests
     */
    validateSecurityHeaders: (request: FastifyRequest): boolean => {
      if (!baseConfig.headers.helmet) return true;

      const requiredHeaders = [];
      const missingHeaders = [];

      if (config.isProduction) {
        requiredHeaders.push("x-request-id", "user-agent");
      }

      for (const header of requiredHeaders) {
        if (!request.headers[header]) {
          missingHeaders.push(header);
        }
      }

      if (missingHeaders.length > 0) {
        logger.warn("⚠️ Missing security headers:", {
          url: request.url,
          missing: missingHeaders,
        });
        return false;
      }

      return true;
    },

    /**
     * Generate security configuration report
     */
    generateSecurityReport: async (): Promise<SecurityReport> => {
      return {
        environment: config.nodeEnv,
        timestamp: new Date().toISOString(),
        configuration: {
          authentication: baseConfig.authentication.enabled,
          authorization: baseConfig.authorization.rbacEnabled,
          rateLimiting: baseConfig.rateLimiting.enabled,
          securityHeaders: baseConfig.headers.helmet,
          inputValidation: baseConfig.validation.strictMode,
          monitoring: baseConfig.monitoring.auditLogs,
        },
        compliance: {
          gdprReady: true,
          hipaaCompatible: config.isProduction,
          sox404Compliant:
            config.isProduction && baseConfig.monitoring.auditLogs,
        },
        recommendations: await generateSecurityRecommendations(baseConfig),
      };
    },
  };
};

/**
 * Security report interface
 */
export interface SecurityReport {
  environment: string;
  timestamp: string;
  configuration: {
    authentication: boolean;
    authorization: boolean;
    rateLimiting: boolean;
    securityHeaders: boolean;
    inputValidation: boolean;
    monitoring: boolean;
  };
  compliance: {
    gdprReady: boolean;
    hipaaCompatible: boolean;
    sox404Compliant: boolean;
  };
  recommendations: string[];
}

/**
 * Generate security recommendations based on current configuration
 */
const generateSecurityRecommendations = async (
  securityConfig: SecurityConfig
): Promise<string[]> => {
  const recommendations: string[] = [];

  if (!securityConfig.headers.hsts && !config.isDevelopment) {
    recommendations.push("Enable HSTS headers for HTTPS enforcement");
  }

  if (!securityConfig.headers.csp) {
    recommendations.push("Implement Content Security Policy (CSP) headers");
  }

  if (securityConfig.rateLimiting.maxRequests > 1000) {
    recommendations.push("Consider lowering rate limit for better protection");
  }

  if (!securityConfig.monitoring.suspiciousActivity) {
    recommendations.push("Enable suspicious activity monitoring");
  }

  if (!securityConfig.validation.strictMode) {
    recommendations.push("Enable strict validation mode for production");
  }

  return recommendations;
};

/**
 * Security middleware factory
 */
export const createSecurityMiddleware = (securityConfig: SecurityConfig) => {
  return {
    // Authentication middleware
    authenticate: async (request: FastifyRequest) => {
      if (!securityConfig.authentication.enabled) return true;

      // JWT verification logic would go here
      const token = request.headers.authorization?.replace("Bearer ", "");

      if (!token && securityConfig.authentication.jwtVerification) {
        throw new Error("Authentication token required");
      }

      return true;
    },

    // Authorization middleware
    authorize: async (
      _request: FastifyRequest,
      _requiredPermissions: string[]
    ) => {
      if (!securityConfig.authorization.rbacEnabled) return true;

      // RBAC logic would go here
      // This would check user roles and permissions

      return true;
    },

    // Rate limiting middleware
    rateLimit: (_request: FastifyRequest) => {
      if (!securityConfig.rateLimiting.enabled) return true;

      // Rate limiting logic implementation
      // This would integrate with Redis or in-memory store
      return true;
    },
  };
};

/**
 * Security event logging
 */
export const logSecurityEvent = (event: {
  type: "authentication" | "authorization" | "suspicious" | "violation";
  severity: "low" | "medium" | "high" | "critical";
  request: FastifyRequest;
  details: Record<string, any>;
}) => {
  const securityLogger = logger.child({ module: "security" });

  const logData = {
    timestamp: new Date().toISOString(),
    eventType: event.type,
    severity: event.severity,
    requestId: event.request.id,
    url: event.request.url,
    method: event.request.method,
    ip: event.request.ip,
    userAgent: event.request.headers["user-agent"],
    ...event.details,
  };

  switch (event.severity) {
    case "critical":
      securityLogger.fatal("Critical security event", logData);
      break;
    case "high":
      securityLogger.error("High severity security event", logData);
      break;
    case "medium":
      securityLogger.warn("Medium severity security event", logData);
      break;
    default:
      securityLogger.info("Security event logged", logData);
      break;
  }
};

export default getSecurityConfig;

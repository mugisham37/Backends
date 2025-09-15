import { injectable, inject } from "tsyringe";
import type { Result } from "../core/types/result.types";
import { logger, createModuleLogger } from "../utils/logger";
import type { CacheService } from "./cache.service";

// Audit event types
export type AuditEventType =
  | "auth_attempt"
  | "auth_success"
  | "auth_failure"
  | "security_event"
  | "tenant_event"
  | "content_event"
  | "media_event"
  | "api_request"
  | "system_error"
  | "performance_metrics"
  | "user_action"
  | "data_access"
  | "configuration_change";

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  timestamp: Date;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  details: Record<string, unknown>;
  severity: "low" | "medium" | "high" | "critical";
  tags?: string[];
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  tenantId?: string;
  userId?: string;
}

export interface SystemHealthMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  database: {
    connections: number;
    responseTime: number;
    status: "healthy" | "degraded" | "unhealthy";
  };
  cache: {
    hitRate: number;
    memoryUsage: number;
    status: "healthy" | "degraded" | "unhealthy";
  };
  api: {
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

/**
 * Enhanced audit service for comprehensive logging and monitoring
 * Handles request/response logging, security events, performance monitoring, and system health
 */
@injectable()
export class AuditService {
  private readonly auditLogger = createModuleLogger("audit");
  private readonly performanceLogger = createModuleLogger("performance");
  private readonly securityLogger = createModuleLogger("security");

  constructor(
    @inject("CacheService") private readonly cacheService: CacheService
  ) {}
  /**
   * Create a comprehensive audit event
   */
  private createAuditEvent(
    type: AuditEventType,
    data: Partial<AuditEvent> & { details: Record<string, unknown> }
  ): AuditEvent {
    return {
      id: crypto.randomUUID(),
      type,
      timestamp: new Date(),
      severity: data.severity || "medium",
      ...data,
    } as AuditEvent;
  }

  /**
   * Log audit event with caching and structured logging
   */
  private async logAuditEvent(event: AuditEvent): Promise<Result<void, Error>> {
    try {
      // Log to structured logger
      this.auditLogger.info("Audit event", event);

      // Cache recent events for quick access (last 1000 events, 1 hour TTL)
      const cacheKey = `audit:recent:${event.type}`;
      const recentEvents =
        (await this.cacheService.get<AuditEvent[]>(cacheKey)) || [];
      recentEvents.unshift(event);

      // Keep only last 100 events per type
      if (recentEvents.length > 100) {
        recentEvents.splice(100);
      }

      await this.cacheService.set(cacheKey, recentEvents, 3600);

      // Track metrics
      await this.trackEventMetrics(event);

      return { success: true, data: undefined };
    } catch (error) {
      logger.error("Failed to log audit event:", error);
      return {
        success: false,
        error: new Error("Failed to log audit event"),
      };
    }
  }

  /**
   * Track event metrics for monitoring
   */
  private async trackEventMetrics(event: AuditEvent): Promise<void> {
    try {
      const metricsKey = `metrics:audit:${event.type}`;
      const currentCount =
        (await this.cacheService.get<number>(metricsKey)) || 0;
      await this.cacheService.set(metricsKey, currentCount + 1, 3600);

      // Track security events separately
      if (event.severity === "high" || event.severity === "critical") {
        const securityKey = `metrics:security:${event.type}`;
        const securityCount =
          (await this.cacheService.get<number>(securityKey)) || 0;
        await this.cacheService.set(securityKey, securityCount + 1, 3600);
      }
    } catch (error) {
      logger.warn("Failed to track event metrics:", error);
    }
  }

  /**
   * Log authentication attempt with enhanced tracking
   */
  async logAuthAttempt(data: {
    userId?: string;
    email: string;
    success: boolean;
    reason?: string;
    ip?: string;
    userAgent?: string;
    sessionId?: string;
    tenantId?: string;
  }): Promise<Result<void, Error>> {
    const event = this.createAuditEvent(
      data.success ? "auth_success" : "auth_failure",
      {
        userId: data.userId,
        tenantId: data.tenantId,
        sessionId: data.sessionId,
        ip: data.ip,
        userAgent: data.userAgent,
        severity: data.success ? "low" : "medium",
        details: {
          email: data.email,
          reason: data.reason,
          success: data.success,
        },
        tags: ["authentication", data.success ? "success" : "failure"],
      }
    );

    return this.logAuditEvent(event);
  }

  /**
   * Log security event with enhanced tracking and alerting
   */
  async logSecurityEvent(data: {
    userId?: string;
    tenantId?: string;
    event: string;
    details: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
    severity?: "low" | "medium" | "high" | "critical";
  }): Promise<Result<void, Error>> {
    const event = this.createAuditEvent("security_event", {
      userId: data.userId,
      tenantId: data.tenantId,
      ip: data.ip,
      userAgent: data.userAgent,
      severity: data.severity || "high",
      action: data.event,
      details: data.details,
      tags: ["security", data.event],
    });

    // Log to security logger for enhanced monitoring
    this.securityLogger.warn("Security event detected", event);

    // Check for critical security events that need immediate attention
    if (event.severity === "critical") {
      await this.handleCriticalSecurityEvent(event);
    }

    return this.logAuditEvent(event);
  }

  /**
   * Handle critical security events with alerting
   */
  private async handleCriticalSecurityEvent(event: AuditEvent): Promise<void> {
    try {
      // Increment critical event counter
      const criticalKey = "metrics:security:critical";
      const criticalCount =
        (await this.cacheService.get<number>(criticalKey)) || 0;
      await this.cacheService.set(criticalKey, criticalCount + 1, 3600);

      // Log critical event for external monitoring systems
      this.securityLogger.fatal("CRITICAL SECURITY EVENT", {
        eventId: event.id,
        type: event.type,
        action: event.action,
        userId: event.userId,
        tenantId: event.tenantId,
        ip: event.ip,
        details: event.details,
        timestamp: event.timestamp,
      });

      // In production, this would trigger alerts to security team
      // For now, we'll just log it prominently
    } catch (error) {
      logger.error("Failed to handle critical security event:", error);
    }
  }

  /**
   * Log tenant event
   */
  async logTenantEvent(data: {
    tenantId: string;
    userId?: string;
    event: string;
    details: Record<string, unknown>;
  }): Promise<Result<void, Error>> {
    try {
      logger.info("Tenant event", {
        type: "tenant_event",
        tenantId: data.tenantId,
        userId: data.userId,
        event: data.event,
        details: data.details,
        timestamp: new Date(),
      });

      return { success: true, data: undefined };
    } catch (error) {
      logger.error("Failed to log tenant event:", error);
      return {
        success: false,
        error: new Error("Failed to log tenant event"),
      };
    }
  }

  /**
   * Log content event
   */
  async logContentEvent(data: {
    contentId: string;
    tenantId: string;
    userId: string;
    event: string;
    details: Record<string, unknown>;
  }): Promise<Result<void, Error>> {
    try {
      logger.info("Content event", {
        type: "content_event",
        contentId: data.contentId,
        tenantId: data.tenantId,
        userId: data.userId,
        event: data.event,
        details: data.details,
        timestamp: new Date(),
      });

      return { success: true, data: undefined };
    } catch (error) {
      logger.error("Failed to log content event:", error);
      return {
        success: false,
        error: new Error("Failed to log content event"),
      };
    }
  }

  /**
   * Log media event
   */
  async logMediaEvent(data: {
    mediaId?: string;
    tenantId: string;
    userId: string;
    event: string;
    details: Record<string, unknown>;
  }): Promise<Result<void, Error>> {
    try {
      logger.info("Media event", {
        type: "media_event",
        mediaId: data.mediaId,
        tenantId: data.tenantId,
        userId: data.userId,
        event: data.event,
        details: data.details,
        timestamp: new Date(),
      });

      return { success: true, data: undefined };
    } catch (error) {
      logger.error("Failed to log media event:", error);
      return {
        success: false,
        error: new Error("Failed to log media event"),
      };
    }
  }

  /**
   * Log API request with enhanced metrics tracking
   */
  async logApiRequest(data: {
    method: string;
    url: string;
    statusCode: number;
    responseTime: number;
    userId?: string;
    tenantId?: string;
    sessionId?: string;
    ip?: string;
    userAgent?: string;
    requestSize?: number;
    responseSize?: number;
    requestId?: string;
  }): Promise<Result<void, Error>> {
    const isError = data.statusCode >= 400;
    const isSlow = data.responseTime > 1000; // Consider requests over 1s as slow

    const event = this.createAuditEvent("api_request", {
      userId: data.userId,
      tenantId: data.tenantId,
      sessionId: data.sessionId,
      ip: data.ip,
      userAgent: data.userAgent,
      severity: isError ? "medium" : "low",
      resource: data.url,
      action: data.method,
      details: {
        method: data.method,
        url: data.url,
        statusCode: data.statusCode,
        responseTime: data.responseTime,
        requestSize: data.requestSize,
        responseSize: data.responseSize,
        requestId: data.requestId,
        isError,
        isSlow,
      },
      tags: [
        "api",
        data.method.toLowerCase(),
        isError ? "error" : "success",
        ...(isSlow ? ["slow"] : []),
      ],
    });

    // Track API metrics
    await this.trackApiMetrics(data);

    return this.logAuditEvent(event);
  }

  /**
   * Track API metrics for monitoring dashboard
   */
  private async trackApiMetrics(data: {
    method: string;
    url: string;
    statusCode: number;
    responseTime: number;
    tenantId?: string;
  }): Promise<void> {
    try {
      const now = new Date();
      const minute = Math.floor(now.getTime() / 60000); // Current minute

      // Track requests per minute
      const rpmKey = `metrics:api:rpm:${minute}`;
      const currentRpm = (await this.cacheService.get<number>(rpmKey)) || 0;
      await this.cacheService.set(rpmKey, currentRpm + 1, 120); // 2 minute TTL

      // Track response times
      const responseTimeKey = `metrics:api:response_times:${minute}`;
      const responseTimes =
        (await this.cacheService.get<number[]>(responseTimeKey)) || [];
      responseTimes.push(data.responseTime);
      await this.cacheService.set(responseTimeKey, responseTimes, 120);

      // Track error rates
      if (data.statusCode >= 400) {
        const errorKey = `metrics:api:errors:${minute}`;
        const currentErrors =
          (await this.cacheService.get<number>(errorKey)) || 0;
        await this.cacheService.set(errorKey, currentErrors + 1, 120);
      }

      // Track by endpoint
      const endpointKey = `metrics:api:endpoint:${data.method}:${data.url}:${minute}`;
      const endpointCount =
        (await this.cacheService.get<number>(endpointKey)) || 0;
      await this.cacheService.set(endpointKey, endpointCount + 1, 120);

      // Track by tenant if available
      if (data.tenantId) {
        const tenantKey = `metrics:api:tenant:${data.tenantId}:${minute}`;
        const tenantCount =
          (await this.cacheService.get<number>(tenantKey)) || 0;
        await this.cacheService.set(tenantKey, tenantCount + 1, 120);
      }
    } catch (error) {
      logger.warn("Failed to track API metrics:", error);
    }
  }

  /**
   * Log system error
   */
  async logSystemError(data: {
    error: Error;
    context?: Record<string, unknown>;
    userId?: string;
    tenantId?: string;
  }): Promise<Result<void, Error>> {
    try {
      logger.error("System error", {
        type: "system_error",
        message: data.error.message,
        stack: data.error.stack,
        context: data.context,
        userId: data.userId,
        tenantId: data.tenantId,
        timestamp: new Date(),
      });

      return { success: true, data: undefined };
    } catch (error) {
      logger.error("Failed to log system error:", error);
      return {
        success: false,
        error: new Error("Failed to log system error"),
      };
    }
  }

  /**
   * Log performance metrics with trend analysis
   */
  async logPerformanceMetrics(data: {
    operation: string;
    duration: number;
    metadata?: Record<string, unknown>;
    tenantId?: string;
    userId?: string;
  }): Promise<Result<void, Error>> {
    const isSlow = data.duration > 1000; // Operations over 1s are considered slow
    const isVerySlow = data.duration > 5000; // Operations over 5s are very slow

    const metrics: PerformanceMetrics = {
      operation: data.operation,
      duration: data.duration,
      timestamp: new Date(),
      metadata: data.metadata,
      tenantId: data.tenantId,
      userId: data.userId,
    };

    // Log to performance logger
    this.performanceLogger.info("Performance metrics", metrics);

    // Create audit event
    const event = this.createAuditEvent("performance_metrics", {
      userId: data.userId,
      tenantId: data.tenantId,
      severity: isVerySlow ? "high" : isSlow ? "medium" : "low",
      resource: data.operation,
      action: "execute",
      details: {
        operation: data.operation,
        duration: data.duration,
        metadata: data.metadata,
        isSlow,
        isVerySlow,
      },
      tags: [
        "performance",
        data.operation,
        ...(isSlow ? ["slow"] : []),
        ...(isVerySlow ? ["very_slow"] : []),
      ],
    });

    // Track performance trends
    await this.trackPerformanceMetrics(metrics);

    return this.logAuditEvent(event);
  }

  /**
   * Track performance metrics for trend analysis
   */
  private async trackPerformanceMetrics(
    metrics: PerformanceMetrics
  ): Promise<void> {
    try {
      const now = new Date();
      const minute = Math.floor(now.getTime() / 60000);

      // Track operation performance
      const perfKey = `metrics:performance:${metrics.operation}:${minute}`;
      const perfData = (await this.cacheService.get<number[]>(perfKey)) || [];
      perfData.push(metrics.duration);
      await this.cacheService.set(perfKey, perfData, 300); // 5 minute TTL

      // Track slow operations
      if (metrics.duration > 1000) {
        const slowKey = `metrics:performance:slow:${minute}`;
        const slowCount = (await this.cacheService.get<number>(slowKey)) || 0;
        await this.cacheService.set(slowKey, slowCount + 1, 300);
      }
    } catch (error) {
      logger.warn("Failed to track performance metrics:", error);
    }
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filter: {
    type?: string;
    userId?: string;
    tenantId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<Result<any[], Error>> {
    try {
      // In a real implementation, this would query a database or log aggregation service
      // For now, return empty array
      return { success: true, data: [] };
    } catch (error) {
      logger.error("Failed to get audit logs:", error);
      return {
        success: false,
        error: new Error("Failed to get audit logs"),
      };
    }
  }

  /**
   * Get comprehensive system metrics with real-time data
   */
  async getSystemMetrics(timeRange?: { start: Date; end: Date }): Promise<
    Result<
      {
        requests: number;
        errors: number;
        averageResponseTime: number;
        uniqueUsers: number;
        performance: {
          slowOperations: number;
          averageOperationTime: number;
        };
        security: {
          securityEvents: number;
          criticalEvents: number;
        };
        api: {
          requestsPerMinute: number;
          errorRate: number;
          topEndpoints: Array<{ endpoint: string; count: number }>;
        };
      },
      Error
    >
  > {
    try {
      const now = new Date();
      const currentMinute = Math.floor(now.getTime() / 60000);

      // Get metrics from cache (last 60 minutes)
      const metrics = {
        requests: 0,
        errors: 0,
        averageResponseTime: 0,
        uniqueUsers: 0,
        performance: {
          slowOperations: 0,
          averageOperationTime: 0,
        },
        security: {
          securityEvents: 0,
          criticalEvents: 0,
        },
        api: {
          requestsPerMinute: 0,
          errorRate: 0,
          topEndpoints: [] as Array<{ endpoint: string; count: number }>,
        },
      };

      // Aggregate data from last 60 minutes
      const promises = [];
      for (let i = 0; i < 60; i++) {
        const minute = currentMinute - i;
        promises.push(this.getMinuteMetrics(minute));
      }

      const minuteMetrics = await Promise.all(promises);

      // Aggregate the data
      let totalResponseTime = 0;
      let responseTimeCount = 0;
      const uniqueUserSet = new Set<string>();

      for (const minute of minuteMetrics) {
        metrics.requests += minute.requests;
        metrics.errors += minute.errors;
        metrics.performance.slowOperations += minute.slowOperations;

        if (minute.responseTimes.length > 0) {
          totalResponseTime += minute.responseTimes.reduce((a, b) => a + b, 0);
          responseTimeCount += minute.responseTimes.length;
        }

        minute.uniqueUsers.forEach((user) => uniqueUserSet.add(user));
      }

      metrics.uniqueUsers = uniqueUserSet.size;
      metrics.averageResponseTime =
        responseTimeCount > 0 ? totalResponseTime / responseTimeCount : 0;
      metrics.api.requestsPerMinute = metrics.requests / 60;
      metrics.api.errorRate =
        metrics.requests > 0 ? (metrics.errors / metrics.requests) * 100 : 0;

      // Get security metrics
      const securityMetrics = await this.getSecurityMetrics();
      metrics.security = securityMetrics;

      return { success: true, data: metrics };
    } catch (error) {
      logger.error("Failed to get system metrics:", error);
      return {
        success: false,
        error: new Error("Failed to get system metrics"),
      };
    }
  }

  /**
   * Get metrics for a specific minute
   */
  private async getMinuteMetrics(minute: number): Promise<{
    requests: number;
    errors: number;
    responseTimes: number[];
    slowOperations: number;
    uniqueUsers: string[];
  }> {
    try {
      const [requests, errors, responseTimes, slowOps] = await Promise.all([
        this.cacheService.get<number>(`metrics:api:rpm:${minute}`) || 0,
        this.cacheService.get<number>(`metrics:api:errors:${minute}`) || 0,
        this.cacheService.get<number[]>(
          `metrics:api:response_times:${minute}`
        ) || [],
        this.cacheService.get<number>(`metrics:performance:slow:${minute}`) ||
          0,
      ]);

      return {
        requests,
        errors,
        responseTimes,
        slowOperations: slowOps,
        uniqueUsers: [], // Would be populated from actual user tracking
      };
    } catch (error) {
      return {
        requests: 0,
        errors: 0,
        responseTimes: [],
        slowOperations: 0,
        uniqueUsers: [],
      };
    }
  }

  /**
   * Get security metrics
   */
  private async getSecurityMetrics(): Promise<{
    securityEvents: number;
    criticalEvents: number;
  }> {
    try {
      const [securityEvents, criticalEvents] = await Promise.all([
        this.cacheService.get<number>("metrics:security:security_event") || 0,
        this.cacheService.get<number>("metrics:security:critical") || 0,
      ]);

      return { securityEvents, criticalEvents };
    } catch (error) {
      return { securityEvents: 0, criticalEvents: 0 };
    }
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth(): Promise<Result<SystemHealthMetrics, Error>> {
    try {
      const health: SystemHealthMetrics = {
        timestamp: new Date(),
        cpu: {
          usage: process.cpuUsage().user / 1000000, // Convert to seconds
          loadAverage: require("os").loadavg(),
        },
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          percentage:
            (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) *
            100,
        },
        database: {
          connections: 0, // Would be populated from actual DB connection pool
          responseTime: 0, // Would be measured from actual DB queries
          status: "healthy",
        },
        cache: {
          hitRate: 0, // Would be calculated from cache statistics
          memoryUsage: 0, // Would be from Redis info
          status: "healthy",
        },
        api: {
          requestsPerMinute: 0,
          averageResponseTime: 0,
          errorRate: 0,
        },
      };

      // Get real-time API metrics
      const apiMetrics = await this.getSystemMetrics();
      if (apiMetrics.success) {
        health.api.requestsPerMinute = apiMetrics.data.api.requestsPerMinute;
        health.api.averageResponseTime = apiMetrics.data.averageResponseTime;
        health.api.errorRate = apiMetrics.data.api.errorRate;
      }

      return { success: true, data: health };
    } catch (error) {
      logger.error("Failed to get system health:", error);
      return {
        success: false,
        error: new Error("Failed to get system health"),
      };
    }
  }

  /**
   * Log system error with context and alerting
   */
  async logSystemError(data: {
    error: Error;
    context?: Record<string, unknown>;
    userId?: string;
    tenantId?: string;
    severity?: "low" | "medium" | "high" | "critical";
  }): Promise<Result<void, Error>> {
    const event = this.createAuditEvent("system_error", {
      userId: data.userId,
      tenantId: data.tenantId,
      severity: data.severity || "high",
      details: {
        message: data.error.message,
        stack: data.error.stack,
        name: data.error.name,
        context: data.context,
      },
      tags: ["error", "system", data.error.name.toLowerCase()],
    });

    // Log critical errors for immediate attention
    if (event.severity === "critical") {
      logger.fatal("CRITICAL SYSTEM ERROR", {
        eventId: event.id,
        error: data.error.message,
        stack: data.error.stack,
        context: data.context,
        timestamp: event.timestamp,
      });
    }

    return this.logAuditEvent(event);
  }

  /**
   * Log user action for compliance and analytics
   */
  async logUserAction(data: {
    userId: string;
    tenantId?: string;
    action: string;
    resource: string;
    details: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }): Promise<Result<void, Error>> {
    const event = this.createAuditEvent("user_action", {
      userId: data.userId,
      tenantId: data.tenantId,
      ip: data.ip,
      userAgent: data.userAgent,
      severity: "low",
      resource: data.resource,
      action: data.action,
      details: data.details,
      tags: ["user_action", data.action, data.resource],
    });

    return this.logAuditEvent(event);
  }

  /**
   * Get recent audit events with filtering
   */
  async getAuditLogs(filter: {
    type?: AuditEventType;
    userId?: string;
    tenantId?: string;
    severity?: "low" | "medium" | "high" | "critical";
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<Result<AuditEvent[], Error>> {
    try {
      const limit = filter.limit || 100;
      const events: AuditEvent[] = [];

      // Get events from cache by type
      if (filter.type) {
        const cacheKey = `audit:recent:${filter.type}`;
        const typeEvents =
          (await this.cacheService.get<AuditEvent[]>(cacheKey)) || [];
        events.push(...typeEvents);
      } else {
        // Get events from all types
        const eventTypes: AuditEventType[] = [
          "auth_attempt",
          "auth_success",
          "auth_failure",
          "security_event",
          "tenant_event",
          "content_event",
          "media_event",
          "api_request",
          "system_error",
          "performance_metrics",
          "user_action",
          "data_access",
        ];

        for (const type of eventTypes) {
          const cacheKey = `audit:recent:${type}`;
          const typeEvents =
            (await this.cacheService.get<AuditEvent[]>(cacheKey)) || [];
          events.push(...typeEvents);
        }
      }

      // Apply filters
      let filteredEvents = events;

      if (filter.userId) {
        filteredEvents = filteredEvents.filter(
          (e) => e.userId === filter.userId
        );
      }

      if (filter.tenantId) {
        filteredEvents = filteredEvents.filter(
          (e) => e.tenantId === filter.tenantId
        );
      }

      if (filter.severity) {
        filteredEvents = filteredEvents.filter(
          (e) => e.severity === filter.severity
        );
      }

      if (filter.startDate) {
        filteredEvents = filteredEvents.filter(
          (e) => e.timestamp >= filter.startDate!
        );
      }

      if (filter.endDate) {
        filteredEvents = filteredEvents.filter(
          (e) => e.timestamp <= filter.endDate!
        );
      }

      // Sort by timestamp (newest first) and limit
      filteredEvents.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );
      filteredEvents = filteredEvents.slice(0, limit);

      return { success: true, data: filteredEvents };
    } catch (error) {
      logger.error("Failed to get audit logs:", error);
      return {
        success: false,
        error: new Error("Failed to get audit logs"),
      };
    }
  }
}

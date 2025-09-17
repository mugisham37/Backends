/**
 * Analytics Controller
 * Handles analytics endpoints: tracking, reporting, and dashboard data
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  AnalyticsService,
  type EventTrackingInput,
  type BusinessMetricInput,
} from "./analytics.service.js";
import { AppError } from "../../core/errors/app-error.js";
import {
  ResponseBuilder,
  HTTP_STATUS,
} from "../../shared/utils/response.utils.js";
import type { AuthenticatedRequest } from "../../shared/middleware/auth.middleware.js";

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Track a single analytics event
   */
  async trackEvent(
    request: FastifyRequest<{ Body: EventTrackingInput }>,
    reply: FastifyReply
  ): Promise<void> {
    // Enrich event data with request context
    const eventData: EventTrackingInput = {
      ...request.body,
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip,
      referrer: request.headers.referer,
    };

    const event = await this.analyticsService.trackEvent(eventData);

    reply
      .status(HTTP_STATUS.CREATED)
      .send(ResponseBuilder.success(event, { requestId: (request as any).id }));
  }

  /**
   * Track multiple analytics events in batch
   */
  async trackEventsBatch(
    request: FastifyRequest<{ Body: { events: EventTrackingInput[] } }>,
    reply: FastifyReply
  ): Promise<void> {
    const { events } = request.body;

    if (!events || !Array.isArray(events) || events.length === 0) {
      throw new AppError(
        "Events array is required",
        400,
        "INVALID_EVENTS_ARRAY"
      );
    }

    // Enrich each event with request context
    const enrichedEvents = events.map((event) => ({
      ...event,
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip,
      referrer: request.headers.referer,
    }));

    const trackedEvents = await this.analyticsService.trackEventsBatch(
      enrichedEvents
    );

    reply
      .status(HTTP_STATUS.CREATED)
      .send(
        ResponseBuilder.success(
          { events: trackedEvents, count: trackedEvents.length },
          { requestId: (request as any).id }
        )
      );
  }

  /**
   * Get analytics events with filters
   */
  async getEvents(
    request: FastifyRequest<{
      Querystring: {
        eventType?: string;
        eventCategory?: string;
        userId?: string;
        sessionId?: string;
        startDate?: string;
        endDate?: string;
        limit?: number;
        offset?: number;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const {
      eventType,
      eventCategory,
      userId,
      sessionId,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = request.query;

    const filters: any = {};
    if (eventType) filters.eventType = eventType;
    if (eventCategory) filters.eventCategory = eventCategory;
    if (userId) filters.userId = userId;
    if (sessionId) filters.sessionId = sessionId;

    if (startDate && endDate) {
      filters.dateRange = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      };
    }

    const events = await this.analyticsService.getEvents(
      filters,
      limit,
      offset
    );

    reply.send(
      ResponseBuilder.success(
        { events, count: events.length },
        { requestId: (request as any).id }
      )
    );
  }

  /**
   * Get analytics summary for dashboard
   */
  async getAnalyticsSummary(
    request: FastifyRequest<{
      Querystring: {
        startDate: string;
        endDate: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const { startDate, endDate } = request.query;

    if (!startDate || !endDate) {
      throw new AppError(
        "Start date and end date are required",
        400,
        "MISSING_DATE_RANGE"
      );
    }

    const dateRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };

    const summary = await this.analyticsService.getAnalyticsSummary(dateRange);

    reply.send(
      ResponseBuilder.success(summary, { requestId: (request as any).id })
    );
  }

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData(
    request: FastifyRequest<{
      Querystring: {
        startDate: string;
        endDate: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const { startDate, endDate } = request.query;

    if (!startDate || !endDate) {
      throw new AppError(
        "Start date and end date are required",
        400,
        "MISSING_DATE_RANGE"
      );
    }

    const dateRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };

    const dashboardData = await this.analyticsService.getDashboardData(
      dateRange
    );

    reply.send(
      ResponseBuilder.success(dashboardData, { requestId: (request as any).id })
    );
  }

  /**
   * Record business metric
   */
  async recordBusinessMetric(
    request: FastifyRequest<{ Body: BusinessMetricInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const metric = await this.analyticsService.recordBusinessMetric(
      request.body
    );

    reply
      .status(HTTP_STATUS.CREATED)
      .send(
        ResponseBuilder.success(metric, { requestId: (request as any).id })
      );
  }

  /**
   * Get business metrics
   */
  async getBusinessMetrics(
    request: FastifyRequest<{
      Querystring: {
        period?: string;
        segment?: string;
        metricType?: string;
        limit?: number;
        offset?: number;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const {
      period,
      segment,
      metricType,
      limit = 100,
      offset = 0,
    } = request.query;

    const filters: any = {};
    if (period) filters.period = period;
    if (segment) filters.segment = segment;
    if (metricType) filters.metricType = metricType;

    const metrics = await this.analyticsService.getBusinessMetrics(
      filters,
      limit,
      offset
    );

    reply.send(
      ResponseBuilder.success(
        { metrics, count: metrics.length },
        { requestId: (request as any).id }
      )
    );
  }

  /**
   * Get user events
   */
  async getUserEvents(
    request: FastifyRequest<{
      Params: { userId: string };
      Querystring: { limit?: number; offset?: number };
    }> &
      AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    const { userId } = request.params;
    const { limit = 50, offset = 0 } = request.query;

    // Verify user has permission to view these events
    if (request.userId !== userId && request.user?.role !== "admin") {
      throw new AppError(
        "Insufficient permissions",
        403,
        "INSUFFICIENT_PERMISSIONS"
      );
    }

    const events = await this.analyticsService.getUserEvents(
      userId,
      limit,
      offset
    );

    reply.send(
      ResponseBuilder.success(
        { events, count: events.length },
        { requestId: (request as any).id }
      )
    );
  }

  /**
   * Get session events
   */
  async getSessionEvents(
    request: FastifyRequest<{
      Params: { sessionId: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const { sessionId } = request.params;

    const events = await this.analyticsService.getSessionEvents(sessionId);

    reply.send(
      ResponseBuilder.success(
        { events, count: events.length },
        { requestId: (request as any).id }
      )
    );
  }

  /**
   * Get user behavior statistics
   */
  async getUserBehaviorStats(
    request: FastifyRequest<{
      Params: { userId: string };
      Querystring: {
        startDate: string;
        endDate: string;
      };
    }> &
      AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    const { userId } = request.params;
    const { startDate, endDate } = request.query;

    // Verify user has permission to view these stats
    if (request.userId !== userId && request.user?.role !== "admin") {
      throw new AppError(
        "Insufficient permissions",
        403,
        "INSUFFICIENT_PERMISSIONS"
      );
    }

    if (!startDate || !endDate) {
      throw new AppError(
        "Start date and end date are required",
        400,
        "MISSING_DATE_RANGE"
      );
    }

    const dateRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };

    const stats = await this.analyticsService.getUserBehaviorStats(
      userId,
      dateRange
    );

    reply.send(
      ResponseBuilder.success(stats, { requestId: (request as any).id })
    );
  }

  /**
   * Get product analytics
   */
  async getProductAnalytics(
    request: FastifyRequest<{
      Params: { productId: string };
      Querystring: { period?: string; limit?: number };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const { productId } = request.params;
    const { period = "daily", limit = 30 } = request.query;

    const analytics = await this.analyticsService.getProductAnalytics(
      productId,
      period,
      limit
    );

    reply.send(
      ResponseBuilder.success(
        { analytics, count: analytics.length },
        { requestId: (request as any).id }
      )
    );
  }

  /**
   * Get top performing products
   */
  async getTopPerformingProducts(
    request: FastifyRequest<{
      Querystring: {
        startDate: string;
        endDate: string;
        limit?: number;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const { startDate, endDate, limit = 10 } = request.query;

    if (!startDate || !endDate) {
      throw new AppError(
        "Start date and end date are required",
        400,
        "MISSING_DATE_RANGE"
      );
    }

    const dateRange = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };

    const topProducts = await this.analyticsService.getTopPerformingProducts(
      dateRange,
      limit
    );

    reply.send(
      ResponseBuilder.success(
        { products: topProducts, count: topProducts.length },
        { requestId: (request as any).id }
      )
    );
  }

  /**
   * Clean up old analytics data (admin only)
   */
  async cleanupOldData(
    request: FastifyRequest<{
      Body: { retentionDays?: number };
    }> &
      AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Verify admin permissions
    if (request.user?.role !== "admin") {
      throw new AppError("Admin permissions required", 403, "ADMIN_ONLY");
    }

    const { retentionDays = 365 } = request.body;

    const result = await this.analyticsService.cleanupOldData(retentionDays);

    reply.send(
      ResponseBuilder.success(result, { requestId: (request as any).id })
    );
  }
}

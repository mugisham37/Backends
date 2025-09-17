/**
 * Analytics Service
 * Handles analytics data collection, processing, and reporting
 */

import {
  AnalyticsRepository,
  type AnalyticsDateRange,
  type EventFilters,
  type MetricFilters,
  type AnalyticsSummary,
} from "../../core/repositories/analytics.repository.js";
import {
  type AnalyticsEvent,
  type NewAnalyticsEvent,
  type BusinessMetric,
  type NewBusinessMetric,
  type UserBehaviorAnalytics,
  type NewUserBehaviorAnalytics,
  type ProductAnalytics,
  type NewProductAnalytics,
} from "../../core/database/schema/analytics.js";
import { AppError } from "../../core/errors/app-error.js";

export interface EventTrackingInput {
  eventType: string;
  eventName: string;
  eventCategory?: string;
  userId?: string;
  sessionId?: string;
  visitorId?: string;
  properties?: Record<string, any>;
  value?: number;
  quantity?: number;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}

export interface BusinessMetricInput {
  metricName: string;
  metricType: string;
  period: string;
  periodStart: Date;
  periodEnd: Date;
  value: number;
  previousValue?: number;
  currency?: string;
  segment?: string;
  metadata?: Record<string, any>;
}

export interface AnalyticsDashboardData {
  summary: AnalyticsSummary;
  revenueMetrics: BusinessMetric[];
  conversionMetrics: BusinessMetric[];
  topProducts: Array<{
    productId: string;
    totalViews: number;
    totalRevenue: number;
    conversionRate: number;
  }>;
  userBehaviorTrends: Array<{
    date: string;
    sessions: number;
    pageViews: number;
    bounceRate: number;
  }>;
}

export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  /**
   * Track a new analytics event
   */
  async trackEvent(input: EventTrackingInput): Promise<AnalyticsEvent> {
    try {
      // Enrich event data with additional context
      const eventData: NewAnalyticsEvent = {
        eventType: input.eventType as any,
        eventName: input.eventName,
        eventCategory: input.eventCategory,
        userId: input.userId,
        sessionId: input.sessionId,
        visitorId: input.visitorId,
        properties: input.properties,
        value: input.value?.toString(),
        quantity: input.quantity,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        referrer: input.referrer,
        utm: input.utm,
        timestamp: new Date(),
      };

      // Parse user agent for device/browser info if provided
      if (input.userAgent) {
        const parsedUA = this.parseUserAgent(input.userAgent);
        eventData.device = parsedUA.device;
        eventData.browser = parsedUA.browser;
        eventData.os = parsedUA.os;
      }

      // Track IP geolocation if needed (placeholder for now)
      if (input.ipAddress) {
        const geoData = await this.getGeolocation(input.ipAddress);
        eventData.country = geoData.country;
        eventData.region = geoData.region;
        eventData.city = geoData.city;
      }

      return await this.analyticsRepository.createEvent(eventData);
    } catch (error) {
      throw new AppError(
        "Failed to track analytics event",
        500,
        "ANALYTICS_TRACKING_ERROR",
        { originalError: error }
      );
    }
  }

  /**
   * Track multiple events in batch
   */
  async trackEventsBatch(
    inputs: EventTrackingInput[]
  ): Promise<AnalyticsEvent[]> {
    try {
      const eventsData: NewAnalyticsEvent[] = await Promise.all(
        inputs.map(async (input) => {
          const eventData: NewAnalyticsEvent = {
            eventType: input.eventType as any,
            eventName: input.eventName,
            eventCategory: input.eventCategory,
            userId: input.userId,
            sessionId: input.sessionId,
            visitorId: input.visitorId,
            properties: input.properties,
            value: input.value?.toString(),
            quantity: input.quantity,
            userAgent: input.userAgent,
            ipAddress: input.ipAddress,
            referrer: input.referrer,
            utm: input.utm,
            timestamp: new Date(),
          };

          if (input.userAgent) {
            const parsedUA = this.parseUserAgent(input.userAgent);
            eventData.device = parsedUA.device;
            eventData.browser = parsedUA.browser;
            eventData.os = parsedUA.os;
          }

          return eventData;
        })
      );

      return await this.analyticsRepository.createEventsBatch(eventsData);
    } catch (error) {
      throw new AppError(
        "Failed to track analytics events batch",
        500,
        "ANALYTICS_BATCH_TRACKING_ERROR",
        { originalError: error }
      );
    }
  }

  /**
   * Get events with filters
   */
  async getEvents(
    filters: EventFilters = {},
    limit = 100,
    offset = 0
  ): Promise<AnalyticsEvent[]> {
    return await this.analyticsRepository.getEvents(filters, limit, offset);
  }

  /**
   * Get events for a specific user
   */
  async getUserEvents(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<AnalyticsEvent[]> {
    return await this.analyticsRepository.getEventsByUser(
      userId,
      limit,
      offset
    );
  }

  /**
   * Get events for a specific session
   */
  async getSessionEvents(sessionId: string): Promise<AnalyticsEvent[]> {
    return await this.analyticsRepository.getEventsBySession(sessionId);
  }

  /**
   * Get analytics summary for a date range
   */
  async getAnalyticsSummary(
    dateRange: AnalyticsDateRange
  ): Promise<AnalyticsSummary> {
    return await this.analyticsRepository.getAnalyticsSummary(dateRange);
  }

  /**
   * Create or update business metric
   */
  async recordBusinessMetric(
    input: BusinessMetricInput
  ): Promise<BusinessMetric> {
    try {
      // Check if metric already exists for this period
      const existing = await this.analyticsRepository.getMetricByNameAndPeriod(
        input.metricName,
        input.period,
        input.periodStart
      );

      if (existing) {
        // Update existing metric
        const updatedData: Partial<NewBusinessMetric> = {
          value: input.value.toString(),
          previousValue: input.previousValue?.toString(),
          percentageChange: input.previousValue
            ? (
                ((input.value - input.previousValue) / input.previousValue) *
                100
              ).toString()
            : undefined,
          currency: input.currency,
          segment: input.segment,
          metadata: input.metadata,
        };

        const updated = await this.analyticsRepository.updateBusinessMetric(
          existing.id,
          updatedData
        );

        if (!updated) {
          throw new AppError(
            "Failed to update business metric",
            500,
            "METRIC_UPDATE_ERROR"
          );
        }

        return updated;
      } else {
        // Create new metric
        const metricData: NewBusinessMetric = {
          metricName: input.metricName,
          metricType: input.metricType,
          period: input.period,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          value: input.value.toString(),
          previousValue: input.previousValue?.toString(),
          percentageChange: input.previousValue
            ? (
                ((input.value - input.previousValue) / input.previousValue) *
                100
              ).toString()
            : undefined,
          currency: input.currency || "USD",
          segment: input.segment,
          metadata: input.metadata,
        };

        return await this.analyticsRepository.createBusinessMetric(metricData);
      }
    } catch (error) {
      throw new AppError(
        "Failed to record business metric",
        500,
        "BUSINESS_METRIC_ERROR",
        { originalError: error }
      );
    }
  }

  /**
   * Get business metrics with filters
   */
  async getBusinessMetrics(
    filters: MetricFilters = {},
    limit = 100,
    offset = 0
  ): Promise<BusinessMetric[]> {
    return await this.analyticsRepository.getBusinessMetrics(
      filters,
      limit,
      offset
    );
  }

  /**
   * Track user behavior for a session
   */
  async trackUserBehavior(
    sessionId: string,
    data: Partial<NewUserBehaviorAnalytics>
  ): Promise<UserBehaviorAnalytics> {
    try {
      // Check if behavior record already exists for this session
      const existing = await this.analyticsRepository.getUserBehaviorBySession(
        sessionId
      );

      if (existing) {
        // Update existing record
        const updated = await this.analyticsRepository.updateUserBehavior(
          sessionId,
          data
        );

        if (!updated) {
          throw new AppError(
            "Failed to update user behavior",
            500,
            "BEHAVIOR_UPDATE_ERROR"
          );
        }

        return updated;
      } else {
        // Create new behavior record
        const behaviorData: NewUserBehaviorAnalytics = {
          sessionId,
          sessionStart: new Date(),
          ...data,
        };

        return await this.analyticsRepository.createUserBehavior(behaviorData);
      }
    } catch (error) {
      throw new AppError(
        "Failed to track user behavior",
        500,
        "USER_BEHAVIOR_ERROR",
        { originalError: error }
      );
    }
  }

  /**
   * Get user behavior statistics
   */
  async getUserBehaviorStats(
    userId: string,
    dateRange: AnalyticsDateRange
  ): Promise<{
    totalSessions: number;
    averageSessionDuration: number;
    totalPageViews: number;
    averageBounceRate: number;
  }> {
    return await this.analyticsRepository.getUserBehaviorStats(
      userId,
      dateRange
    );
  }

  /**
   * Track product analytics
   */
  async trackProductAnalytics(
    productId: string,
    data: Partial<NewProductAnalytics>
  ): Promise<ProductAnalytics> {
    try {
      const date = new Date();
      const period = "daily";

      // Check if analytics record exists for today
      const existing = await this.analyticsRepository.updateProductAnalytics(
        productId,
        date,
        period,
        data
      );

      if (existing) {
        return existing;
      }

      // Create new analytics record
      const analyticsData: NewProductAnalytics = {
        productId,
        date,
        period,
        ...data,
      };

      return await this.analyticsRepository.createProductAnalytics(
        analyticsData
      );
    } catch (error) {
      throw new AppError(
        "Failed to track product analytics",
        500,
        "PRODUCT_ANALYTICS_ERROR",
        { originalError: error }
      );
    }
  }

  /**
   * Get product analytics
   */
  async getProductAnalytics(
    productId: string,
    period = "daily",
    limit = 30
  ): Promise<ProductAnalytics[]> {
    return await this.analyticsRepository.getProductAnalytics(
      productId,
      period,
      limit
    );
  }

  /**
   * Get top performing products
   */
  async getTopPerformingProducts(
    dateRange: AnalyticsDateRange,
    limit = 10
  ): Promise<
    Array<{
      productId: string;
      totalViews: number;
      totalRevenue: number;
      conversionRate: number;
    }>
  > {
    return await this.analyticsRepository.getTopPerformingProducts(
      dateRange,
      limit
    );
  }

  /**
   * Get comprehensive analytics dashboard data
   */
  async getDashboardData(
    dateRange: AnalyticsDateRange
  ): Promise<AnalyticsDashboardData> {
    try {
      const [summary, revenueMetrics, conversionMetrics, topProducts] =
        await Promise.all([
          this.getAnalyticsSummary(dateRange),
          this.getBusinessMetrics({ metricType: "revenue" }, 10),
          this.getBusinessMetrics({ metricType: "conversion" }, 10),
          this.getTopPerformingProducts(dateRange, 10),
        ]);

      // Generate user behavior trends (placeholder - would need more complex aggregation)
      const userBehaviorTrends: Array<{
        date: string;
        sessions: number;
        pageViews: number;
        bounceRate: number;
      }> = []; // Implement based on your needs

      return {
        summary,
        revenueMetrics,
        conversionMetrics,
        topProducts,
        userBehaviorTrends,
      };
    } catch (error) {
      throw new AppError(
        "Failed to get dashboard data",
        500,
        "DASHBOARD_DATA_ERROR",
        { originalError: error }
      );
    }
  }

  /**
   * Clean up old analytics data
   */
  async cleanupOldData(retentionDays = 365): Promise<{
    deletedEvents: number;
    deletedBehaviorRecords: number;
  }> {
    try {
      const [deletedEvents, deletedBehaviorRecords] = await Promise.all([
        this.analyticsRepository.deleteOldEvents(retentionDays),
        this.analyticsRepository.deleteOldUserBehavior(retentionDays),
      ]);

      return {
        deletedEvents,
        deletedBehaviorRecords,
      };
    } catch (error) {
      throw new AppError(
        "Failed to cleanup old analytics data",
        500,
        "CLEANUP_ERROR",
        { originalError: error }
      );
    }
  }

  /**
   * Parse user agent string (basic implementation)
   */
  private parseUserAgent(userAgent: string): {
    device: string;
    browser: string;
    os: string;
  } {
    // Basic user agent parsing - in production, use a library like ua-parser-js
    const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
    const device = isMobile ? "mobile" : "desktop";

    let browser = "unknown";
    if (userAgent.includes("Chrome")) browser = "chrome";
    else if (userAgent.includes("Firefox")) browser = "firefox";
    else if (userAgent.includes("Safari")) browser = "safari";
    else if (userAgent.includes("Edge")) browser = "edge";

    let os = "unknown";
    if (userAgent.includes("Windows")) os = "windows";
    else if (userAgent.includes("Mac")) os = "macos";
    else if (userAgent.includes("Linux")) os = "linux";
    else if (userAgent.includes("Android")) os = "android";
    else if (userAgent.includes("iOS")) os = "ios";

    return { device, browser, os };
  }

  /**
   * Get geolocation from IP address (placeholder)
   */
  private async getGeolocation(ipAddress: string): Promise<{
    country: string;
    region: string;
    city: string;
  }> {
    // Placeholder - in production, integrate with IP geolocation service
    return {
      country: "US",
      region: "Unknown",
      city: "Unknown",
    };
  }
}

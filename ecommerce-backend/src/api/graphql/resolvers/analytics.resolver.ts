/**
 * Analytics GraphQL Resolvers
 * Implements GraphQL operations for analytics functionality
 */

import { AnalyticsService } from "../../../modules/analytics/analytics.service.js";
import { AnalyticsRepository } from "../../../core/repositories/analytics.repository.js";
import { AppError } from "../../../core/errors/app-error.js";
import { db } from "../../../core/database/connection.js";

// Initialize services
const analyticsRepository = new AnalyticsRepository(db);
const analyticsService = new AnalyticsService(analyticsRepository);

export const analyticsResolvers = {
  Query: {
    // Analytics Events
    analyticsEvents: async (_: any, args: any, context: any) => {
      const { filters = {}, first = 100, after } = args;
      const offset = after
        ? parseInt(Buffer.from(after, "base64").toString())
        : 0;

      // Add user filtering based on role
      if (context.user?.role !== "admin") {
        filters.userId = context.user?.id;
      }

      const events = await analyticsService.getEvents(filters, first, offset);

      return {
        edges: events.map((event: any, index: number) => ({
          node: event,
          cursor: Buffer.from(`${offset + index}`).toString("base64"),
        })),
        pageInfo: {
          hasNextPage: events.length === first,
          hasPreviousPage: offset > 0,
          startCursor:
            events.length > 0
              ? Buffer.from(`${offset}`).toString("base64")
              : null,
          endCursor:
            events.length > 0
              ? Buffer.from(`${offset + events.length - 1}`).toString("base64")
              : null,
        },
        totalCount: events.length,
      };
    },

    // Business Metrics
    businessMetrics: async (_: any, args: any, context: any) => {
      const { filters = {}, first = 100, after } = args;
      const offset = after
        ? parseInt(Buffer.from(after, "base64").toString())
        : 0;

      const metrics = await analyticsService.getBusinessMetrics(
        filters,
        first,
        offset
      );

      return {
        edges: metrics.map((metric: any, index: number) => ({
          node: metric,
          cursor: Buffer.from(`${offset + index}`).toString("base64"),
        })),
        pageInfo: {
          hasNextPage: metrics.length === first,
          hasPreviousPage: offset > 0,
          startCursor:
            metrics.length > 0
              ? Buffer.from(`${offset}`).toString("base64")
              : null,
          endCursor:
            metrics.length > 0
              ? Buffer.from(`${offset + metrics.length - 1}`).toString("base64")
              : null,
        },
        totalCount: metrics.length,
      };
    },

    // Dashboard and Reports
    dashboardStats: async (_: any, args: any, context: any) => {
      const { dateRange, dateRangePreset, vendorId, categoryId } = args;

      // Vendor users can only see their own stats
      const finalVendorId =
        context.user?.role === "vendor" ? context.user.id : vendorId;

      return await analyticsService.getDashboardData(dateRangePreset || "week");
    },

    // Product Analytics
    productAnalytics: async (_: any, args: any, context: any) => {
      const { filters = {}, first = 100, after } = args;
      const offset = after
        ? parseInt(Buffer.from(after, "base64").toString())
        : 0;

      const analytics = await analyticsService.getProductAnalytics(
        filters,
        first,
        offset
      );

      return {
        edges: analytics.map((analytic: any, index: number) => ({
          node: analytic,
          cursor: Buffer.from(`${offset + index}`).toString("base64"),
        })),
        pageInfo: {
          hasNextPage: analytics.length === first,
          hasPreviousPage: offset > 0,
          startCursor:
            analytics.length > 0
              ? Buffer.from(`${offset}`).toString("base64")
              : null,
          endCursor:
            analytics.length > 0
              ? Buffer.from(`${offset + analytics.length - 1}`).toString(
                  "base64"
                )
              : null,
        },
        totalCount: analytics.length,
      };
    },
  },

  Mutation: {
    // Track analytics events
    trackEvent: async (_: any, { input }: any, context: any) => {
      // Add user context to the event
      const eventData = {
        ...input,
        userId: input.userId || context.user?.id,
      };

      return await analyticsService.trackEvent(eventData);
    },

    trackEvents: async (_: any, { inputs }: any, context: any) => {
      // Add user context to all events
      const eventsData = inputs.map((input: any) => ({
        ...input,
        userId: input.userId || context.user?.id,
      }));

      return await analyticsService.trackEventsBatch(eventsData);
    },

    // Record business metrics
    recordBusinessMetric: async (_: any, { input }: any) => {
      return await analyticsService.recordBusinessMetric(input);
    },

    // Cleanup old data (admin only)
    cleanupAnalyticsData: async (
      _: any,
      { retentionDays }: any,
      context: any
    ) => {
      if (context.user?.role !== "admin") {
        throw new AppError("Admin permissions required", 403, "ADMIN_ONLY");
      }

      const result = await analyticsService.cleanupOldData(
        retentionDays || 365
      );
      return result.deletedEvents > 0 || result.deletedBehaviorRecords > 0;
    },
  },

  // Type resolvers
  AnalyticsEvent: {
    id: (parent: any) => parent.id,
    eventType: (parent: any) => parent.eventType,
    userId: (parent: any) => parent.userId,
    sessionId: (parent: any) => parent.sessionId,
    userAgent: (parent: any) => parent.userAgent,
    ipAddress: (parent: any) => parent.ipAddress,
    referrer: (parent: any) => parent.referrer,
    page: (parent: any) => parent.page,
    eventData: (parent: any) => parent.eventData,
    metadata: (parent: any) => parent.metadata,
    createdAt: (parent: any) => parent.createdAt,
    updatedAt: (parent: any) => parent.updatedAt,
  },

  BusinessMetric: {
    id: (parent: any) => parent.id,
    metricType: (parent: any) => parent.metricType,
    metricValue: (parent: any) => parent.metricValue,
    dimensions: (parent: any) => parent.dimensions,
    metadata: (parent: any) => parent.metadata,
    recordedAt: (parent: any) => parent.recordedAt,
    createdAt: (parent: any) => parent.createdAt,
    updatedAt: (parent: any) => parent.updatedAt,
  },

  UserBehavior: {
    id: (parent: any) => parent.id,
    userId: (parent: any) => parent.userId,
    sessionId: (parent: any) => parent.sessionId,
    page: (parent: any) => parent.page,
    action: (parent: any) => parent.action,
    elementId: (parent: any) => parent.elementId,
    behaviorData: (parent: any) => parent.behaviorData,
    metadata: (parent: any) => parent.metadata,
    createdAt: (parent: any) => parent.createdAt,
    updatedAt: (parent: any) => parent.updatedAt,
  },

  ProductAnalytics: {
    id: (parent: any) => parent.id,
    productId: (parent: any) => parent.productId,
    action: (parent: any) => parent.action,
    userId: (parent: any) => parent.userId,
    quantity: (parent: any) => parent.quantity,
    revenue: (parent: any) => parent.revenue,
    categoryId: (parent: any) => parent.categoryId,
    vendorId: (parent: any) => parent.vendorId,
    analyticsData: (parent: any) => parent.analyticsData,
    metadata: (parent: any) => parent.metadata,
    createdAt: (parent: any) => parent.createdAt,
    updatedAt: (parent: any) => parent.updatedAt,
  },
};

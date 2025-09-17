/**
 * Analytics Repository
 * Handles all database operations for analytics data
 */

import { BaseRepository } from "./base.repository.js";
import { and, desc, eq, gte, lte, sql, count, avg, sum } from "drizzle-orm";
import {
  analyticsEvents,
  businessMetrics,
  userBehaviorAnalytics,
  productAnalytics,
  type AnalyticsEvent,
  type NewAnalyticsEvent,
  type BusinessMetric,
  type NewBusinessMetric,
  type UserBehaviorAnalytics,
  type NewUserBehaviorAnalytics,
  type ProductAnalytics,
  type NewProductAnalytics,
} from "../database/schema/analytics.js";
import type { DrizzleDB } from "../database/connection.js";

export interface AnalyticsDateRange {
  startDate: Date;
  endDate: Date;
}

export interface MetricFilters {
  period?: string;
  segment?: string;
  metricType?: string;
}

export interface EventFilters {
  eventType?: string;
  eventCategory?: string;
  userId?: string;
  sessionId?: string;
  dateRange?: AnalyticsDateRange;
}

export interface AnalyticsSummary {
  totalEvents: number;
  uniqueUsers: number;
  uniqueSessions: number;
  averageSessionDuration: number;
  topEvents: Array<{
    eventName: string;
    count: number;
  }>;
}

export class AnalyticsRepository extends BaseRepository<any, any, any> {
  protected table = analyticsEvents;
  protected idColumn = analyticsEvents.id;
  protected tableName = "analytics_events";

  constructor(db: DrizzleDB) {
    super(db);
  }

  // Analytics Events Operations
  async createEvent(data: NewAnalyticsEvent): Promise<AnalyticsEvent> {
    const [event] = await this.db
      .insert(analyticsEvents)
      .values(data)
      .returning();
    return event;
  }

  async createEventsBatch(
    data: NewAnalyticsEvent[]
  ): Promise<AnalyticsEvent[]> {
    return await this.db.insert(analyticsEvents).values(data).returning();
  }

  async getEvents(
    filters: EventFilters = {},
    limit = 100,
    offset = 0
  ): Promise<AnalyticsEvent[]> {
    const conditions = [];

    if (filters.eventType) {
      conditions.push(eq(analyticsEvents.eventType, filters.eventType as any));
    }
    if (filters.eventCategory) {
      conditions.push(eq(analyticsEvents.eventCategory, filters.eventCategory));
    }
    if (filters.userId) {
      conditions.push(eq(analyticsEvents.userId, filters.userId));
    }
    if (filters.sessionId) {
      conditions.push(eq(analyticsEvents.sessionId, filters.sessionId));
    }
    if (filters.dateRange) {
      conditions.push(
        and(
          gte(analyticsEvents.timestamp, filters.dateRange.startDate),
          lte(analyticsEvents.timestamp, filters.dateRange.endDate)
        )
      );
    }

    return await this.db
      .select()
      .from(analyticsEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(analyticsEvents.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async getEventsByUser(
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<AnalyticsEvent[]> {
    return await this.db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.userId, userId))
      .orderBy(desc(analyticsEvents.timestamp))
      .limit(limit)
      .offset(offset);
  }

  async getEventsBySession(sessionId: string): Promise<AnalyticsEvent[]> {
    return await this.db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.sessionId, sessionId))
      .orderBy(analyticsEvents.timestamp);
  }

  async getAnalyticsSummary(
    dateRange: AnalyticsDateRange
  ): Promise<AnalyticsSummary> {
    const [eventStats] = await this.db
      .select({
        totalEvents: count(),
        uniqueUsers: sql<number>`COUNT(DISTINCT ${analyticsEvents.userId})`,
        uniqueSessions: sql<number>`COUNT(DISTINCT ${analyticsEvents.sessionId})`,
      })
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.timestamp, dateRange.startDate),
          lte(analyticsEvents.timestamp, dateRange.endDate)
        )
      );

    const topEvents = await this.db
      .select({
        eventName: analyticsEvents.eventName,
        count: count(),
      })
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.timestamp, dateRange.startDate),
          lte(analyticsEvents.timestamp, dateRange.endDate)
        )
      )
      .groupBy(analyticsEvents.eventName)
      .orderBy(desc(count()))
      .limit(10);

    // Calculate average session duration from user behavior analytics
    const [sessionDurationStats] = await this.db
      .select({
        averageSessionDuration: avg(userBehaviorAnalytics.sessionDuration),
      })
      .from(userBehaviorAnalytics)
      .where(
        and(
          gte(userBehaviorAnalytics.sessionStart, dateRange.startDate),
          lte(userBehaviorAnalytics.sessionStart, dateRange.endDate)
        )
      );

    return {
      totalEvents: eventStats.totalEvents,
      uniqueUsers: eventStats.uniqueUsers,
      uniqueSessions: eventStats.uniqueSessions,
      averageSessionDuration:
        Number(sessionDurationStats.averageSessionDuration) || 0,
      topEvents,
    };
  }

  // Business Metrics Operations
  async createBusinessMetric(data: NewBusinessMetric): Promise<BusinessMetric> {
    const [metric] = await this.db
      .insert(businessMetrics)
      .values(data)
      .returning();
    return metric;
  }

  async getBusinessMetrics(
    filters: MetricFilters = {},
    limit = 100,
    offset = 0
  ): Promise<BusinessMetric[]> {
    const conditions = [];

    if (filters.period) {
      conditions.push(eq(businessMetrics.period, filters.period));
    }
    if (filters.segment) {
      conditions.push(eq(businessMetrics.segment, filters.segment));
    }
    if (filters.metricType) {
      conditions.push(eq(businessMetrics.metricType, filters.metricType));
    }

    return await this.db
      .select()
      .from(businessMetrics)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(businessMetrics.periodStart))
      .limit(limit)
      .offset(offset);
  }

  async getMetricByNameAndPeriod(
    metricName: string,
    period: string,
    periodStart: Date
  ): Promise<BusinessMetric | undefined> {
    const [metric] = await this.db
      .select()
      .from(businessMetrics)
      .where(
        and(
          eq(businessMetrics.metricName, metricName),
          eq(businessMetrics.period, period),
          eq(businessMetrics.periodStart, periodStart)
        )
      )
      .limit(1);

    return metric;
  }

  async updateBusinessMetric(
    id: string,
    data: Partial<NewBusinessMetric>
  ): Promise<BusinessMetric | undefined> {
    const [updated] = await this.db
      .update(businessMetrics)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(businessMetrics.id, id))
      .returning();

    return updated;
  }

  // User Behavior Analytics Operations
  async createUserBehavior(
    data: NewUserBehaviorAnalytics
  ): Promise<UserBehaviorAnalytics> {
    const [behavior] = await this.db
      .insert(userBehaviorAnalytics)
      .values(data)
      .returning();
    return behavior;
  }

  async getUserBehaviorBySession(
    sessionId: string
  ): Promise<UserBehaviorAnalytics | undefined> {
    const [behavior] = await this.db
      .select()
      .from(userBehaviorAnalytics)
      .where(eq(userBehaviorAnalytics.sessionId, sessionId))
      .limit(1);

    return behavior;
  }

  async updateUserBehavior(
    sessionId: string,
    data: Partial<NewUserBehaviorAnalytics>
  ): Promise<UserBehaviorAnalytics | undefined> {
    const [updated] = await this.db
      .update(userBehaviorAnalytics)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userBehaviorAnalytics.sessionId, sessionId))
      .returning();

    return updated;
  }

  async getUserBehaviorStats(
    userId: string,
    dateRange: AnalyticsDateRange
  ): Promise<{
    totalSessions: number;
    averageSessionDuration: number;
    totalPageViews: number;
    averageBounceRate: number;
  }> {
    const [stats] = await this.db
      .select({
        totalSessions: count(),
        averageSessionDuration: avg(userBehaviorAnalytics.sessionDuration),
        totalPageViews: sum(userBehaviorAnalytics.pageViews),
        averageBounceRate: avg(userBehaviorAnalytics.bounceRate),
      })
      .from(userBehaviorAnalytics)
      .where(
        and(
          eq(userBehaviorAnalytics.userId, userId),
          gte(userBehaviorAnalytics.sessionStart, dateRange.startDate),
          lte(userBehaviorAnalytics.sessionStart, dateRange.endDate)
        )
      );

    return {
      totalSessions: stats.totalSessions,
      averageSessionDuration: Number(stats.averageSessionDuration) || 0,
      totalPageViews: Number(stats.totalPageViews) || 0,
      averageBounceRate: Number(stats.averageBounceRate) || 0,
    };
  }

  // Product Analytics Operations
  async createProductAnalytics(
    data: NewProductAnalytics
  ): Promise<ProductAnalytics> {
    const [analytics] = await this.db
      .insert(productAnalytics)
      .values(data)
      .returning();
    return analytics;
  }

  async getProductAnalytics(
    productId: string,
    period: string = "daily",
    limit = 30
  ): Promise<ProductAnalytics[]> {
    return await this.db
      .select()
      .from(productAnalytics)
      .where(
        and(
          eq(productAnalytics.productId, productId),
          eq(productAnalytics.period, period)
        )
      )
      .orderBy(desc(productAnalytics.date))
      .limit(limit);
  }

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
    const results = await this.db
      .select({
        productId: productAnalytics.productId,
        totalViews: sum(productAnalytics.views),
        totalRevenue: sum(productAnalytics.revenue),
        conversionRate: avg(productAnalytics.conversionRate),
      })
      .from(productAnalytics)
      .where(
        and(
          gte(productAnalytics.date, dateRange.startDate),
          lte(productAnalytics.date, dateRange.endDate)
        )
      )
      .groupBy(productAnalytics.productId)
      .orderBy(desc(sum(productAnalytics.revenue)))
      .limit(limit);

    return results.map((result) => ({
      productId: result.productId,
      totalViews: Number(result.totalViews) || 0,
      totalRevenue: Number(result.totalRevenue) || 0,
      conversionRate: Number(result.conversionRate) || 0,
    }));
  }

  async updateProductAnalytics(
    productId: string,
    date: Date,
    period: string,
    data: Partial<NewProductAnalytics>
  ): Promise<ProductAnalytics | undefined> {
    const [updated] = await this.db
      .update(productAnalytics)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(productAnalytics.productId, productId),
          eq(productAnalytics.date, date),
          eq(productAnalytics.period, period)
        )
      )
      .returning();

    return updated;
  }

  // Cleanup operations
  async deleteOldEvents(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.db
      .delete(analyticsEvents)
      .where(lte(analyticsEvents.timestamp, cutoffDate));

    return result.length;
  }

  async deleteOldUserBehavior(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.db
      .delete(userBehaviorAnalytics)
      .where(lte(userBehaviorAnalytics.sessionStart, cutoffDate));

    return result.length;
  }
}

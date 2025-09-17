/**
 * Webhook Repository
 * Handles all database operations for webhook data
 */

import {
  and,
  desc,
  eq,
  gte,
  lte,
  sql,
  count,
  inArray,
  or,
  isNull,
} from "drizzle-orm";
import {
  webhookEndpoints,
  webhookEvents,
  webhookDeliveries,
  webhookSubscriptions,
  webhookLogs,
  type WebhookEndpoint,
  type NewWebhookEndpoint,
  type WebhookEvent,
  type NewWebhookEvent,
  type WebhookDelivery,
  type NewWebhookDelivery,
  type WebhookSubscription,
  type NewWebhookSubscription,
  type WebhookLog,
  type NewWebhookLog,
} from "../database/schema/webhooks.js";
import type { DrizzleDB } from "../database/connection.js";

export interface WebhookEndpointFilters {
  status?: string;
  userId?: string;
  vendorId?: string;
  eventTypes?: string[];
  isActive?: boolean;
}

export interface WebhookEventFilters {
  eventType?: string;
  sourceType?: string;
  userId?: string;
  vendorId?: string;
  isProcessed?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface WebhookDeliveryFilters {
  webhookEndpointId?: string;
  deliveryStatus?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface WebhookStats {
  totalEndpoints: number;
  activeEndpoints: number;
  totalEvents: number;
  pendingEvents: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageResponseTime: number;
}

export class WebhookRepository {
  constructor(private readonly db: DrizzleDB) {}

  // Webhook Endpoints Operations
  async createEndpoint(data: NewWebhookEndpoint): Promise<WebhookEndpoint> {
    const [endpoint] = await this.db
      .insert(webhookEndpoints)
      .values(data)
      .returning();
    return endpoint;
  }

  async getEndpoints(
    filters: WebhookEndpointFilters = {},
    limit = 100,
    offset = 0
  ): Promise<WebhookEndpoint[]> {
    const conditions = [];

    if (filters.status) {
      conditions.push(eq(webhookEndpoints.status, filters.status as any));
    }
    if (filters.userId) {
      conditions.push(eq(webhookEndpoints.userId, filters.userId));
    }
    if (filters.vendorId) {
      conditions.push(eq(webhookEndpoints.vendorId, filters.vendorId));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(webhookEndpoints.isActive, filters.isActive));
    }
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      // Filter by event types (using JSON contains)
      conditions.push(
        sql`${webhookEndpoints.eventTypes} @> ${JSON.stringify(
          filters.eventTypes
        )}`
      );
    }

    return await this.db
      .select()
      .from(webhookEndpoints)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(webhookEndpoints.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getEndpointById(id: string): Promise<WebhookEndpoint | undefined> {
    const [endpoint] = await this.db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.id, id))
      .limit(1);

    return endpoint;
  }

  async getEndpointsByEventType(eventType: string): Promise<WebhookEndpoint[]> {
    return await this.db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.isActive, true),
          eq(webhookEndpoints.status, "active"),
          sql`${webhookEndpoints.eventTypes} @> ${JSON.stringify([eventType])}`
        )
      );
  }

  async updateEndpoint(
    id: string,
    data: Partial<NewWebhookEndpoint>
  ): Promise<WebhookEndpoint | undefined> {
    const [updated] = await this.db
      .update(webhookEndpoints)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(webhookEndpoints.id, id))
      .returning();

    return updated;
  }

  async deleteEndpoint(id: string): Promise<boolean> {
    const result = await this.db
      .delete(webhookEndpoints)
      .where(eq(webhookEndpoints.id, id))
      .returning({ id: webhookEndpoints.id });

    return result.length > 0;
  }

  async updateEndpointStats(
    id: string,
    isSuccess: boolean,
    timestamp: Date = new Date()
  ): Promise<void> {
    if (isSuccess) {
      await this.db
        .update(webhookEndpoints)
        .set({
          totalDeliveries: sql`${webhookEndpoints.totalDeliveries} + 1`,
          successfulDeliveries: sql`${webhookEndpoints.successfulDeliveries} + 1`,
          lastSuccessAt: timestamp,
          updatedAt: new Date(),
        })
        .where(eq(webhookEndpoints.id, id));
    } else {
      await this.db
        .update(webhookEndpoints)
        .set({
          totalDeliveries: sql`${webhookEndpoints.totalDeliveries} + 1`,
          failedDeliveries: sql`${webhookEndpoints.failedDeliveries} + 1`,
          lastFailureAt: timestamp,
          updatedAt: new Date(),
        })
        .where(eq(webhookEndpoints.id, id));
    }
  }

  // Webhook Events Operations
  async createEvent(data: NewWebhookEvent): Promise<WebhookEvent> {
    const [event] = await this.db
      .insert(webhookEvents)
      .values(data)
      .returning();
    return event;
  }

  async getEvents(
    filters: WebhookEventFilters = {},
    limit = 100,
    offset = 0
  ): Promise<WebhookEvent[]> {
    const conditions = [];

    if (filters.eventType) {
      conditions.push(eq(webhookEvents.eventType, filters.eventType as any));
    }
    if (filters.sourceType) {
      conditions.push(eq(webhookEvents.sourceType, filters.sourceType));
    }
    if (filters.userId) {
      conditions.push(eq(webhookEvents.userId, filters.userId));
    }
    if (filters.vendorId) {
      conditions.push(eq(webhookEvents.vendorId, filters.vendorId));
    }
    if (filters.isProcessed !== undefined) {
      conditions.push(eq(webhookEvents.isProcessed, filters.isProcessed));
    }
    if (filters.startDate && filters.endDate) {
      conditions.push(
        and(
          gte(webhookEvents.createdAt, filters.startDate),
          lte(webhookEvents.createdAt, filters.endDate)
        )
      );
    }

    return await this.db
      .select()
      .from(webhookEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(webhookEvents.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getEventById(id: string): Promise<WebhookEvent | undefined> {
    const [event] = await this.db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.id, id))
      .limit(1);

    return event;
  }

  async getPendingEvents(limit = 100): Promise<WebhookEvent[]> {
    return await this.db
      .select()
      .from(webhookEvents)
      .where(eq(webhookEvents.isProcessed, false))
      .orderBy(webhookEvents.createdAt)
      .limit(limit);
  }

  async markEventAsProcessed(id: string): Promise<void> {
    await this.db
      .update(webhookEvents)
      .set({
        isProcessed: true,
        processedAt: new Date(),
      })
      .where(eq(webhookEvents.id, id));
  }

  // Webhook Deliveries Operations
  async createDelivery(data: NewWebhookDelivery): Promise<WebhookDelivery> {
    const [delivery] = await this.db
      .insert(webhookDeliveries)
      .values(data)
      .returning();
    return delivery;
  }

  async getDeliveries(
    filters: WebhookDeliveryFilters = {},
    limit = 100,
    offset = 0
  ): Promise<WebhookDelivery[]> {
    const conditions = [];

    if (filters.webhookEndpointId) {
      conditions.push(
        eq(webhookDeliveries.webhookEndpointId, filters.webhookEndpointId)
      );
    }
    if (filters.deliveryStatus) {
      conditions.push(
        eq(webhookDeliveries.deliveryStatus, filters.deliveryStatus as any)
      );
    }
    if (filters.startDate && filters.endDate) {
      conditions.push(
        and(
          gte(webhookDeliveries.createdAt, filters.startDate),
          lte(webhookDeliveries.createdAt, filters.endDate)
        )
      );
    }

    return await this.db
      .select()
      .from(webhookDeliveries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getDeliveryById(id: string): Promise<WebhookDelivery | undefined> {
    const [delivery] = await this.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, id))
      .limit(1);

    return delivery;
  }

  async getDeliveriesForRetry(limit = 50): Promise<WebhookDelivery[]> {
    const now = new Date();

    return await this.db
      .select()
      .from(webhookDeliveries)
      .where(
        and(
          eq(webhookDeliveries.deliveryStatus, "retrying"),
          lte(webhookDeliveries.nextRetryAt, now)
        )
      )
      .orderBy(webhookDeliveries.nextRetryAt)
      .limit(limit);
  }

  async updateDelivery(
    id: string,
    data: Partial<NewWebhookDelivery>
  ): Promise<WebhookDelivery | undefined> {
    const [updated] = await this.db
      .update(webhookDeliveries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(webhookDeliveries.id, id))
      .returning();

    return updated;
  }

  // Webhook Subscriptions Operations
  async createSubscription(
    data: NewWebhookSubscription
  ): Promise<WebhookSubscription> {
    const [subscription] = await this.db
      .insert(webhookSubscriptions)
      .values(data)
      .returning();
    return subscription;
  }

  async getSubscriptionsByEndpoint(
    webhookEndpointId: string
  ): Promise<WebhookSubscription[]> {
    return await this.db
      .select()
      .from(webhookSubscriptions)
      .where(
        and(
          eq(webhookSubscriptions.webhookEndpointId, webhookEndpointId),
          eq(webhookSubscriptions.isActive, true)
        )
      );
  }

  async deleteSubscription(id: string): Promise<boolean> {
    const result = await this.db
      .delete(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, id))
      .returning({ id: webhookSubscriptions.id });

    return result.length > 0;
  }

  // Webhook Logs Operations
  async createLog(data: NewWebhookLog): Promise<WebhookLog> {
    const [log] = await this.db.insert(webhookLogs).values(data).returning();
    return log;
  }

  async getLogsByEndpoint(
    webhookEndpointId: string,
    limit = 100,
    offset = 0
  ): Promise<WebhookLog[]> {
    return await this.db
      .select()
      .from(webhookLogs)
      .where(eq(webhookLogs.webhookEndpointId, webhookEndpointId))
      .orderBy(desc(webhookLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getLogsByDelivery(webhookDeliveryId: string): Promise<WebhookLog[]> {
    return await this.db
      .select()
      .from(webhookLogs)
      .where(eq(webhookLogs.webhookDeliveryId, webhookDeliveryId))
      .orderBy(webhookLogs.createdAt);
  }

  // Statistics and Analytics
  async getWebhookStats(): Promise<WebhookStats> {
    const [endpointStats] = await this.db
      .select({
        totalEndpoints: count(),
        activeEndpoints: sql<number>`COUNT(CASE WHEN ${webhookEndpoints.status} = 'active' AND ${webhookEndpoints.isActive} = true THEN 1 END)`,
      })
      .from(webhookEndpoints);

    const [eventStats] = await this.db
      .select({
        totalEvents: count(),
        pendingEvents: sql<number>`COUNT(CASE WHEN ${webhookEvents.isProcessed} = false THEN 1 END)`,
      })
      .from(webhookEvents);

    const [deliveryStats] = await this.db
      .select({
        totalDeliveries: count(),
        successfulDeliveries: sql<number>`COUNT(CASE WHEN ${webhookDeliveries.deliveryStatus} = 'success' THEN 1 END)`,
        failedDeliveries: sql<number>`COUNT(CASE WHEN ${webhookDeliveries.deliveryStatus} = 'failed' THEN 1 END)`,
        averageResponseTime: sql<number>`AVG(${webhookDeliveries.responseTime})`,
      })
      .from(webhookDeliveries);

    return {
      totalEndpoints: endpointStats.totalEndpoints,
      activeEndpoints: endpointStats.activeEndpoints,
      totalEvents: eventStats.totalEvents,
      pendingEvents: eventStats.pendingEvents,
      totalDeliveries: deliveryStats.totalDeliveries,
      successfulDeliveries: deliveryStats.successfulDeliveries,
      failedDeliveries: deliveryStats.failedDeliveries,
      averageResponseTime: Number(deliveryStats.averageResponseTime) || 0,
    };
  }

  // Cleanup operations
  async deleteOldEvents(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.db
      .delete(webhookEvents)
      .where(
        and(
          eq(webhookEvents.isProcessed, true),
          lte(webhookEvents.createdAt, cutoffDate)
        )
      )
      .returning({ id: webhookEvents.id });

    return result.length;
  }

  async deleteOldDeliveries(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.db
      .delete(webhookDeliveries)
      .where(lte(webhookDeliveries.createdAt, cutoffDate))
      .returning({ id: webhookDeliveries.id });

    return result.length;
  }

  async deleteOldLogs(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.db
      .delete(webhookLogs)
      .where(lte(webhookLogs.createdAt, cutoffDate))
      .returning({ id: webhookLogs.id });

    return result.length;
  }
}

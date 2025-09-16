/**
 * Notification Repository
 * Handles database operations for notifications and preferences
 */

import { eq, and, desc, count, sql } from "drizzle-orm";
import type { Database } from "../database/connection.js";
import {
  notifications,
  notificationPreferences,
  notificationTemplates,
  type Notification,
  type NewNotification,
  type NotificationPreferences,
  type NewNotificationPreferences,
  type NotificationTemplate,
} from "../database/schema/notifications.js";

export class NotificationRepository {
  constructor(private db: Database) {}

  /**
   * Create a new notification
   */
  async create(data: NewNotification): Promise<Notification> {
    const [notification] = await this.db
      .insert(notifications)
      .values(data)
      .returning();
    return notification;
  }

  /**
   * Find notifications by user ID with filtering and pagination
   */
  async findByUserId(
    userId: string,
    filters: {
      isRead?: boolean;
      type?: string;
      category?: string;
      priority?: string;
      dateFrom?: Date;
      dateTo?: Date;
    } = {},
    pagination: { limit?: number; offset?: number } = {}
  ): Promise<Notification[]> {
    // Build conditions array
    const conditions = [eq(notifications.userId, userId)];

    if (filters.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, filters.isRead));
    }

    if (filters.type) {
      conditions.push(eq(notifications.type, filters.type as any));
    }

    if (filters.category) {
      conditions.push(eq(notifications.category, filters.category));
    }

    if (filters.priority) {
      conditions.push(eq(notifications.priority, filters.priority as any));
    }

    if (filters.dateFrom) {
      conditions.push(sql`${notifications.createdAt} >= ${filters.dateFrom}`);
    }

    if (filters.dateTo) {
      conditions.push(sql`${notifications.createdAt} <= ${filters.dateTo}`);
    }

    // Build the query
    let query = this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt));

    // Apply pagination
    if (pagination.limit) {
      query = query.limit(pagination.limit);
    }

    if (pagination.offset) {
      query = query.offset(pagination.offset);
    }

    return await query;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        )
      )
      .returning({ id: notifications.id });

    return result.length > 0;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      )
      .returning({ id: notifications.id });

    return result.length;
  }

  /**
   * Mark notification as delivered
   */
  async markAsDelivered(
    notificationId: string,
    channels: string[]
  ): Promise<boolean> {
    const result = await this.db
      .update(notifications)
      .set({
        deliveredAt: new Date(),
        deliveredChannels: channels,
      })
      .where(eq(notifications.id, notificationId))
      .returning({ id: notifications.id });

    return result.length > 0;
  }

  /**
   * Get notification statistics for a user
   */
  async getStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    const [totalResult] = await this.db
      .select({ count: count() })
      .from(notifications)
      .where(eq(notifications.userId, userId));

    const [unreadResult] = await this.db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      );

    // Get counts by type
    const typeStats = await this.db
      .select({
        type: notifications.type,
        count: count(),
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .groupBy(notifications.type);

    // Get counts by priority
    const priorityStats = await this.db
      .select({
        priority: notifications.priority,
        count: count(),
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .groupBy(notifications.priority);

    const byType: Record<string, number> = {};
    typeStats.forEach((stat) => {
      byType[stat.type] = stat.count;
    });

    const byPriority: Record<string, number> = {};
    priorityStats.forEach((stat) => {
      byPriority[stat.priority] = stat.count;
    });

    return {
      total: totalResult.count,
      unread: unreadResult.count,
      byType,
      byPriority,
    };
  }

  /**
   * Get scheduled notifications that are ready to be sent
   */
  async getScheduledNotifications(beforeDate: Date): Promise<Notification[]> {
    return await this.db
      .select()
      .from(notifications)
      .where(
        and(
          sql`${notifications.scheduledFor} <= ${beforeDate}`,
          sql`${notifications.deliveredAt} IS NULL`
        )
      )
      .orderBy(notifications.scheduledFor);
  }

  /**
   * Delete old notifications
   */
  async deleteOldNotifications(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.db
      .delete(notifications)
      .where(sql`${notifications.createdAt} < ${cutoffDate}`)
      .returning({ id: notifications.id });

    return result.length;
  }

  // Notification Preferences Methods

  /**
   * Find preferences by user ID
   */
  async findPreferencesByUserId(
    userId: string
  ): Promise<NotificationPreferences | null> {
    const [preferences] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    return preferences || null;
  }

  /**
   * Create notification preferences
   */
  async createPreferences(
    data: NewNotificationPreferences
  ): Promise<NotificationPreferences> {
    const [preferences] = await this.db
      .insert(notificationPreferences)
      .values(data)
      .returning();
    return preferences;
  }

  /**
   * Update or create notification preferences
   */
  async upsertPreferences(
    userId: string,
    data: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const existing = await this.findPreferencesByUserId(userId);

    if (existing) {
      const [updated] = await this.db
        .update(notificationPreferences)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      return await this.createPreferences({
        userId,
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: true,
        inAppEnabled: true,
        preferences: {},
        ...data,
      });
    }
  }

  // Notification Templates Methods

  /**
   * Find template by type, channel, and language
   */
  async findTemplate(
    type: string,
    channel: string,
    language: string = "en"
  ): Promise<NotificationTemplate | null> {
    const [template] = await this.db
      .select()
      .from(notificationTemplates)
      .where(
        and(
          eq(notificationTemplates.type, type as any),
          eq(notificationTemplates.channel, channel as any),
          eq(notificationTemplates.language, language)
        )
      );

    return template || null;
  }

  /**
   * Create or update a template
   */
  async upsertTemplate(
    data: Omit<NotificationTemplate, "id" | "createdAt" | "updatedAt">
  ): Promise<NotificationTemplate> {
    const existing = await this.findTemplate(
      data.type,
      data.channel,
      data.language
    );

    if (existing) {
      const [updated] = await this.db
        .update(notificationTemplates)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(notificationTemplates.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await this.db
        .insert(notificationTemplates)
        .values(data)
        .returning();
      return created;
    }
  }
}

/**
 * Notification Repository
 * Handles database operations for notifications, preferences, and templates
 */

import {
  eq,
  and,
  desc,
  asc,
  count,
  sql,
  inArray,
  isNull,
  or,
  gte,
  lte,
} from "drizzle-orm";
import { BaseRepository } from "./base.repository.js";
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
  type NewNotificationTemplate,
  type NotificationType,
  type NotificationChannel,
} from "../database/schema/notifications.js";

export interface NotificationFilters {
  userId?: string;
  type?: NotificationType;
  isRead?: boolean;
  category?: string;
  priority?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

export class NotificationRepository extends BaseRepository<
  Notification,
  NewNotification,
  Partial<NewNotification>
> {
  protected table = notifications;
  protected idColumn = notifications.id;
  protected tableName = "notifications";

  constructor(db: Database) {
    super(db);
  }
  // Notification CRUD operations
  async create(data: NewNotification): Promise<Notification> {
    const [notification] = await this.db
      .insert(notifications)
      .values(data)
      .returning();
    return notification;
  }

  async findById(id: string): Promise<Notification | null> {
    const [notification] = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);
    return notification || null;
  }

  async findByUserId(
    userId: string,
    filters: Partial<NotificationFilters> = {},
    pagination: { limit?: number; offset?: number } = {}
  ): Promise<Notification[]> {
    const { limit = 50, offset = 0 } = pagination;

    let query = this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId));

    // Apply filters
    const conditions = [eq(notifications.userId, userId)];

    if (filters.type) {
      conditions.push(eq(notifications.type, filters.type));
    }

    if (filters.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, filters.isRead));
    }

    if (filters.category) {
      conditions.push(eq(notifications.category, filters.category));
    }

    if (filters.priority) {
      conditions.push(eq(notifications.priority, filters.priority as any));
    }

    if (filters.dateFrom) {
      conditions.push(gte(notifications.createdAt, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(notifications.createdAt, filters.dateTo));
    }

    // Execute query directly to avoid type issues
    if (conditions.length > 1) {
      return this.db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      return this.db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);
    }
  }

  async markAsRead(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    return result.length > 0;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      )
      .returning();

    return result.length;
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    return result.length > 0;
  }

  async deleteOldNotifications(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.db
      .delete(notifications)
      .where(lte(notifications.createdAt, cutoffDate))
      .returning();

    return result.length;
  }

  async getUnreadCount(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      );

    return result.count;
  }

  async getStats(userId: string): Promise<NotificationStats> {
    // Get total and unread counts
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
    const typeResults = await this.db
      .select({
        type: notifications.type,
        count: count(),
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .groupBy(notifications.type);

    // Get counts by priority
    const priorityResults = await this.db
      .select({
        priority: notifications.priority,
        count: count(),
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .groupBy(notifications.priority);

    const byType: Record<string, number> = {};
    typeResults.forEach((result: any) => {
      byType[result.type] = result.count;
    });

    const byPriority: Record<string, number> = {};
    priorityResults.forEach((result: any) => {
      byPriority[result.priority] = result.count;
    });

    return {
      total: totalResult.count,
      unread: unreadResult.count,
      byType,
      byPriority,
    };
  }

  async getScheduledNotifications(beforeDate: Date): Promise<Notification[]> {
    return this.db
      .select()
      .from(notifications)
      .where(
        and(
          lte(notifications.scheduledFor, beforeDate),
          isNull(notifications.deliveredAt)
        )
      )
      .orderBy(asc(notifications.scheduledFor));
  }

  async markAsDelivered(id: string, channels: string[]): Promise<boolean> {
    const result = await this.db
      .update(notifications)
      .set({
        deliveredChannels: channels,
        deliveredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, id))
      .returning();

    return result.length > 0;
  }

  // Notification Preferences CRUD operations
  async createPreferences(
    data: NewNotificationPreferences
  ): Promise<NotificationPreferences> {
    const [preferences] = await this.db
      .insert(notificationPreferences)
      .values(data)
      .returning();
    return preferences;
  }

  async findPreferencesByUserId(
    userId: string
  ): Promise<NotificationPreferences | null> {
    const [preferences] = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    return preferences || null;
  }

  async updatePreferences(
    userId: string,
    data: Partial<NewNotificationPreferences>
  ): Promise<NotificationPreferences | null> {
    const [preferences] = await this.db
      .update(notificationPreferences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(notificationPreferences.userId, userId))
      .returning();
    return preferences || null;
  }

  async upsertPreferences(
    userId: string,
    data: Partial<NewNotificationPreferences>
  ): Promise<NotificationPreferences> {
    const existing = await this.findPreferencesByUserId(userId);

    if (existing) {
      return (await this.updatePreferences(userId, data))!;
    } else {
      return this.createPreferences({ userId, ...data });
    }
  }

  // Notification Templates CRUD operations
  async createTemplate(
    data: NewNotificationTemplate
  ): Promise<NotificationTemplate> {
    const [template] = await this.db
      .insert(notificationTemplates)
      .values(data)
      .returning();
    return template;
  }

  async findTemplate(
    type: NotificationType,
    channel: NotificationChannel,
    language = "en"
  ): Promise<NotificationTemplate | null> {
    const [template] = await this.db
      .select()
      .from(notificationTemplates)
      .where(
        and(
          eq(notificationTemplates.type, type),
          eq(notificationTemplates.channel, channel),
          eq(notificationTemplates.language, language),
          eq(notificationTemplates.isActive, true)
        )
      )
      .limit(1);
    return template || null;
  }

  async findTemplatesByType(
    type: NotificationType
  ): Promise<NotificationTemplate[]> {
    return this.db
      .select()
      .from(notificationTemplates)
      .where(
        and(
          eq(notificationTemplates.type, type),
          eq(notificationTemplates.isActive, true)
        )
      );
  }

  async updateTemplate(
    id: string,
    data: Partial<NewNotificationTemplate>
  ): Promise<NotificationTemplate | null> {
    const [template] = await this.db
      .update(notificationTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(notificationTemplates.id, id))
      .returning();
    return template || null;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const result = await this.db
      .delete(notificationTemplates)
      .where(eq(notificationTemplates.id, id))
      .returning();
    return result.length > 0;
  }

  // Bulk operations
  async createBulkNotifications(
    notificationData: NewNotification[]
  ): Promise<Notification[]> {
    if (notificationData.length === 0) return [];

    return this.db.insert(notifications).values(notificationData).returning();
  }

  async markMultipleAsRead(ids: string[], userId: string): Promise<number> {
    const result = await this.db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(inArray(notifications.id, ids), eq(notifications.userId, userId))
      )
      .returning();

    return result.length;
  }

  async deleteMultiple(ids: string[], userId: string): Promise<number> {
    const result = await this.db
      .delete(notifications)
      .where(
        and(inArray(notifications.id, ids), eq(notifications.userId, userId))
      )
      .returning();

    return result.length;
  }

  // Search and filtering
  async searchNotifications(
    userId: string,
    searchTerm: string,
    filters: Partial<NotificationFilters> = {},
    pagination: { limit?: number; offset?: number } = {}
  ): Promise<Notification[]> {
    const { limit = 50, offset = 0 } = pagination;

    const conditions = [eq(notifications.userId, userId)];

    // Add search condition
    if (searchTerm) {
      conditions.push(
        or(
          sql`${notifications.title} ILIKE ${`%${searchTerm}%`}`,
          sql`${notifications.message} ILIKE ${`%${searchTerm}%`}`
        )!
      );
    }

    // Apply other filters
    if (filters.type) {
      conditions.push(eq(notifications.type, filters.type));
    }

    if (filters.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, filters.isRead));
    }

    if (filters.category) {
      conditions.push(eq(notifications.category, filters.category));
    }

    return this.db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  }
}

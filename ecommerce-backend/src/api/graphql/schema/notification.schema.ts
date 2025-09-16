/**
 * GraphQL Schema for Notifications
 * Defines GraphQL types, queries, mutations, and subscriptions for notifications
 */

export const notificationTypeDefs = `
  # Enums
  enum NotificationType {
    ORDER_CREATED
    ORDER_UPDATED
    ORDER_SHIPPED
    ORDER_DELIVERED
    ORDER_CANCELLED
    PAYMENT_RECEIVED
    PAYMENT_FAILED
    PRODUCT_APPROVED
    PRODUCT_REJECTED
    VENDOR_APPROVED
    VENDOR_REJECTED
    PAYOUT_PROCESSED
    REVIEW_RECEIVED
    SYSTEM_ALERT
    SECURITY_ALERT
    WELCOME
    PASSWORD_RESET
    EMAIL_VERIFICATION
    CUSTOM
  }

  enum NotificationPriority {
    LOW
    NORMAL
    HIGH
    URGENT
  }

  enum NotificationChannel {
    IN_APP
    EMAIL
    SMS
    PUSH
    WEBHOOK
  }

  # Types
  type Notification {
    id: ID!
    userId: ID!
    type: NotificationType!
    title: String!
    message: String!
    priority: NotificationPriority!
    channels: [NotificationChannel!]!
    deliveredChannels: [NotificationChannel!]!
    isRead: Boolean!
    readAt: DateTime
    metadata: JSON
    category: String
    tags: [String!]!
    scheduledFor: DateTime
    deliveredAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type NotificationStats {
    total: Int!
    unread: Int!
    byType: JSON!
    byPriority: JSON!
  }

  type NotificationPreferences {
    id: ID!
    userId: ID!
    emailEnabled: Boolean!
    smsEnabled: Boolean!
    pushEnabled: Boolean!
    inAppEnabled: Boolean!
    preferences: JSON!
    quietHoursEnabled: Boolean!
    quietHoursStart: String
    quietHoursEnd: String
    quietHoursTimezone: String!
    dailyDigestEnabled: Boolean!
    weeklyDigestEnabled: Boolean!
    digestTime: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type NotificationDeliveryResult {
    notificationId: ID!
    userId: ID!
    deliveredChannels: [NotificationChannel!]!
    failedChannels: [NotificationChannel!]!
    errors: [DeliveryError!]!
  }

  type DeliveryError {
    channel: NotificationChannel!
    error: String!
  }

  type NotificationConnection {
    nodes: [Notification!]!
    totalCount: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  # Input Types
  input NotificationFilter {
    type: NotificationType
    isRead: Boolean
    category: String
    priority: NotificationPriority
    dateFrom: DateTime
    dateTo: DateTime
  }

  input NotificationPagination {
    limit: Int = 20
    offset: Int = 0
  }

  input SendNotificationInput {
    userId: ID
    type: NotificationType!
    title: String!
    message: String!
    priority: NotificationPriority = NORMAL
    channels: [NotificationChannel!]
    metadata: JSON
    category: String
    tags: [String!]
    scheduledFor: DateTime
  }

  input SendBulkNotificationInput {
    userIds: [ID!]!
    type: NotificationType!
    title: String!
    message: String!
    priority: NotificationPriority = NORMAL
    channels: [NotificationChannel!]
    metadata: JSON
    category: String
    tags: [String!]
    scheduledFor: DateTime
  }

  input UpdateNotificationPreferencesInput {
    emailEnabled: Boolean
    smsEnabled: Boolean
    pushEnabled: Boolean
    inAppEnabled: Boolean
    preferences: JSON
    quietHoursEnabled: Boolean
    quietHoursStart: String
    quietHoursEnd: String
    quietHoursTimezone: String
    dailyDigestEnabled: Boolean
    weeklyDigestEnabled: Boolean
    digestTime: String
  }

  input MarkAsReadInput {
    notificationIds: [ID!]
  }

  # Queries
  extend type Query {
    # Get user notifications
    notifications(
      filter: NotificationFilter
      pagination: NotificationPagination
    ): NotificationConnection!

    # Get single notification
    notification(id: ID!): Notification

    # Get notification statistics
    notificationStats: NotificationStats!

    # Get notification preferences
    notificationPreferences: NotificationPreferences!
  }

  # Mutations
  extend type Mutation {
    # Mark notifications as read
    markNotificationsAsRead(input: MarkAsReadInput!): Int!

    # Mark all notifications as read
    markAllNotificationsAsRead: Int!

    # Update notification preferences
    updateNotificationPreferences(
      input: UpdateNotificationPreferencesInput!
    ): NotificationPreferences!

    # Send notification (admin only)
    sendNotification(input: SendNotificationInput!): NotificationDeliveryResult!

    # Send bulk notifications (admin only)
    sendBulkNotifications(
      input: SendBulkNotificationInput!
    ): [NotificationDeliveryResult!]!

    # Test notification (development only)
    sendTestNotification: NotificationDeliveryResult!
  }

  # Subscriptions
  extend type Subscription {
    # Subscribe to new notifications for the authenticated user
    notificationReceived: Notification!

    # Subscribe to notification read events for the authenticated user
    notificationRead: ID!

    # Subscribe to notification stats updates
    notificationStatsUpdated: NotificationStats!
  }

  # Custom scalar types
  scalar DateTime
  scalar JSON
`;

export default notificationTypeDefs;

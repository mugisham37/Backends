/**
 * Analytics GraphQL Schema
 * Defines types, queries, and mutations for analytics operations
 */

import { gql } from "graphql-tag";

export const analyticsTypeDefs = gql`
  # Analytics Event types
  type AnalyticsEvent implements Node {
    id: ID!
    eventType: String!
    userId: String
    sessionId: String
    userAgent: String
    ipAddress: String
    referrer: String
    page: String
    eventData: JSON
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Business Metrics types
  type BusinessMetric implements Node {
    id: ID!
    metricType: String!
    metricValue: Float!
    dimensions: JSON
    metadata: JSON
    recordedAt: DateTime!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # User Behavior types
  type UserBehavior implements Node {
    id: ID!
    userId: String!
    sessionId: String
    page: String
    action: String!
    elementId: String
    behaviorData: JSON
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Product Analytics types
  type ProductAnalytics implements Node {
    id: ID!
    productId: String!
    action: String!
    userId: String
    quantity: Int
    revenue: Float
    categoryId: String
    vendorId: String
    analyticsData: JSON
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Dashboard Data types
  type DashboardStats {
    totalEvents: Int!
    totalUsers: Int!
    totalSessions: Int!
    totalPageViews: Int!
    bounceRate: Float
    avgSessionDuration: Float
    topPages: [PageStats!]!
    topEvents: [EventStats!]!
    userGrowth: [GrowthStat!]!
    revenueMetrics: RevenueStats
  }

  type PageStats {
    page: String!
    views: Int!
    uniqueViews: Int!
    avgTimeOnPage: Float
  }

  type EventStats {
    eventType: String!
    count: Int!
    percentage: Float
  }

  type GrowthStat {
    date: String!
    value: Float!
  }

  type RevenueStats {
    totalRevenue: Float!
    avgOrderValue: Float!
    conversionRate: Float!
    topProducts: [ProductRevenue!]!
  }

  type ProductRevenue {
    productId: String!
    productName: String
    revenue: Float!
    orders: Int!
  }

  # User Engagement Report types
  type UserEngagementReport {
    period: String!
    activeUsers: Int!
    sessionsPerUser: Float!
    pageViewsPerSession: Float!
    avgSessionDuration: Float!
    bounceRate: Float!
    returnRate: Float!
  }

  # Product Performance Report types
  type ProductPerformanceReport {
    period: String!
    topProducts: [ProductPerformance!]!
    categoryPerformance: [CategoryPerformance!]!
    vendorPerformance: [VendorPerformance!]!
  }

  type ProductPerformance {
    productId: String!
    productName: String
    views: Int!
    purchases: Int!
    revenue: Float!
    conversionRate: Float!
  }

  type CategoryPerformance {
    categoryId: String!
    categoryName: String
    views: Int!
    purchases: Int!
    revenue: Float!
  }

  type VendorPerformance {
    vendorId: String!
    vendorName: String
    views: Int!
    purchases: Int!
    revenue: Float!
  }

  # Input types
  input TrackEventInput {
    eventType: String!
    userId: String
    sessionId: String
    userAgent: String
    ipAddress: String
    referrer: String
    page: String
    eventData: JSON
    metadata: JSON
  }

  input BusinessMetricInput {
    metricType: String!
    metricValue: Float!
    dimensions: JSON
    metadata: JSON
  }

  input UserBehaviorInput {
    userId: String!
    sessionId: String
    page: String
    action: String!
    elementId: String
    behaviorData: JSON
    metadata: JSON
  }

  input ProductAnalyticsInput {
    productId: String!
    action: String!
    userId: String
    quantity: Int
    revenue: Float
    categoryId: String
    vendorId: String
    analyticsData: JSON
    metadata: JSON
  }

  input AnalyticsFilters {
    eventType: String
    userId: String
    sessionId: String
    startDate: DateTime
    endDate: DateTime
    page: String
    action: String
    productId: String
    categoryId: String
    vendorId: String
  }

  input DateRangeInput {
    startDate: DateTime!
    endDate: DateTime!
  }

  enum DateRangePreset {
    TODAY
    YESTERDAY
    LAST_7_DAYS
    LAST_30_DAYS
    LAST_3_MONTHS
    LAST_6_MONTHS
    LAST_YEAR
    THIS_WEEK
    THIS_MONTH
    THIS_QUARTER
    THIS_YEAR
  }

  enum GroupByPeriod {
    HOUR
    DAY
    WEEK
    MONTH
    QUARTER
    YEAR
  }

  # Analytics connection types
  type AnalyticsEventConnection {
    edges: [AnalyticsEventEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AnalyticsEventEdge {
    node: AnalyticsEvent!
    cursor: String!
  }

  type BusinessMetricConnection {
    edges: [BusinessMetricEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type BusinessMetricEdge {
    node: BusinessMetric!
    cursor: String!
  }

  type UserBehaviorConnection {
    edges: [UserBehaviorEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type UserBehaviorEdge {
    node: UserBehavior!
    cursor: String!
  }

  type ProductAnalyticsConnection {
    edges: [ProductAnalyticsEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ProductAnalyticsEdge {
    node: ProductAnalytics!
    cursor: String!
  }

  # Extend Query type
  extend type Query {
    # Analytics Events
    analyticsEvent(id: ID!): AnalyticsEvent
    analyticsEvents(
      filters: AnalyticsFilters
      first: Int
      after: String
      last: Int
      before: String
    ): AnalyticsEventConnection!

    # Business Metrics
    businessMetric(id: ID!): BusinessMetric
    businessMetrics(
      filters: AnalyticsFilters
      first: Int
      after: String
      last: Int
      before: String
    ): BusinessMetricConnection!

    # User Behavior
    userBehavior(id: ID!): UserBehavior
    userBehaviors(
      filters: AnalyticsFilters
      first: Int
      after: String
      last: Int
      before: String
    ): UserBehaviorConnection!

    # Product Analytics
    productAnalytics(
      filters: AnalyticsFilters
      first: Int
      after: String
      last: Int
      before: String
    ): ProductAnalyticsConnection!

    # Dashboard and Reports
    dashboardStats(
      dateRange: DateRangeInput
      dateRangePreset: DateRangePreset
      vendorId: String
      categoryId: String
    ): DashboardStats!

    userEngagementReport(
      dateRange: DateRangeInput
      dateRangePreset: DateRangePreset
      groupBy: GroupByPeriod
    ): [UserEngagementReport!]!

    productPerformanceReport(
      dateRange: DateRangeInput
      dateRangePreset: DateRangePreset
      groupBy: GroupByPeriod
      vendorId: String
      categoryId: String
    ): [ProductPerformanceReport!]!

    # User-specific analytics
    userEvents(
      userId: String!
      filters: AnalyticsFilters
      first: Int
      after: String
    ): AnalyticsEventConnection!

    sessionEvents(
      sessionId: String!
      filters: AnalyticsFilters
      first: Int
      after: String
    ): AnalyticsEventConnection!

    userBehaviorStats(
      userId: String!
      dateRange: DateRangeInput
      dateRangePreset: DateRangePreset
    ): UserEngagementReport!
  }

  # Extend Mutation type
  extend type Mutation {
    # Track analytics events
    trackEvent(input: TrackEventInput!): AnalyticsEvent!

    trackEvents(inputs: [TrackEventInput!]!): [AnalyticsEvent!]!

    # Record business metrics
    recordBusinessMetric(input: BusinessMetricInput!): BusinessMetric!

    # Track user behavior
    trackUserBehavior(input: UserBehaviorInput!): UserBehavior!

    # Track product analytics
    trackProductAnalytics(input: ProductAnalyticsInput!): ProductAnalytics!

    # Cleanup old data (admin only)
    cleanupAnalyticsData(retentionDays: Int = 365): Boolean!
  }

  # Extend Subscription type
  extend type Subscription {
    # Real-time analytics updates
    analyticsEventAdded(eventTypes: [String!]): AnalyticsEvent!

    businessMetricAdded(metricTypes: [String!]): BusinessMetric!

    userBehaviorAdded(userId: String): UserBehavior!

    dashboardStatsUpdated(vendorId: String): DashboardStats!
  }
`;

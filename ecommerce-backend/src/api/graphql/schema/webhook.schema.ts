/**
 * Webhook GraphQL Schema
 * Defines types, queries, and mutations for webhook operations
 */

import { gql } from "graphql-tag";

export const webhookTypeDefs = gql`
  # Webhook Endpoint types
  type WebhookEndpoint implements Node {
    id: ID!
    url: String!
    eventTypes: [String!]!
    isActive: Boolean!
    secret: String
    headers: JSON
    timeoutMs: Int!
    retryCount: Int!
    status: WebhookEndpointStatus!
    userId: String!
    vendorId: String
    lastDeliveryAt: DateTime
    failureCount: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    deliveries: [WebhookDelivery!]!
    logs: [WebhookLog!]!
  }

  # Webhook Event types
  type WebhookEvent implements Node {
    id: ID!
    eventType: String!
    sourceType: String!
    sourceId: String!
    eventData: JSON!
    userId: String
    vendorId: String
    isProcessed: Boolean!
    processedAt: DateTime
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
    deliveries: [WebhookDelivery!]!
  }

  # Webhook Delivery types
  type WebhookDelivery implements Node {
    id: ID!
    webhookEndpointId: String!
    webhookEventId: String!
    deliveryStatus: WebhookDeliveryStatus!
    httpStatusCode: Int
    responseBody: String
    responseHeaders: JSON
    requestHeaders: JSON
    requestBody: JSON
    attemptCount: Int!
    lastAttemptAt: DateTime
    nextRetryAt: DateTime
    deliveredAt: DateTime
    failedAt: DateTime
    errorMessage: String
    createdAt: DateTime!
    updatedAt: DateTime!
    endpoint: WebhookEndpoint!
    event: WebhookEvent!
  }

  # Webhook Subscription types
  type WebhookSubscription implements Node {
    id: ID!
    webhookEndpointId: String!
    eventType: String!
    isActive: Boolean!
    filterCriteria: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
    endpoint: WebhookEndpoint!
  }

  # Webhook Log types
  type WebhookLog implements Node {
    id: ID!
    webhookEndpointId: String!
    logLevel: WebhookLogLevel!
    message: String!
    eventData: JSON
    metadata: JSON
    createdAt: DateTime!
    endpoint: WebhookEndpoint!
  }

  # Webhook Statistics types
  type WebhookStats {
    totalEndpoints: Int!
    activeEndpoints: Int!
    totalEvents: Int!
    processedEvents: Int!
    totalDeliveries: Int!
    successfulDeliveries: Int!
    failedDeliveries: Int!
    pendingDeliveries: Int!
    avgDeliveryTime: Float
    successRate: Float!
    recentDeliveries: [WebhookDelivery!]!
    topEventTypes: [EventTypeStats!]!
    endpointHealth: [EndpointHealth!]!
  }

  type EventTypeStats {
    eventType: String!
    count: Int!
    successRate: Float!
  }

  type EndpointHealth {
    webhookEndpointId: String!
    url: String!
    isActive: Boolean!
    successRate: Float!
    avgResponseTime: Float
    lastDeliveryAt: DateTime
    failureCount: Int!
  }

  # Test Result types
  type WebhookTestResult {
    success: Boolean!
    httpStatusCode: Int
    responseBody: String
    responseHeaders: JSON
    responseTime: Float
    errorMessage: String
    timestamp: DateTime!
  }

  # Cleanup Result types
  type WebhookCleanupResult {
    deletedEvents: Int!
    deletedDeliveries: Int!
    deletedLogs: Int!
    retentionDays: Int!
    timestamp: DateTime!
  }

  # Enums
  enum WebhookEndpointStatus {
    ACTIVE
    INACTIVE
    FAILED
    RATE_LIMITED
  }

  enum WebhookDeliveryStatus {
    PENDING
    SUCCESS
    FAILED
    RETRYING
  }

  enum WebhookLogLevel {
    INFO
    WARN
    ERROR
    DEBUG
  }

  # Input types
  input CreateWebhookEndpointInput {
    url: String!
    eventTypes: [String!]!
    isActive: Boolean = true
    secret: String
    headers: JSON
    timeoutMs: Int = 30000
    retryCount: Int = 3
    vendorId: String
  }

  input UpdateWebhookEndpointInput {
    url: String
    eventTypes: [String!]
    isActive: Boolean
    secret: String
    headers: JSON
    timeoutMs: Int
    retryCount: Int
  }

  input CreateWebhookEventInput {
    eventType: String!
    sourceType: String!
    sourceId: String!
    eventData: JSON!
    userId: String
    vendorId: String
    metadata: JSON
  }

  input CreateWebhookSubscriptionInput {
    webhookEndpointId: String!
    eventType: String!
    isActive: Boolean = true
    filterCriteria: JSON
  }

  input WebhookFilters {
    eventTypes: [String!]
    status: WebhookEndpointStatus
    isActive: Boolean
    deliveryStatus: WebhookDeliveryStatus
    startDate: DateTime
    endDate: DateTime
    userId: String
    vendorId: String
    sourceType: String
  }

  # Connection types
  type WebhookEndpointConnection {
    edges: [WebhookEndpointEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type WebhookEndpointEdge {
    node: WebhookEndpoint!
    cursor: String!
  }

  type WebhookEventConnection {
    edges: [WebhookEventEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type WebhookEventEdge {
    node: WebhookEvent!
    cursor: String!
  }

  type WebhookDeliveryConnection {
    edges: [WebhookDeliveryEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type WebhookDeliveryEdge {
    node: WebhookDelivery!
    cursor: String!
  }

  type WebhookLogConnection {
    edges: [WebhookLogEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type WebhookLogEdge {
    node: WebhookLog!
    cursor: String!
  }

  # Extend Query type
  extend type Query {
    # Webhook Endpoints
    webhookEndpoint(id: ID!): WebhookEndpoint
    webhookEndpoints(
      filters: WebhookFilters
      first: Int
      after: String
      last: Int
      before: String
    ): WebhookEndpointConnection!

    # Webhook Events
    webhookEvent(id: ID!): WebhookEvent
    webhookEvents(
      filters: WebhookFilters
      first: Int
      after: String
      last: Int
      before: String
    ): WebhookEventConnection!

    # Webhook Deliveries
    webhookDelivery(id: ID!): WebhookDelivery
    webhookDeliveries(
      filters: WebhookFilters
      first: Int
      after: String
      last: Int
      before: String
    ): WebhookDeliveryConnection!

    # Webhook Logs
    webhookLogs(
      webhookEndpointId: String!
      first: Int
      after: String
      last: Int
      before: String
    ): WebhookLogConnection!

    # Webhook Statistics
    webhookStats: WebhookStats!

    # Endpoint-specific queries
    endpointDeliveries(
      webhookEndpointId: String!
      filters: WebhookFilters
      first: Int
      after: String
    ): WebhookDeliveryConnection!

    endpointLogs(
      webhookEndpointId: String!
      first: Int
      after: String
    ): WebhookLogConnection!
  }

  # Extend Mutation type
  extend type Mutation {
    # Webhook Endpoint Management
    createWebhookEndpoint(input: CreateWebhookEndpointInput!): WebhookEndpoint!
    updateWebhookEndpoint(
      id: ID!
      input: UpdateWebhookEndpointInput!
    ): WebhookEndpoint!
    deleteWebhookEndpoint(id: ID!): Boolean!

    # Webhook Event Management
    dispatchWebhookEvent(input: CreateWebhookEventInput!): WebhookEvent!

    # Webhook Subscription Management
    createWebhookSubscription(
      input: CreateWebhookSubscriptionInput!
    ): WebhookSubscription!
    deleteWebhookSubscription(id: ID!): Boolean!

    # Webhook Delivery Management
    retryWebhookDelivery(deliveryId: ID!): WebhookDelivery!

    # Testing and Utilities
    testWebhookEndpoint(id: ID!): WebhookTestResult!
    cleanupWebhookData(retentionDays: Int = 90): WebhookCleanupResult!
  }

  # Extend Subscription type
  extend type Subscription {
    # Real-time webhook updates
    webhookEventAdded(eventTypes: [String!], vendorId: String): WebhookEvent!
    webhookDeliveryStatusChanged(webhookEndpointId: String): WebhookDelivery!
    webhookEndpointStatusChanged(vendorId: String): WebhookEndpoint!
    webhookStatsUpdated: WebhookStats!
  }
`;

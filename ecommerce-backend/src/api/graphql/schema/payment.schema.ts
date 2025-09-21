/**
 * Payment GraphQL Schema
 * Defines payment-related types, queries, and mutations
 */

import { gql } from "graphql-tag";

export const paymentTypeDefs = gql`
  # Payment enums
  enum PaymentStatus {
    PENDING
    PROCESSING
    SUCCEEDED
    FAILED
    CANCELLED
    REFUNDED
    PARTIALLY_REFUNDED
    DISPUTED
  }

  enum PaymentProvider {
    STRIPE
    PAYPAL
  }

  enum PaymentMethod {
    CARD
    BANK_TRANSFER
    PAYPAL
    APPLE_PAY
    GOOGLE_PAY
    WALLET
    OTHER
  }

  enum PaymentIntent {
    CAPTURE
    AUTHORIZE
  }

  enum RefundStatus {
    PENDING
    PROCESSING
    SUCCEEDED
    FAILED
    CANCELLED
  }

  enum DisputeStatus {
    WARNING_NEEDS_RESPONSE
    WARNING_UNDER_REVIEW
    WARNING_CLOSED
    NEEDS_RESPONSE
    UNDER_REVIEW
    CHARGE_REFUNDED
    WON
    LOST
  }

  # Payment types
  type Payment {
    id: ID!
    orderId: String!
    vendorId: String!
    amount: Decimal!
    currency: String!
    applicationFee: Decimal
    status: PaymentStatus!
    provider: PaymentProvider!
    method: PaymentMethod!
    intent: PaymentIntent!
    externalId: String
    clientSecret: String
    metadata: JSON
    failureReason: String
    processedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    order: Order
    vendor: Vendor
    transactions: [PaymentTransaction!]!
    refunds: [PaymentRefund!]!
    disputes: [PaymentDispute!]!
  }

  type PaymentTransaction {
    id: ID!
    paymentId: String!
    transactionId: String!
    amount: Decimal!
    currency: String!
    status: PaymentStatus!
    processorData: JSON
    createdAt: DateTime!

    # Relations
    payment: Payment!
  }

  type PaymentRefund {
    id: ID!
    paymentId: String!
    transactionId: String
    amount: Decimal!
    currency: String!
    reason: String
    status: RefundStatus!
    externalId: String
    processorData: JSON
    refundedAt: DateTime
    createdAt: DateTime!

    # Relations
    payment: Payment!
  }

  type PaymentDispute {
    id: ID!
    paymentId: String!
    externalId: String!
    amount: Decimal!
    currency: String!
    reason: String!
    status: DisputeStatus!
    evidenceDueBy: DateTime
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    payment: Payment!
  }

  type PaymentWebhook {
    id: ID!
    provider: PaymentProvider!
    eventType: String!
    eventId: String!
    data: JSON!
    processed: Boolean!
    attempts: Int!
    lastAttemptAt: DateTime
    processedAt: DateTime
    createdAt: DateTime!

    # Relations
    paymentId: String
    payment: Payment
  }

  # Input types
  input CreatePaymentInput {
    orderId: String!
    vendorId: String!
    amount: Decimal!
    currency: String
    provider: PaymentProvider!
    method: PaymentMethod!
    intent: PaymentIntent
    metadata: JSON
  }

  input UpdatePaymentInput {
    metadata: JSON
  }

  input ProcessPaymentInput {
    paymentMethodId: String
    savePaymentMethod: Boolean
    customerEmail: String
    customerName: String
    billingAddress: JSON
    metadata: JSON
  }

  input RefundPaymentInput {
    amount: Decimal
    reason: String
    metadata: JSON
  }

  input PaymentFiltersInput {
    status: [PaymentStatus!]
    provider: [PaymentProvider!]
    method: [PaymentMethod!]
    vendorId: String
    orderId: String
    amountMin: Decimal
    amountMax: Decimal
    currency: String
    dateFrom: DateTime
    dateTo: DateTime
  }

  input PaymentSortInput {
    field: PaymentSortField!
    order: SortOrder!
  }

  enum PaymentSortField {
    CREATED_AT
    UPDATED_AT
    AMOUNT
    STATUS
    PROCESSED_AT
  }

  # Analytics types
  type PaymentAnalytics {
    totalAmount: Decimal!
    totalCount: Int!
    averageAmount: Decimal!
    successRate: Float!
    topMethods: [PaymentMethodStats!]!
    topProviders: [PaymentProviderStats!]!
    dailyStats: [DailyPaymentStats!]!
    currencyBreakdown: [CurrencyStats!]!
  }

  type PaymentMethodStats {
    method: PaymentMethod!
    count: Int!
    totalAmount: Decimal!
    percentage: Float!
  }

  type PaymentProviderStats {
    provider: PaymentProvider!
    count: Int!
    totalAmount: Decimal!
    successRate: Float!
  }

  type DailyPaymentStats {
    date: DateTime!
    count: Int!
    amount: Decimal!
    successRate: Float!
  }

  type CurrencyStats {
    currency: String!
    count: Int!
    totalAmount: Decimal!
    percentage: Float!
  }

  # Payment intent response
  type PaymentIntentResponse {
    clientSecret: String!
    status: PaymentStatus!
    nextAction: JSON
    metadata: JSON
  }

  # Paginated responses
  type PaymentConnection {
    edges: [PaymentEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PaymentEdge {
    node: Payment!
    cursor: String!
  }

  # Root operations
  extend type Query {
    # Single payment queries
    payment(id: ID!): Payment
    paymentByExternalId(
      externalId: String!
      provider: PaymentProvider!
    ): Payment

    # Payment collections
    payments(
      filters: PaymentFiltersInput
      sort: PaymentSortInput
      first: Int
      after: String
      last: Int
      before: String
    ): PaymentConnection!

    # Vendor payments
    vendorPayments(
      vendorId: String!
      filters: PaymentFiltersInput
      sort: PaymentSortInput
      first: Int
      after: String
    ): PaymentConnection!

    # Order payments
    orderPayments(orderId: String!): [Payment!]!

    # Analytics
    paymentAnalytics(
      filters: PaymentFiltersInput
      dateFrom: DateTime
      dateTo: DateTime
    ): PaymentAnalytics!

    # Webhooks
    paymentWebhooks(
      provider: PaymentProvider
      processed: Boolean
      first: Int
      after: String
    ): [PaymentWebhook!]!
  }

  extend type Mutation {
    # Payment lifecycle
    createPayment(input: CreatePaymentInput!): Payment!
    updatePayment(id: ID!, input: UpdatePaymentInput!): Payment!
    processPayment(id: ID!, input: ProcessPaymentInput!): PaymentIntentResponse!
    confirmPayment(id: ID!): Payment!
    cancelPayment(id: ID!, reason: String): Payment!

    # Refunds
    refundPayment(id: ID!, input: RefundPaymentInput!): PaymentRefund!

    # Webhooks
    processPaymentWebhook(
      provider: PaymentProvider!
      signature: String!
      payload: String!
    ): Boolean!

    # Admin operations
    retryFailedPayment(id: ID!): Payment!
    markPaymentAsDisputed(
      id: ID!
      disputeId: String!
      reason: String!
    ): PaymentDispute!
  }

  extend type Subscription {
    # Payment status updates
    paymentStatusChanged(paymentId: ID): Payment!
    vendorPaymentStatusChanged(vendorId: String!): Payment!

    # Webhook events
    paymentWebhookReceived(provider: PaymentProvider): PaymentWebhook!
  }
`;

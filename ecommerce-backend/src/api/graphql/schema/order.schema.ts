/**
 * Order GraphQL Schema
 * Defines types, queries, and mutations for order operations
 */

import { gql } from "graphql-tag";

export const orderTypeDefs = gql`
  # Order enums
  enum OrderStatus {
    PENDING
    CONFIRMED
    PROCESSING
    SHIPPED
    DELIVERED
    CANCELLED
    REFUNDED
    RETURNED
  }

  enum PaymentStatus {
    PENDING
    PAID
    FAILED
    REFUNDED
    PARTIALLY_REFUNDED
  }

  enum ShippingStatus {
    PENDING
    PROCESSING
    SHIPPED
    IN_TRANSIT
    DELIVERED
    FAILED
  }

  # Order types
  type Order implements Node {
    id: ID!
    orderNumber: String!

    # Customer information
    userId: ID
    customerEmail: String!
    customerPhone: String

    # Order status
    status: OrderStatus!
    paymentStatus: PaymentStatus!
    shippingStatus: ShippingStatus!

    # Pricing
    subtotal: Decimal!
    taxAmount: Decimal!
    shippingAmount: Decimal!
    discountAmount: Decimal!
    total: Decimal!
    currency: String!

    # Addresses
    billingAddress: Address!
    shippingAddress: Address!

    # Shipping information
    shippingMethod: String
    trackingNumber: String
    trackingUrl: String

    # Notes
    customerNotes: String
    adminNotes: String

    # Metadata
    metadata: JSON

    # Timestamps
    shippedAt: DateTime
    deliveredAt: DateTime
    cancelledAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    user: User
    items: [OrderItem!]!
    payments: [Payment!]!

    # Computed fields
    itemCount: Int!
    canCancel: Boolean!
    canRefund: Boolean!
    canReturn: Boolean!
  }

  type OrderConnection {
    edges: [OrderEdge!]!
    nodes: [Order!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type OrderEdge {
    node: Order!
    cursor: String!
  }

  # Order items
  type OrderItem implements Node {
    id: ID!
    orderId: ID!
    productId: ID!
    variantId: ID
    vendorId: ID!

    # Product information (snapshot)
    productName: String!
    productSku: String
    variantTitle: String

    # Pricing
    price: Decimal!
    quantity: Int!
    total: Decimal!

    # Product snapshot
    productSnapshot: JSON

    # Timestamps
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    product: Product!
    variant: ProductVariant
    vendor: Vendor!
  }

  # Address type
  type Address {
    firstName: String!
    lastName: String!
    company: String
    address1: String!
    address2: String
    city: String!
    state: String!
    postalCode: String!
    country: String!
    phone: String
  }

  input AddressInput {
    firstName: String!
    lastName: String!
    company: String
    address1: String!
    address2: String
    city: String!
    state: String!
    postalCode: String!
    country: String!
    phone: String
  }

  # Payment types
  type Payment implements Node {
    id: ID!
    orderId: ID!

    # Payment information
    paymentMethod: String!
    paymentIntentId: String
    transactionId: String

    # Amount
    amount: Decimal!
    currency: String!

    # Status
    status: PaymentStatus!

    # Gateway response
    gatewayResponse: JSON

    # Timestamps
    processedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Order statistics
  type OrderStats {
    totalOrders: Int!
    totalRevenue: Decimal!
    averageOrderValue: Decimal!
    byStatus: JSON!
    byPaymentStatus: JSON!
    recentOrders: [Order!]!
    topCustomers: [User!]!
  }

  # Input types
  input OrderFiltersInput {
    status: OrderStatus
    paymentStatus: PaymentStatus
    shippingStatus: ShippingStatus
    userId: ID
    vendorId: ID
    customerEmail: String
    orderNumber: String
    dateFrom: DateTime
    dateTo: DateTime
    search: String
  }

  input CreateOrderInput {
    customerEmail: String!
    customerPhone: String
    billingAddress: AddressInput!
    shippingAddress: AddressInput!
    items: [OrderItemInput!]!
    shippingMethod: String
    customerNotes: String
    metadata: JSON
  }

  input OrderItemInput {
    productId: ID!
    variantId: ID
    quantity: Int!
    price: Decimal!
  }

  input UpdateOrderStatusInput {
    status: OrderStatus!
    adminNotes: String
  }

  input UpdateShippingInput {
    shippingStatus: ShippingStatus!
    trackingNumber: String
    trackingUrl: String
    shippedAt: DateTime
  }

  input ProcessPaymentInput {
    paymentMethod: String!
    paymentIntentId: String
    amount: Decimal!
  }

  # Extend root types
  extend type Query {
    # Order queries
    order(id: ID, orderNumber: String): Order
    orders(
      filters: OrderFiltersInput
      pagination: PaginationInput
      sortBy: String = "createdAt"
      sortOrder: SortOrder = DESC
    ): OrderConnection!

    # Current user orders
    myOrders(
      pagination: PaginationInput
      sortBy: String = "createdAt"
      sortOrder: SortOrder = DESC
    ): OrderConnection!

    # Vendor orders
    vendorOrders(
      vendorId: ID!
      filters: OrderFiltersInput
      pagination: PaginationInput
      sortBy: String = "createdAt"
      sortOrder: SortOrder = DESC
    ): OrderConnection!

    # Order statistics (admin/vendor only)
    orderStats(vendorId: ID, dateFrom: DateTime, dateTo: DateTime): OrderStats!
  }

  extend type Mutation {
    # Order management
    createOrder(input: CreateOrderInput!): Order!
    updateOrderStatus(id: ID!, input: UpdateOrderStatusInput!): Order!
    updateOrderShipping(id: ID!, input: UpdateShippingInput!): Order!
    cancelOrder(id: ID!, reason: String): Order!

    # Payment processing
    processPayment(orderId: ID!, input: ProcessPaymentInput!): Payment!
    refundPayment(paymentId: ID!, amount: Decimal, reason: String): Payment!

    # Order actions
    confirmOrder(id: ID!): Order!
    shipOrder(id: ID!, input: UpdateShippingInput!): Order!
    deliverOrder(id: ID!): Order!
  }

  extend type Subscription {
    # Order subscriptions
    orderUpdated(orderId: ID!): Order!
    orderStatusChanged(userId: ID): Order!
    vendorOrderReceived(vendorId: ID!): Order!
    paymentProcessed(orderId: ID!): Payment!
  }
`;

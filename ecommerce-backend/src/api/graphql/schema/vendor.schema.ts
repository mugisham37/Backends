/**
 * Vendor GraphQL Schema
 * Defines types, queries, and mutations for vendor operations
 */

import { gql } from "graphql-tag";

export const vendorTypeDefs = gql`
  # Vendor enums
  enum VendorStatus {
    PENDING
    APPROVED
    REJECTED
    SUSPENDED
    INACTIVE
  }

  enum VerificationStatus {
    UNVERIFIED
    PENDING
    VERIFIED
    REJECTED
  }

  # Vendor types
  type Vendor implements Node {
    id: ID!
    userId: ID!

    # Business information
    businessName: String!
    slug: String!
    description: String
    businessType: String

    # Contact information
    email: String!
    phoneNumber: String
    website: String

    # Business details
    taxId: String
    businessLicense: String

    # Status and verification
    status: VendorStatus!
    verificationStatus: VerificationStatus!

    # Financial information
    commissionRate: Decimal!

    # Settings
    autoApproveProducts: Boolean!
    allowReviews: Boolean!

    # Metadata
    metadata: JSON

    # Timestamps
    approvedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    user: User!
    products: ProductConnection!
    orders: OrderConnection!

    # Statistics
    stats: VendorStats!
  }

  type VendorConnection {
    edges: [VendorEdge!]!
    nodes: [Vendor!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type VendorEdge {
    node: Vendor!
    cursor: String!
  }

  # Vendor statistics
  type VendorStats {
    totalProducts: Int!
    activeProducts: Int!
    totalOrders: Int!
    totalRevenue: Decimal!
    averageOrderValue: Decimal!
    conversionRate: Float!
  }

  type VendorOverallStats {
    total: Int!
    byStatus: JSON!
    byVerificationStatus: JSON!
    approved: Int!
    pending: Int!
    recentVendors: [Vendor!]!
  }

  # Input types
  input VendorFiltersInput {
    status: VendorStatus
    verificationStatus: VerificationStatus
    businessType: String
    search: String
    userId: ID
  }

  input CreateVendorInput {
    businessName: String!
    description: String
    businessType: String
    email: String!
    phoneNumber: String
    website: String
    taxId: String
    businessLicense: String
    metadata: JSON
  }

  input UpdateVendorInput {
    businessName: String
    description: String
    businessType: String
    phoneNumber: String
    website: String
    taxId: String
    businessLicense: String
    autoApproveProducts: Boolean
    allowReviews: Boolean
    metadata: JSON
  }

  input UpdateVendorStatusInput {
    status: VendorStatus!
  }

  input UpdateVendorVerificationInput {
    verificationStatus: VerificationStatus!
  }

  # Extend root types
  extend type Query {
    # Vendor queries
    vendor(id: ID, slug: String): Vendor
    vendors(
      filters: VendorFiltersInput
      pagination: PaginationInput
      sortBy: String = "createdAt"
      sortOrder: SortOrder = DESC
    ): VendorConnection!

    # Current vendor (for authenticated vendor users)
    myVendor: Vendor

    # Vendor statistics (admin only)
    vendorStats: VendorOverallStats!

    # Top vendors
    topVendors(limit: Int = 10): [Vendor!]!
  }

  extend type Mutation {
    # Vendor management
    createVendor(input: CreateVendorInput!): Vendor!
    updateVendor(id: ID!, input: UpdateVendorInput!): Vendor!
    updateVendorStatus(id: ID!, input: UpdateVendorStatusInput!): Vendor!
    updateVendorVerification(
      id: ID!
      input: UpdateVendorVerificationInput!
    ): Vendor!
    deleteVendor(id: ID!): Boolean!

    # Vendor application
    applyAsVendor(input: CreateVendorInput!): Vendor!
    updateVendorProfile(input: UpdateVendorInput!): Vendor!
  }

  extend type Subscription {
    # Vendor subscriptions
    vendorUpdated(vendorId: ID!): Vendor!
    vendorStatusChanged: Vendor!
    vendorApplicationReceived: Vendor!
  }
`;

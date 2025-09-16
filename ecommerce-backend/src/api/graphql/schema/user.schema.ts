/**
 * User GraphQL Schema
 * Defines types, queries, and mutations for user operations
 */

import { gql } from "graphql-tag";

export const userTypeDefs = gql`
  # User enums
  enum UserRole {
    CUSTOMER
    VENDOR
    ADMIN
    MODERATOR
  }

  enum UserStatus {
    ACTIVE
    INACTIVE
    SUSPENDED
    PENDING
  }

  # User types
  type User implements Node {
    id: ID!
    email: String!
    firstName: String
    lastName: String
    fullName: String
    role: UserRole!
    status: UserStatus!

    # Profile information
    phoneNumber: String
    dateOfBirth: DateTime
    bio: String
    avatar: String

    # Preferences
    language: String!
    timezone: String!
    emailNotifications: Boolean!
    smsNotifications: Boolean!

    # Authentication status
    emailVerified: Boolean!

    # Timestamps
    lastLoginAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relations
    vendor: Vendor
    orders: OrderConnection!
  }

  type UserConnection {
    edges: [UserEdge!]!
    nodes: [User!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  # User statistics
  type UserStats {
    total: Int!
    byRole: JSON!
    byStatus: JSON!
    verified: Int!
    unverified: Int!
  }

  # Input types
  input UserFiltersInput {
    email: String
    role: UserRole
    status: UserStatus
    emailVerified: Boolean
    search: String
  }

  input CreateUserInput {
    email: String!
    password: String!
    firstName: String
    lastName: String
    role: UserRole = CUSTOMER
    phoneNumber: String
    language: String = "en"
    timezone: String = "UTC"
  }

  input UpdateUserInput {
    firstName: String
    lastName: String
    phoneNumber: String
    dateOfBirth: DateTime
    bio: String
    avatar: String
    language: String
    timezone: String
    emailNotifications: Boolean
    smsNotifications: Boolean
  }

  input UpdateUserStatusInput {
    status: UserStatus!
  }

  # Authentication types
  type AuthPayload {
    user: User!
    accessToken: String!
    refreshToken: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input RegisterInput {
    email: String!
    password: String!
    firstName: String
    lastName: String
    phoneNumber: String
  }

  input ForgotPasswordInput {
    email: String!
  }

  input ResetPasswordInput {
    token: String!
    password: String!
  }

  # Extend root types
  extend type Query {
    # User queries
    user(id: ID!): User
    users(
      filters: UserFiltersInput
      pagination: PaginationInput
      sortBy: String = "createdAt"
      sortOrder: SortOrder = DESC
    ): UserConnection!

    # Current user
    me: User

    # User statistics (admin only)
    userStats: UserStats!
  }

  extend type Mutation {
    # Authentication
    login(input: LoginInput!): AuthPayload!
    register(input: RegisterInput!): AuthPayload!
    refreshToken(refreshToken: String!): AuthPayload!
    logout: Boolean!

    # Password management
    forgotPassword(input: ForgotPasswordInput!): Boolean!
    resetPassword(input: ResetPasswordInput!): Boolean!
    changePassword(currentPassword: String!, newPassword: String!): Boolean!

    # User management
    createUser(input: CreateUserInput!): User!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    updateUserStatus(id: ID!, input: UpdateUserStatusInput!): User!
    deleteUser(id: ID!): Boolean!

    # Profile management
    updateProfile(input: UpdateUserInput!): User!
    verifyEmail(token: String!): Boolean!
    resendEmailVerification: Boolean!
  }

  extend type Subscription {
    # User subscriptions
    userUpdated(userId: ID!): User!
    userStatusChanged: User!
  }
`;

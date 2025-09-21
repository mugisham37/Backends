/**
 * GraphQL Schema Index
 * Combines all schema definitions into a single schema
 */

import { gql } from "graphql-tag";
import { userTypeDefs } from "./user.schema.js";
import { vendorTypeDefs } from "./vendor.schema.js";
import { productTypeDefs } from "./product.schema.js";
import { orderTypeDefs } from "./order.schema.js";
import { analyticsTypeDefs } from "./analytics.schema.js";
import { webhookTypeDefs } from "./webhook.schema.js";
import { paymentTypeDefs } from "./payment.schema.js";

// Base schema with common types and root operations
const baseTypeDefs = gql`
  # Scalar types
  scalar DateTime
  scalar JSON
  scalar Decimal

  # Common enums
  enum SortOrder {
    ASC
    DESC
  }

  # Pagination types
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }

  # Common response types
  interface Node {
    id: ID!
  }

  type Query {
    # Health check
    health: String!

    # Node interface for Relay
    node(id: ID!): Node
  }

  type Mutation {
    # Placeholder - actual mutations defined in specific schemas
    _empty: String
  }

  type Subscription {
    # Placeholder - actual subscriptions defined in specific schemas
    _empty: String
  }
`;

// Combine all type definitions
export const typeDefs = [
  baseTypeDefs,
  userTypeDefs,
  vendorTypeDefs,
  productTypeDefs,
  orderTypeDefs,
  analyticsTypeDefs,
  webhookTypeDefs,
  paymentTypeDefs,
];

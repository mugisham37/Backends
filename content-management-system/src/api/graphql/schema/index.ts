import { gql } from "graphql-tag"
import { userTypeDefs } from "./user.schema"
import { contentTypeTypeDefs } from "./content-type.schema"
import { contentTypeDefs } from "./content.schema"
import { mediaTypeDefs } from "./media.schema"
import { workflowTypeDefs } from "./workflow.schema"
import { webhookTypeDefs } from "./webhook.schema"

// Base schema with common types and queries
const baseTypeDefs = gql`
  scalar DateTime
  scalar JSON
  scalar Upload

  type Query {
    _: Boolean
  }

  type Mutation {
    _: Boolean
  }

  type Subscription {
    _: Boolean
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  interface Node {
    id: ID!
  }

  interface Edge {
    cursor: String!
    node: Node!
  }

  interface Connection {
    edges: [Edge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  enum SortDirection {
    ASC
    DESC
  }

  input PaginationInput {
    first: Int
    after: String
    last: Int
    before: String
  }
`

// Combine all type definitions
export const typeDefs = [
  baseTypeDefs,
  userTypeDefs,
  contentTypeTypeDefs,
  contentTypeDefs,
  mediaTypeDefs,
  workflowTypeDefs,
  webhookTypeDefs,
]

/**
 * GraphQL Schema for Cache Module
 *
 * Defines types, queries, and mutations for cache management functionality.
 */

export const cacheSchema = `
  # Cache Statistics
  type CacheStats {
    totalKeys: Int!
    usedMemory: Float!
    hitRate: Float!
    missRate: Float!
    uptime: Float!
    connections: Int!
  }

  # Cache Health Status
  type CacheHealth {
    status: String!
    uptime: Float!
    latency: Float!
    memoryUsage: Float!
  }

  # Cache Entry
  type CacheEntry {
    key: String!
    value: JSON
    ttl: Int
    namespace: String
    tags: [String!]
  }

  # Session Data
  type Session {
    sessionId: String!
    data: JSON!
    expiresAt: DateTime!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # Input Types
  input SetCacheInput {
    key: String!
    value: JSON!
    ttl: Int
    namespace: String
    tags: [String!]
  }

  input CreateSessionInput {
    sessionId: String!
    data: JSON!
    options: SessionOptionsInput
  }

  input SessionOptionsInput {
    sliding: Boolean!
    secure: Boolean!
    ttl: Int
  }

  input UpdateSessionInput {
    data: JSON!
    extendTtl: Boolean!
  }

  # Response Types
  type CacheOperationResponse {
    success: Boolean!
    message: String!
  }

  type SessionResponse {
    sessionId: String!
    expiresAt: DateTime!
  }

  # Extend root types
  extend type Query {
    cacheStats(detailed: Boolean): CacheStats!
    cacheHealth: CacheHealth!
    cacheValue(key: String!, namespace: String): CacheEntry
    session(sessionId: String!): Session
  }

  extend type Mutation {
    setCacheValue(input: SetCacheInput!): CacheOperationResponse!
    deleteCacheValue(key: String!, namespace: String): CacheOperationResponse!
    createSession(input: CreateSessionInput!): SessionResponse!
    updateSession(sessionId: String!, input: UpdateSessionInput!): SessionResponse!
    deleteSession(sessionId: String!): CacheOperationResponse!
    clearCache(namespace: String): CacheOperationResponse!
  }
`;

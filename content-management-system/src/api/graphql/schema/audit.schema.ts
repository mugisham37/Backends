/**
 * GraphQL Schema for Audit Module
 *
 * Defines types, queries, and mutations for audit logging functionality.
 */

export const auditSchema = `
  # Audit Event Types
  enum AuditEventType {
    AUTH_ATTEMPT
    AUTH_SUCCESS
    AUTH_FAILURE
    SECURITY_EVENT
    TENANT_EVENT
    CONTENT_EVENT
    MEDIA_EVENT
    API_REQUEST
    SYSTEM_ERROR
    PERFORMANCE_METRICS
    USER_ACTION
    DATA_ACCESS
    CONFIGURATION_CHANGE
  }

  enum AuditSeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  # Audit Log Type
  type AuditLog {
    id: ID!
    type: AuditEventType!
    timestamp: DateTime!
    userId: ID
    user: User
    tenantId: ID
    tenant: Tenant
    sessionId: String
    ip: String
    userAgent: String
    resource: String
    action: String
    details: JSON!
    severity: AuditSeverity!
    tags: [String!]
    entity: AuditEntity
  }

  # Union type for audit entities
  union AuditEntity = Content | Media | User | Tenant

  # Audit Log List Response
  type AuditLogResponse {
    logs: [AuditLog!]!
    totalCount: Int!
    hasMore: Boolean!
  }

  # System Health Metrics
  type SystemHealthMetrics {
    timestamp: DateTime!
    cpu: CPUMetrics!
    memory: MemoryMetrics!
    disk: DiskMetrics!
    network: NetworkMetrics!
    uptime: Float!
  }

  type CPUMetrics {
    usage: Float!
    cores: Int!
    loadAverage: [Float!]!
  }

  type MemoryMetrics {
    total: Float!
    used: Float!
    free: Float!
    percentage: Float!
  }

  type DiskMetrics {
    total: Float!
    used: Float!
    free: Float!
    percentage: Float!
  }

  type NetworkMetrics {
    bytesIn: Float!
    bytesOut: Float!
    packetsIn: Float!
    packetsOut: Float!
  }

  # Input Types
  input AuditLogInput {
    action: String!
    resource: String
    details: JSON
    severity: AuditSeverity
  }

  input UserActionInput {
    action: String!
    resource: String
    details: JSON
    severity: AuditSeverity
  }

  # Operation Response
  type AuditOperationResponse {
    success: Boolean!
    message: String!
  }

  # Extend root types
  extend type Query {
    auditLogs(
      tenantId: ID
      entityType: String
      entityId: ID
      action: String
      userId: ID
      startDate: DateTime
      endDate: DateTime
      limit: Int
      type: AuditEventType
      severity: AuditSeverity
    ): AuditLogResponse!
    
    systemHealth: SystemHealthMetrics!
  }

  extend type Mutation {
    logUserAction(input: UserActionInput!): AuditOperationResponse!
  }
`;

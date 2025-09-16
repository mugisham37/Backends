export interface AuditLog {
  id: string;
  action: AuditAction;
  resource: string;
  resourceId: string;
  userId?: string;
  tenantId?: string;
  metadata: AuditMetadata;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface CreateAuditLogData {
  action: AuditAction;
  resource: string;
  resourceId: string;
  userId?: string;
  tenantId?: string;
  metadata?: Partial<AuditMetadata>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditMetadata {
  changes?: Record<string, { from: any; to: any }>;
  additionalData?: Record<string, any>;
  requestId?: string;
  sessionId?: string;
}

export enum AuditAction {
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
  LOGIN = "login",
  LOGOUT = "logout",
  UPLOAD = "upload",
  DOWNLOAD = "download",
  PUBLISH = "publish",
  UNPUBLISH = "unpublish",
}

export interface AuditFilter {
  action?: AuditAction[];
  resource?: string[];
  userId?: string;
  tenantId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  ipAddress?: string;
}

export interface AuditSearchOptions {
  filters?: AuditFilter;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface AuditStats {
  totalLogs: number;
  actionCounts: Record<AuditAction, number>;
  resourceCounts: Record<string, number>;
  dailyActivity: Array<{ date: Date; count: number }>;
}

export interface AuditConfig {
  retentionDays: number;
  batchSize: number;
  enabledActions: AuditAction[];
  enabledResources: string[];
}

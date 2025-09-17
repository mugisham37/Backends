export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  status: WebhookStatus;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum WebhookStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  FAILED = "failed",
}

export interface CreateWebhookData {
  name: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  tenantId?: string;
}

export interface UpdateWebhookData {
  name?: string;
  url?: string;
  events?: WebhookEvent[];
  secret?: string;
  status?: WebhookStatus;
}

export enum WebhookEvent {
  CONTENT_CREATED = "content.created",
  CONTENT_UPDATED = "content.updated",
  CONTENT_DELETED = "content.deleted",
  CONTENT_PUBLISHED = "content.published",
  MEDIA_UPLOADED = "media.uploaded",
  MEDIA_DELETED = "media.deleted",
  USER_CREATED = "user.created",
  USER_UPDATED = "user.updated",
  USER_DELETED = "user.deleted",
}

export interface WebhookPayload {
  event: WebhookEvent;
  data: any;
  timestamp: Date;
  tenantId: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  payload: any;
  success: boolean;
  statusCode?: number;
  response?: string;
  error?: string;
  attempt: number;
  deliveredAt?: Date;
  createdAt: Date;
}

export enum WebhookDeliveryStatus {
  PENDING = "pending",
  SUCCESS = "success",
  FAILED = "failed",
  RETRYING = "retrying",
}

export interface WebhookResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  duration: number;
}

export interface WebhookConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  signatureHeader: string;
}

export interface WebhookJobData {
  webhookId: string;
  event: string;
  payload: any;
  url: string;
  secret?: string;
  attempt: number;
}

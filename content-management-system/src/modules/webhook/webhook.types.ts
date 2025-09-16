export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  active: boolean;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWebhookData {
  url: string;
  events: WebhookEvent[];
  secret?: string;
  tenantId: string;
}

export interface UpdateWebhookData {
  url?: string;
  events?: WebhookEvent[];
  secret?: string;
  active?: boolean;
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
  payload: WebhookPayload;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastAttempt?: Date;
  nextAttempt?: Date;
  response?: WebhookResponse;
  createdAt: Date;
  updatedAt: Date;
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

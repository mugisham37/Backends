import mongoose, { type Document, Schema } from "mongoose"

// Webhook event enum
export enum WebhookEvent {
  CONTENT_CREATED = "content_created",
  CONTENT_UPDATED = "content_updated",
  CONTENT_DELETED = "content_deleted",
  CONTENT_PUBLISHED = "content_published",
  CONTENT_UNPUBLISHED = "content_unpublished",
  CONTENT_ARCHIVED = "content_archived",
  MEDIA_UPLOADED = "media_uploaded",
  MEDIA_UPDATED = "media_updated",
  MEDIA_DELETED = "media_deleted",
  USER_CREATED = "user_created",
  USER_UPDATED = "user_updated",
  USER_DELETED = "user_deleted",
  WORKFLOW_STARTED = "workflow_started",
  WORKFLOW_COMPLETED = "workflow_completed",
  WORKFLOW_STEP_COMPLETED = "workflow_step_completed",
}

// Webhook status enum
export enum WebhookStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

// Webhook delivery interface
export interface IWebhookDelivery extends Document {
  webhook: IWebhook | string
  timestamp: Date
  success: boolean
  statusCode?: number
  request: string
  response?: string
  error?: string
}

// Webhook interface
export interface IWebhook extends Document {
  name: string
  url: string
  secret?: string
  events: WebhookEvent[]
  status: WebhookStatus
  contentTypeIds?: string[]
  createdAt: Date
  updatedAt: Date
}

// Webhook delivery schema
const webhookDeliverySchema = new Schema<IWebhookDelivery>(
  {
    webhook: {
      type: Schema.Types.ObjectId,
      ref: "Webhook",
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    success: {
      type: Boolean,
      required: true,
    },
    statusCode: {
      type: Number,
    },
    request: {
      type: String,
      required: true,
    },
    response: {
      type: String,
    },
    error: {
      type: String,
    },
  },
  { timestamps: false },
)

// Webhook schema
const webhookSchema = new Schema<IWebhook>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    secret: {
      type: String,
      trim: true,
    },
    events: {
      type: [String],
      enum: Object.values(WebhookEvent),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(WebhookStatus),
      default: WebhookStatus.ACTIVE,
    },
    contentTypeIds: {
      type: [Schema.Types.ObjectId],
      ref: "ContentType",
    },
  },
  {
    timestamps: true,
  },
)

// Create and export the models
export const WebhookModel = mongoose.model<IWebhook>("Webhook", webhookSchema)
export const WebhookDeliveryModel = mongoose.model<IWebhookDelivery>("WebhookDelivery", webhookDeliverySchema)

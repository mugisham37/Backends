import mongoose, { type Document, Schema } from "mongoose"

// Route method enum
export enum RouteMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE",
  OPTIONS = "OPTIONS",
  HEAD = "HEAD",
  ALL = "ALL",
}

// Route status enum
export enum RouteStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  DEPRECATED = "deprecated",
}

// Route interface
export interface IRoute extends Document {
  path: string
  method: RouteMethod
  target: string
  status: RouteStatus
  description?: string
  isPublic: boolean
  rateLimit?: {
    limit: number
    window: number // in seconds
  }
  caching?: {
    enabled: boolean
    ttl: number // in seconds
  }
  transformation?: {
    request?: string // JavaScript code for request transformation
    response?: string // JavaScript code for response transformation
  }
  tenantId?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

// Route schema
const routeSchema = new Schema<IRoute>(
  {
    path: {
      type: String,
      required: true,
      trim: true,
    },
    method: {
      type: String,
      enum: Object.values(RouteMethod),
      required: true,
    },
    target: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(RouteStatus),
      default: RouteStatus.ACTIVE,
    },
    description: {
      type: String,
      trim: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    rateLimit: {
      limit: {
        type: Number,
        min: 1,
      },
      window: {
        type: Number,
        min: 1,
      },
    },
    caching: {
      enabled: {
        type: Boolean,
        default: false,
      },
      ttl: {
        type: Number,
        min: 1,
        default: 60,
      },
    },
    transformation: {
      request: String,
      response: String,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
    },
  },
  {
    timestamps: true,
  },
)

// Compound index for uniqueness
routeSchema.index({ path: 1, method: 1, tenantId: 1 }, { unique: true, sparse: true })

// Create and export the model
export const RouteModel = mongoose.model<IRoute>("Route", routeSchema)

import mongoose, { Schema, type Document } from "mongoose"

export enum ApiKeyScope {
  READ = "read",
  WRITE = "write",
  ADMIN = "admin",
}

export interface IApiKey extends Document {
  name: string
  key: string
  scopes: ApiKeyScope[]
  expiresAt?: Date
  lastUsedAt?: Date
  createdBy: mongoose.Types.ObjectId
  tenantId?: mongoose.Types.ObjectId
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const apiKeySchema = new Schema<IApiKey>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    scopes: {
      type: [String],
      enum: Object.values(ApiKeyScope),
      default: [ApiKeyScope.READ],
    },
    expiresAt: {
      type: Date,
    },
    lastUsedAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes
apiKeySchema.index({ key: 1 }, { unique: true })
apiKeySchema.index({ tenantId: 1, name: 1 }, { unique: true, sparse: true })

export const ApiKeyModel = mongoose.model<IApiKey>("ApiKey", apiKeySchema)

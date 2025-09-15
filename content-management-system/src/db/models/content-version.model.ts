import mongoose, { Schema, type Document } from "mongoose"

// Content version interface
export interface IContentVersion extends Document {
  contentId: mongoose.Types.ObjectId
  version: number
  data: any
  status: string
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  publishedAt?: Date
  publishedBy?: mongoose.Types.ObjectId
  notes?: string
}

// Content version schema
const contentVersionSchema = new Schema<IContentVersion>(
  {
    contentId: {
      type: Schema.Types.ObjectId,
      ref: "Content",
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    publishedAt: {
      type: Date,
    },
    publishedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
)

// Create a compound index for contentId and version
contentVersionSchema.index({ contentId: 1, version: 1 }, { unique: true })

// Create model
export const ContentVersionModel = mongoose.model<IContentVersion>("ContentVersion", contentVersionSchema)

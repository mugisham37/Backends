import mongoose, { type Document, Schema } from "mongoose"
import type { IUser } from "./user.model"

// Media type enum
export enum MediaType {
  IMAGE = "image",
  VIDEO = "video",
  DOCUMENT = "document",
  AUDIO = "audio",
  OTHER = "other",
}

// Media metadata interface
export interface IMediaMetadata {
  width?: number
  height?: number
  size?: number
  duration?: number
  format?: string
  pages?: number
}

// Media interface
export interface IMedia extends Document {
  filename: string
  originalFilename: string
  mimeType: string
  type: MediaType
  size: number
  url: string
  thumbnailUrl?: string
  metadata?: IMediaMetadata
  alt?: string
  title?: string
  description?: string
  tags?: string[]
  folder?: string
  createdAt: Date
  createdBy?: IUser | string
  updatedAt: Date
}

// Media metadata schema
const mediaMetadataSchema = new Schema<IMediaMetadata>(
  {
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    size: {
      type: Number,
    },
    duration: {
      type: Number,
    },
    format: {
      type: String,
    },
    pages: {
      type: Number,
    },
  },
  { _id: false },
)

// Media schema
const mediaSchema = new Schema<IMedia>(
  {
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    originalFilename: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(MediaType),
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
    },
    metadata: {
      type: mediaMetadataSchema,
    },
    alt: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    folder: {
      type: String,
      default: "/",
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
)

// Create and export the model
export const MediaModel = mongoose.model<IMedia>("Media", mediaSchema)

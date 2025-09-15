import mongoose, { type Document, Schema } from "mongoose"
import type { IContentType } from "./content-type.model"
import type { IUser } from "./user.model"

// Content status enum
export enum ContentStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
  ARCHIVED = "archived",
}

// Content version interface
export interface IContentVersion extends Document {
  version: number
  data: any
  createdAt: Date
  createdBy?: IUser
  comment?: string
}

// Content interface
export interface IContent extends Document {
  contentType: IContentType | string
  data: any
  status: ContentStatus
  locale: string
  slug?: string
  publishedAt?: Date
  publishedBy?: IUser | string
  createdAt: Date
  createdBy?: IUser | string
  updatedAt: Date
  updatedBy?: IUser | string
  versions: IContentVersion[]
}

// Content version schema
const contentVersionSchema = new Schema<IContentVersion>(
  {
    version: {
      type: Number,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    comment: {
      type: String,
      trim: true,
    },
  },
  { _id: true },
)

// Content schema
const contentSchema = new Schema<IContent>(
  {
    contentType: {
      type: Schema.Types.ObjectId,
      ref: "ContentType",
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ContentStatus),
      default: ContentStatus.DRAFT,
    },
    locale: {
      type: String,
      default: "en",
      required: true,
    },
    slug: {
      type: String,
      trim: true,
      sparse: true,
    },
    publishedAt: {
      type: Date,
    },
    publishedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    versions: {
      type: [contentVersionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
)

// Compound index for unique slugs per content type and locale
contentSchema.index({ contentType: 1, slug: 1, locale: 1 }, { unique: true, sparse: true })

// Middleware to create a new version on save
contentSchema.pre("save", async function (next) {
  // Only create a new version if data has changed
  if (this.isModified("data")) {
    const versionNumber = this.versions.length > 0 ? this.versions[this.versions.length - 1].version + 1 : 1

    this.versions.push({
      version: versionNumber,
      data: this.data,
      createdAt: new Date(),
      createdBy: this.updatedBy,
    } as IContentVersion)

    // Limit versions to 100 (configurable)
    const maxVersions = 100
    if (this.versions.length > maxVersions) {
      this.versions = this.versions.slice(-maxVersions)
    }
  }

  next()
})

// Create and export the model
export const ContentModel = mongoose.model<IContent>("Content", contentSchema)

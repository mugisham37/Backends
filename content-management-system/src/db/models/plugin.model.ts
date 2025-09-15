import mongoose, { type Document, Schema } from "mongoose"

// Plugin status
export enum PluginStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  ERROR = "error",
}

// Plugin interface
export interface IPlugin extends Document {
  name: string
  slug: string
  description?: string
  version: string
  author?: string
  repository?: string
  homepage?: string
  license?: string
  main: string
  status: PluginStatus
  isSystem: boolean
  config: Record<string, any>
  hooks: string[]
  dependencies: Record<string, string>
  installedAt: Date
  updatedAt: Date
  lastEnabledAt?: Date
  lastDisabledAt?: Date
  lastErrorAt?: Date
  errorMessage?: string
}

// Plugin schema
const pluginSchema = new Schema<IPlugin>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    version: {
      type: String,
      required: true,
    },
    author: {
      type: String,
    },
    repository: {
      type: String,
    },
    homepage: {
      type: String,
    },
    license: {
      type: String,
    },
    main: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PluginStatus),
      default: PluginStatus.INACTIVE,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    config: {
      type: Schema.Types.Mixed,
      default: {},
    },
    hooks: {
      type: [String],
      default: [],
    },
    dependencies: {
      type: Schema.Types.Mixed,
      default: {},
    },
    installedAt: {
      type: Date,
      default: Date.now,
    },
    lastEnabledAt: {
      type: Date,
    },
    lastDisabledAt: {
      type: Date,
    },
    lastErrorAt: {
      type: Date,
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
)

// Pre-save hook to ensure slug uniqueness
pluginSchema.pre("save", async function (next) {
  if (this.isNew || this.isModified("name")) {
    // Generate slug from name if not provided
    if (!this.slug) {
      this.slug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    }

    // Check if slug already exists
    const PluginModel = mongoose.model<IPlugin>("Plugin")
    const existingPlugin = await PluginModel.findOne({ slug: this.slug, _id: { $ne: this._id } })

    if (existingPlugin) {
      // Append a random string to make the slug unique
      const randomString = Math.random().toString(36).substring(2, 8)
      this.slug = `${this.slug}-${randomString}`
    }
  }

  next()
})

// Create and export the model
export const PluginModel = mongoose.model<IPlugin>("Plugin", pluginSchema)

import mongoose, { type Document, Schema } from "mongoose"

// Tenant plan types
export enum TenantPlan {
  FREE = "free",
  BASIC = "basic",
  PROFESSIONAL = "professional",
  ENTERPRISE = "enterprise",
}

// Tenant status
export enum TenantStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  PENDING = "pending",
  ARCHIVED = "archived",
}

// Tenant user role
export enum TenantUserRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
}

// Tenant user interface
export interface ITenantUser {
  userId: mongoose.Types.ObjectId
  role: TenantUserRole
  addedAt: Date
  invitedBy?: mongoose.Types.ObjectId
  status: "active" | "invited" | "removed"
}

// Tenant usage limits interface
export interface ITenantUsageLimits {
  maxUsers: number
  maxStorage: number // in MB
  maxContentTypes: number
  maxContents: number
  maxApiRequests: number // per month
  maxWebhooks: number
  maxWorkflows: number
}

// Tenant usage interface
export interface ITenantUsage {
  users: number
  storage: number // in MB
  contentTypes: number
  contents: number
  apiRequests: number
  webhooks: number
  workflows: number
  lastUpdated: Date
}

// Tenant settings interface
export interface ITenantSettings {
  defaultLocale: string
  supportedLocales: string[]
  timezone: string
  dateFormat: string
  timeFormat: string
  currency: string
  securitySettings: {
    mfaRequired: boolean
    passwordPolicy: {
      minLength: number
      requireUppercase: boolean
      requireLowercase: boolean
      requireNumbers: boolean
      requireSpecialChars: boolean
      preventPasswordReuse: number
      expiryDays: number
    }
    sessionTimeout: number // in minutes
    ipRestrictions: string[]
  }
  customDomain?: string
  customBranding?: {
    logo?: string
    favicon?: string
    primaryColor?: string
    secondaryColor?: string
    accentColor?: string
  }
}

// Tenant interface
export interface ITenant extends Document {
  name: string
  slug: string
  description?: string
  plan: TenantPlan
  status: TenantStatus
  users: ITenantUser[]
  usageLimits: ITenantUsageLimits
  currentUsage: ITenantUsage
  settings: ITenantSettings
  billingInfo?: {
    contactEmail: string
    contactName: string
    company?: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
    vatId?: string
  }
  createdAt: Date
  updatedAt: Date
}

// Tenant schema
const tenantSchema = new Schema<ITenant>(
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
    plan: {
      type: String,
      enum: Object.values(TenantPlan),
      default: TenantPlan.FREE,
    },
    status: {
      type: String,
      enum: Object.values(TenantStatus),
      default: TenantStatus.ACTIVE,
    },
    users: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: Object.values(TenantUserRole),
          required: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
        invitedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["active", "invited", "removed"],
          default: "active",
        },
      },
    ],
    usageLimits: {
      maxUsers: {
        type: Number,
        default: 3, // Default for free plan
      },
      maxStorage: {
        type: Number,
        default: 100, // 100 MB for free plan
      },
      maxContentTypes: {
        type: Number,
        default: 5, // Default for free plan
      },
      maxContents: {
        type: Number,
        default: 100, // Default for free plan
      },
      maxApiRequests: {
        type: Number,
        default: 1000, // Default for free plan
      },
      maxWebhooks: {
        type: Number,
        default: 2, // Default for free plan
      },
      maxWorkflows: {
        type: Number,
        default: 1, // Default for free plan
      },
    },
    currentUsage: {
      users: {
        type: Number,
        default: 1, // Start with one user (the creator)
      },
      storage: {
        type: Number,
        default: 0,
      },
      contentTypes: {
        type: Number,
        default: 0,
      },
      contents: {
        type: Number,
        default: 0,
      },
      apiRequests: {
        type: Number,
        default: 0,
      },
      webhooks: {
        type: Number,
        default: 0,
      },
      workflows: {
        type: Number,
        default: 0,
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },
    settings: {
      defaultLocale: {
        type: String,
        default: "en",
      },
      supportedLocales: {
        type: [String],
        default: ["en"],
      },
      timezone: {
        type: String,
        default: "UTC",
      },
      dateFormat: {
        type: String,
        default: "YYYY-MM-DD",
      },
      timeFormat: {
        type: String,
        default: "HH:mm:ss",
      },
      currency: {
        type: String,
        default: "USD",
      },
      securitySettings: {
        mfaRequired: {
          type: Boolean,
          default: false,
        },
        passwordPolicy: {
          minLength: {
            type: Number,
            default: 8,
          },
          requireUppercase: {
            type: Boolean,
            default: false,
          },
          requireLowercase: {
            type: Boolean,
            default: false,
          },
          requireNumbers: {
            type: Boolean,
            default: false,
          },
          requireSpecialChars: {
            type: Boolean,
            default: false,
          },
          preventPasswordReuse: {
            type: Number,
            default: 0,
          },
          expiryDays: {
            type: Number,
            default: 0, // 0 means never expires
          },
        },
        sessionTimeout: {
          type: Number,
          default: 60, // 60 minutes
        },
        ipRestrictions: {
          type: [String],
          default: [],
        },
      },
      customDomain: {
        type: String,
      },
      customBranding: {
        logo: {
          type: String,
        },
        favicon: {
          type: String,
        },
        primaryColor: {
          type: String,
        },
        secondaryColor: {
          type: String,
        },
        accentColor: {
          type: String,
        },
      },
    },
    billingInfo: {
      contactEmail: {
        type: String,
      },
      contactName: {
        type: String,
      },
      company: {
        type: String,
      },
      address: {
        type: String,
      },
      city: {
        type: String,
      },
      state: {
        type: String,
      },
      zipCode: {
        type: String,
      },
      country: {
        type: String,
      },
      vatId: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
  },
)

// Pre-save hook to ensure slug uniqueness
tenantSchema.pre("save", async function (next) {
  if (this.isNew || this.isModified("name")) {
    // Generate slug from name if not provided
    if (!this.slug) {
      this.slug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    }

    // Check if slug already exists
    const TenantModel = mongoose.model<ITenant>("Tenant")
    const existingTenant = await TenantModel.findOne({ slug: this.slug, _id: { $ne: this._id } })

    if (existingTenant) {
      // Append a random string to make the slug unique
      const randomString = Math.random().toString(36).substring(2, 8)
      this.slug = `${this.slug}-${randomString}`
    }
  }

  next()
})

// Create and export the model
export const TenantModel = mongoose.model<ITenant>("Tenant", tenantSchema)

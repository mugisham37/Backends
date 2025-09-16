import mongoose from "mongoose"

// Define variant schema
const variantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Variant name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    trafficAllocation: {
      type: Number,
      required: [true, "Traffic allocation is required"],
      min: [0, "Traffic allocation cannot be negative"],
      max: [100, "Traffic allocation cannot exceed 100"],
      default: 50,
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false },
)

// Define A/B test schema
const abTestSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Test name is required"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Test type is required"],
      enum: ["product", "category", "checkout", "homepage", "other"],
    },
    status: {
      type: String,
      required: [true, "Test status is required"],
      enum: ["draft", "running", "paused", "completed"],
      default: "draft",
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    variants: {
      type: [variantSchema],
      validate: {
        validator: (variants: any[]) => {
          // Must have at least 2 variants
          if (variants.length < 2) {
            return false
          }

          // Total traffic allocation must be 100%
          const totalAllocation = variants.reduce((sum, variant) => sum + variant.trafficAllocation, 0)
          return totalAllocation === 100
        },
        message: "Must have at least 2 variants and total traffic allocation must be 100%",
      },
    },
    targetAudience: {
      type: {
        type: String,
        enum: ["all", "newUsers", "returningUsers", "specificUsers"],
        default: "all",
      },
      userIds: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "User",
        default: [],
      },
    },
    goals: {
      primary: {
        type: String,
        required: [true, "Primary goal is required"],
        enum: ["conversion", "revenue", "engagement", "retention", "other"],
      },
      secondary: {
        type: [String],
        enum: ["conversion", "revenue", "engagement", "retention", "other"],
        default: [],
      },
    },
    results: {
      impressions: {
        type: Map,
        of: Number,
        default: new Map(),
      },
      conversions: {
        type: Map,
        of: Number,
        default: new Map(),
      },
      revenue: {
        type: Map,
        of: Number,
        default: new Map(),
      },
      engagements: {
        type: Map,
        of: Number,
        default: new Map(),
      },
    },
    winner: {
      type: String,
    },
  },
  { timestamps: true },
)

// Define user test assignment schema
const userTestAssignmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ABTest",
      required: [true, "Test is required"],
    },
    variant: {
      type: String,
      required: [true, "Variant is required"],
    },
    impressions: {
      type: Number,
      default: 0,
    },
    conversions: {
      type: Number,
      default: 0,
    },
    revenue: {
      type: Number,
      default: 0,
    },
    engagements: {
      type: Number,
      default: 0,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
)

// Create compound index for user and test
userTestAssignmentSchema.index({ user: 1, test: 1 }, { unique: true })

// Create models
const ABTest = mongoose.model("ABTest", abTestSchema)
const UserTestAssignment = mongoose.model("UserTestAssignment", userTestAssignmentSchema)

export { ABTest, UserTestAssignment }

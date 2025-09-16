import mongoose, { Schema, type Document } from "mongoose";

// Loyalty Tier Schema
export interface ILoyaltyTier extends Document {
  name: string;
  level: number;
  pointsThreshold: number;
  benefits: string[];
  discountPercentage: number;
  active: boolean;
  color: string;
  icon?: string;
}

const LoyaltyTierSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    level: {
      type: Number,
      required: true,
      min: 1,
      unique: true,
    },
    pointsThreshold: {
      type: Number,
      required: true,
      min: 0,
    },
    benefits: {
      type: [String],
      default: [],
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    active: {
      type: Boolean,
      default: true,
    },
    color: {
      type: String,
      default: "#000000",
    },
    icon: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Reward Schema
export interface IReward extends Document {
  name: string;
  description: string;
  pointsCost: number;
  requiredTier?: mongoose.Types.ObjectId;
  active: boolean;
  startDate?: Date;
  endDate?: Date;
  limitPerCustomer?: number;
  limitTotal?: number;
  redemptionCount: number;
  redemptionExpiryDays?: number;
  image?: string;
  type: "discount" | "freeProduct" | "freeShipping" | "giftCard" | "other";
  value?: number;
  code?: string;
}

const RewardSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    pointsCost: {
      type: Number,
      required: true,
      min: 1,
    },
    requiredTier: {
      type: Schema.Types.ObjectId,
      ref: "LoyaltyTier",
    },
    active: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    limitPerCustomer: {
      type: Number,
      min: 1,
    },
    limitTotal: {
      type: Number,
      min: 1,
    },
    redemptionCount: {
      type: Number,
      default: 0,
    },
    redemptionExpiryDays: {
      type: Number,
      min: 1,
    },
    image: {
      type: String,
    },
    type: {
      type: String,
      enum: ["discount", "freeProduct", "freeShipping", "giftCard", "other"],
      default: "other",
    },
    value: {
      type: Number,
    },
    code: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Redemption Schema
export interface IRedemption extends Document {
  user: mongoose.Types.ObjectId;
  reward: mongoose.Types.ObjectId;
  code: string;
  status: "pending" | "approved" | "rejected" | "used" | "expired";
  pointsUsed: number;
  expiresAt?: Date;
  usedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  expiredAt?: Date;
  notes?: string;
}

const RedemptionSchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reward: {
      type: Schema.Types.ObjectId,
      ref: "Reward",
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "used", "expired"],
      default: "pending",
    },
    pointsUsed: {
      type: Number,
      required: true,
      min: 1,
    },
    expiresAt: {
      type: Date,
    },
    usedAt: {
      type: Date,
    },
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    expiredAt: {
      type: Date,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Loyalty Program Schema
export interface ILoyaltyProgram extends Document {
  user: mongoose.Types.ObjectId;
  tier: mongoose.Types.ObjectId;
  points: number;
  lifetimePoints: number;
  referralCode: string;
  referredBy?: mongoose.Types.ObjectId;
}

const LoyaltyProgramSchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    tier: {
      type: Schema.Types.ObjectId,
      ref: "LoyaltyTier",
      required: true,
    },
    points: {
      type: Number,
      default: 0,
      min: 0,
    },
    lifetimePoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    referralCode: {
      type: String,
      required: true,
      unique: true,
    },
    referredBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Loyalty History Schema
export interface ILoyaltyHistory extends Document {
  user: mongoose.Types.ObjectId;
  type: "order" | "referral" | "redemption" | "manual" | "expire" | "other";
  points: number;
  description: string;
  order?: mongoose.Types.ObjectId;
  redemption?: mongoose.Types.ObjectId;
  referredUser?: mongoose.Types.ObjectId;
  processed?: boolean;
}

const LoyaltyHistorySchema: Schema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["order", "referral", "redemption", "manual", "expire", "other"],
      required: true,
    },
    points: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
    redemption: {
      type: Schema.Types.ObjectId,
      ref: "Redemption",
    },
    referredUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    processed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes
LoyaltyProgramSchema.index({ user: 1 }, { unique: true });
LoyaltyProgramSchema.index({ referralCode: 1 }, { unique: true });
RedemptionSchema.index({ code: 1 }, { unique: true });
RedemptionSchema.index({ user: 1, reward: 1 });
LoyaltyHistorySchema.index({ user: 1, createdAt: -1 });

// Create models
export const LoyaltyTier = mongoose.model<ILoyaltyTier>("LoyaltyTier", LoyaltyTierSchema);
export const Reward = mongoose.model<IReward>("Reward", RewardSchema);
export const Redemption = mongoose.model<IRedemption>("Redemption", RedemptionSchema);
export const LoyaltyProgram = mongoose.model<ILoyaltyProgram>(
  "LoyaltyProgram",
  LoyaltyProgramSchema
);
export const LoyaltyHistory = mongoose.model<ILoyaltyHistory>(
  "LoyaltyHistory",
  LoyaltyHistorySchema
);

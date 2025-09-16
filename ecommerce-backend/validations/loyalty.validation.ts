import Joi from "joi";

// Create loyalty tier schema
export const createLoyaltyTierSchema = {
  body: Joi.object({
    name: Joi.string().required().trim().min(2).max(50).messages({
      "string.empty": "Tier name is required",
      "string.min": "Tier name must be at least 2 characters",
      "string.max": "Tier name cannot exceed 50 characters",
      "any.required": "Tier name is required",
    }),
    level: Joi.number().integer().min(1).required().messages({
      "number.base": "Level must be a number",
      "number.integer": "Level must be an integer",
      "number.min": "Level must be at least 1",
      "any.required": "Level is required",
    }),
    pointsThreshold: Joi.number().integer().min(0).required().messages({
      "number.base": "Points threshold must be a number",
      "number.integer": "Points threshold must be an integer",
      "number.min": "Points threshold must be at least 0",
      "any.required": "Points threshold is required",
    }),
    benefits: Joi.array().items(Joi.string().trim()).default([]),
    discountPercentage: Joi.number().min(0).max(100).default(0).messages({
      "number.base": "Discount percentage must be a number",
      "number.min": "Discount percentage must be at least 0",
      "number.max": "Discount percentage cannot exceed 100",
    }),
    active: Joi.boolean().default(true),
    color: Joi.string()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .default("#000000")
      .messages({
        "string.pattern.base": "Color must be a valid hex color code (e.g., #FF5733)",
      }),
    icon: Joi.string().trim().allow(null, ""),
  }),
};

// Update loyalty tier schema
export const updateLoyaltyTierSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(50).messages({
      "string.min": "Tier name must be at least 2 characters",
      "string.max": "Tier name cannot exceed 50 characters",
    }),
    level: Joi.number().integer().min(1).messages({
      "number.base": "Level must be a number",
      "number.integer": "Level must be an integer",
      "number.min": "Level must be at least 1",
    }),
    pointsThreshold: Joi.number().integer().min(0).messages({
      "number.base": "Points threshold must be a number",
      "number.integer": "Points threshold must be an integer",
      "number.min": "Points threshold must be at least 0",
    }),
    benefits: Joi.array().items(Joi.string().trim()),
    discountPercentage: Joi.number().min(0).max(100).messages({
      "number.base": "Discount percentage must be a number",
      "number.min": "Discount percentage must be at least 0",
      "number.max": "Discount percentage cannot exceed 100",
    }),
    active: Joi.boolean(),
    color: Joi.string()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .messages({
        "string.pattern.base": "Color must be a valid hex color code (e.g., #FF5733)",
      }),
    icon: Joi.string().trim().allow(null, ""),
  }),
};

// Create reward schema
export const createRewardSchema = {
  body: Joi.object({
    name: Joi.string().required().trim().min(2).max(100).messages({
      "string.empty": "Reward name is required",
      "string.min": "Reward name must be at least 2 characters",
      "string.max": "Reward name cannot exceed 100 characters",
      "any.required": "Reward name is required",
    }),
    description: Joi.string().required().trim().min(10).messages({
      "string.empty": "Reward description is required",
      "string.min": "Reward description must be at least 10 characters",
      "any.required": "Reward description is required",
    }),
    pointsCost: Joi.number().integer().min(1).required().messages({
      "number.base": "Points cost must be a number",
      "number.integer": "Points cost must be an integer",
      "number.min": "Points cost must be at least 1",
      "any.required": "Points cost is required",
    }),
    requiredTier: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .allow(null, "")
      .messages({
        "string.pattern.base": "Required tier must be a valid ID",
      }),
    type: Joi.string()
      .valid("discount", "freeProduct", "freeShipping", "giftCard", "other")
      .default("other")
      .messages({
        "any.only": "Type must be one of: discount, freeProduct, freeShipping, giftCard, other",
      }),
    value: Joi.number().min(0).allow(null).messages({
      "number.base": "Value must be a number",
      "number.min": "Value must be at least 0",
    }),
    code: Joi.string().trim().allow(null, ""),
    active: Joi.boolean().default(true),
    startDate: Joi.date().allow(null),
    endDate: Joi.date().greater(Joi.ref("startDate")).allow(null).messages({
      "date.greater": "End date must be greater than start date",
    }),
    limitPerCustomer: Joi.number().integer().min(1).allow(null).messages({
      "number.base": "Limit per customer must be a number",
      "number.integer": "Limit per customer must be an integer",
      "number.min": "Limit per customer must be at least 1",
    }),
    limitTotal: Joi.number().integer().min(1).allow(null).messages({
      "number.base": "Total limit must be a number",
      "number.integer": "Total limit must be an integer",
      "number.min": "Total limit must be at least 1",
    }),
    redemptionExpiryDays: Joi.number().integer().min(1).allow(null).messages({
      "number.base": "Redemption expiry days must be a number",
      "number.integer": "Redemption expiry days must be an integer",
      "number.min": "Redemption expiry days must be at least 1",
    }),
    image: Joi.string().trim().allow(null, ""),
  }),
};

// Update reward schema
export const updateRewardSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(100).messages({
      "string.min": "Reward name must be at least 2 characters",
      "string.max": "Reward name cannot exceed 100 characters",
    }),
    description: Joi.string().trim().min(10).messages({
      "string.min": "Reward description must be at least 10 characters",
    }),
    pointsCost: Joi.number().integer().min(1).messages({
      "number.base": "Points cost must be a number",
      "number.integer": "Points cost must be an integer",
      "number.min": "Points cost must be at least 1",
    }),
    requiredTier: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .allow(null, "")
      .messages({
        "string.pattern.base": "Required tier must be a valid ID",
      }),
    type: Joi.string()
      .valid("discount", "freeProduct", "freeShipping", "giftCard", "other")
      .messages({
        "any.only": "Type must be one of: discount, freeProduct, freeShipping, giftCard, other",
      }),
    value: Joi.number().min(0).allow(null).messages({
      "number.base": "Value must be a number",
      "number.min": "Value must be at least 0",
    }),
    code: Joi.string().trim().allow(null, ""),
    active: Joi.boolean(),
    startDate: Joi.date().allow(null),
    endDate: Joi.date().greater(Joi.ref("startDate")).allow(null).messages({
      "date.greater": "End date must be greater than start date",
    }),
    limitPerCustomer: Joi.number().integer().min(1).allow(null).messages({
      "number.base": "Limit per customer must be a number",
      "number.integer": "Limit per customer must be an integer",
      "number.min": "Limit per customer must be at least 1",
    }),
    limitTotal: Joi.number().integer().min(1).allow(null).messages({
      "number.base": "Total limit must be a number",
      "number.integer": "Total limit must be an integer",
      "number.min": "Total limit must be at least 1",
    }),
    redemptionExpiryDays: Joi.number().integer().min(1).allow(null).messages({
      "number.base": "Redemption expiry days must be a number",
      "number.integer": "Redemption expiry days must be an integer",
      "number.min": "Redemption expiry days must be at least 1",
    }),
    image: Joi.string().trim().allow(null, ""),
  }),
};

// Redeem reward schema
export const redeemRewardSchema = {
  body: Joi.object({
    rewardId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.empty": "Reward ID is required",
        "string.pattern.base": "Reward ID must be a valid ID",
        "any.required": "Reward ID is required",
      }),
  }),
};

// Apply referral code schema
export const applyReferralCodeSchema = {
  body: Joi.object({
    referralCode: Joi.string().required().messages({
      "string.empty": "Referral code is required",
      "any.required": "Referral code is required",
    }),
  }),
};

// Update redemption status schema
export const updateRedemptionStatusSchema = {
  body: Joi.object({
    status: Joi.string()
      .valid("pending", "approved", "rejected", "used", "expired")
      .required()
      .messages({
        "string.empty": "Status is required",
        "any.required": "Status is required",
        "any.only": "Status must be one of: pending, approved, rejected, used, expired",
      }),
    notes: Joi.string().trim().allow(null, ""),
  }),
};

// Adjust customer points schema
export const adjustCustomerPointsSchema = {
  body: Joi.object({
    userId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.empty": "User ID is required",
        "string.pattern.base": "User ID must be a valid ID",
        "any.required": "User ID is required",
      }),
    points: Joi.number().integer().required().messages({
      "number.base": "Points must be a number",
      "number.integer": "Points must be an integer",
      "any.required": "Points are required",
    }),
    reason: Joi.string().required().messages({
      "string.empty": "Reason is required",
      "any.required": "Reason is required",
    }),
  }),
};

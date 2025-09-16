import Joi from "joi";

export const abTestValidation = {
  createTest: Joi.object({
    name: Joi.string().required().trim().min(3).max(100),
    description: Joi.string().required().trim().min(3).max(500),
    type: Joi.string().required().valid("product", "category", "homepage", "checkout", "other"),
    targetUrl: Joi.string().required().trim().uri(),
    variants: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().required().trim().min(1).max(100),
          description: Joi.string().trim().min(3).max(500),
          trafficAllocation: Joi.number().required().min(1).max(100),
          content: Joi.object().required(),
        })
      )
      .min(2)
      .required(),
    startDate: Joi.date().iso().min("now"),
    endDate: Joi.date().iso().greater(Joi.ref("startDate")),
    status: Joi.string().valid("draft", "running", "paused", "completed"),
    targetAudience: Joi.object({
      userType: Joi.array().items(Joi.string().valid("new", "returning", "all")),
      devices: Joi.array().items(Joi.string().valid("desktop", "mobile", "tablet", "all")),
      countries: Joi.array().items(Joi.string().length(2)),
    }),
    goals: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().required().trim().min(3).max(100),
          type: Joi.string()
            .required()
            .valid("pageview", "click", "conversion", "revenue", "engagement", "custom"),
          targetValue: Joi.number().min(0),
          targetSelector: Joi.string().when("type", {
            is: "click",
            then: Joi.string().required(),
            otherwise: Joi.string().allow(""),
          }),
        })
      )
      .min(1)
      .required(),
  }),

  updateTest: Joi.object({
    name: Joi.string().trim().min(3).max(100),
    description: Joi.string().trim().min(3).max(500),
    type: Joi.string().valid("product", "category", "homepage", "checkout", "other"),
    targetUrl: Joi.string().trim().uri(),
    variants: Joi.array().items(
      Joi.object({
        name: Joi.string().trim().min(1).max(100),
        description: Joi.string().trim().min(3).max(500),
        trafficAllocation: Joi.number().min(1).max(100),
        content: Joi.object(),
      })
    ),
    startDate: Joi.date().iso(),
    endDate: Joi.date().iso().greater(Joi.ref("startDate")),
    status: Joi.string().valid("draft", "running", "paused", "completed"),
    targetAudience: Joi.object({
      userType: Joi.array().items(Joi.string().valid("new", "returning", "all")),
      devices: Joi.array().items(Joi.string().valid("desktop", "mobile", "tablet", "all")),
      countries: Joi.array().items(Joi.string().length(2)),
    }),
    goals: Joi.array().items(
      Joi.object({
        name: Joi.string().trim().min(3).max(100),
        type: Joi.string().valid(
          "pageview",
          "click",
          "conversion",
          "revenue",
          "engagement",
          "custom"
        ),
        targetValue: Joi.number().min(0),
        targetSelector: Joi.string().when("type", {
          is: "click",
          then: Joi.string().required(),
          otherwise: Joi.string().allow(""),
        }),
      })
    ),
  }),

  trackConversion: Joi.object({
    userId: Joi.string().allow(null),
    sessionId: Joi.string().required(),
    variantId: Joi.string().required(),
    goalName: Joi.string().required(),
    value: Joi.number().min(0),
    metadata: Joi.object(),
  }),
};

import Joi from "joi"

export const versioningValidation = {
  // Create version validation
  createVersion: Joi.object({
    body: Joi.object({
      data: Joi.object().required().messages({
        "any.required": "Content data is required",
      }),
      notes: Joi.string().max(500),
      status: Joi.string().valid("draft", "published", "archived").default("draft"),
    }),
    query: Joi.object({}),
    params: Joi.object({
      contentId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          "string.pattern.base": "Content ID must be a valid MongoDB ObjectId",
          "any.required": "Content ID is required",
        }),
    }),
  }),

  // Revert to version validation
  revertToVersion: Joi.object({
    body: Joi.object({
      notes: Joi.string().max(500),
      publish: Joi.boolean().default(false),
    }),
    query: Joi.object({}),
    params: Joi.object({
      contentId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          "string.pattern.base": "Content ID must be a valid MongoDB ObjectId",
          "any.required": "Content ID is required",
        }),
      version: Joi.number().integer().min(1).required().messages({
        "number.base": "Version must be a number",
        "number.integer": "Version must be an integer",
        "number.min": "Version must be at least 1",
        "any.required": "Version is required",
      }),
    }),
  }),
}

import Joi from "joi"
import { ContentStatus } from "../db/models/content.model"

export const contentValidation = {
  // Create content validation
  createContent: Joi.object({
    body: Joi.object({
      contentTypeId: Joi.string().required().messages({
        "any.required": "Content type ID is required",
      }),
      data: Joi.object().required().messages({
        "any.required": "Content data is required",
      }),
      status: Joi.string()
        .valid(...Object.values(ContentStatus))
        .messages({
          "any.only": `Status must be one of: ${Object.values(ContentStatus).join(", ")}`,
        }),
      locale: Joi.string(),
      slug: Joi.string()
        .pattern(/^[a-z0-9-]+$/)
        .messages({
          "string.pattern.base": "Slug can only contain lowercase alphanumeric characters and hyphens",
        }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Update content validation
  updateContent: Joi.object({
    body: Joi.object({
      data: Joi.object(),
      status: Joi.string()
        .valid(...Object.values(ContentStatus))
        .messages({
          "any.only": `Status must be one of: ${Object.values(ContentStatus).join(", ")}`,
        }),
      slug: Joi.string()
        .pattern(/^[a-z0-9-]+$/)
        .messages({
          "string.pattern.base": "Slug can only contain lowercase alphanumeric characters and hyphens",
        }),
      comment: Joi.string(),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string().required().messages({
        "any.required": "Content ID is required",
      }),
    }),
  }),

  // Publish content validation
  publishContent: Joi.object({
    body: Joi.object({
      scheduledAt: Joi.date().iso(),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string().required().messages({
        "any.required": "Content ID is required",
      }),
    }),
  }),
}

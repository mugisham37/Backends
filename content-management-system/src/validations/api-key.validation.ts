import Joi from "joi"
import { ApiKeyScope } from "../db/models/api-key.model"

export const apiKeyValidation = {
  // Create API key validation
  createApiKey: Joi.object({
    body: Joi.object({
      name: Joi.string().required().messages({
        "any.required": "API key name is required",
      }),
      scopes: Joi.array()
        .items(Joi.string().valid(...Object.values(ApiKeyScope)))
        .required()
        .messages({
          "any.required": "API key scopes are required",
          "array.includesOne": "API key scopes must include at least one valid scope",
        }),
      expiresAt: Joi.date().iso().greater("now").allow(null).messages({
        "date.greater": "Expiration date must be in the future",
        "date.format": "Expiration date must be in ISO format",
      }),
      tenantId: Joi.string().regex(/^[0-9a-fA-F]{24}$/),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Get API key validation
  getApiKey: Joi.object({
    body: Joi.object({}),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          "any.required": "API key ID is required",
          "string.pattern.base": "API key ID must be a valid MongoDB ObjectId",
        }),
    }),
  }),

  // Update API key validation
  updateApiKey: Joi.object({
    body: Joi.object({
      name: Joi.string(),
      scopes: Joi.array().items(Joi.string().valid(...Object.values(ApiKeyScope))),
      isActive: Joi.boolean(),
      expiresAt: Joi.date().iso().greater("now").allow(null),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          "any.required": "API key ID is required",
          "string.pattern.base": "API key ID must be a valid MongoDB ObjectId",
        }),
    }),
  }),

  // Delete API key validation
  deleteApiKey: Joi.object({
    body: Joi.object({}),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          "any.required": "API key ID is required",
          "string.pattern.base": "API key ID must be a valid MongoDB ObjectId",
        }),
    }),
  }),

  // Regenerate API key validation
  regenerateApiKey: Joi.object({
    body: Joi.object({}),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          "any.required": "API key ID is required",
          "string.pattern.base": "API key ID must be a valid MongoDB ObjectId",
        }),
    }),
  }),
}

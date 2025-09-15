import Joi from "joi"
import { RouteMethod, RouteStatus } from "../db/models/api-gateway.model"

export const apiGatewayValidation = {
  // Create route validation
  createRoute: Joi.object({
    body: Joi.object({
      path: Joi.string().required().min(1).max(200).messages({
        "string.min": "Path must be at least 1 character long",
        "string.max": "Path cannot exceed 200 characters",
        "any.required": "Path is required",
      }),
      method: Joi.string()
        .required()
        .valid(...Object.values(RouteMethod))
        .messages({
          "any.only": `Method must be one of: ${Object.values(RouteMethod).join(", ")}`,
          "any.required": "Method is required",
        }),
      target: Joi.string().required().uri().messages({
        "string.uri": "Target must be a valid URI",
        "any.required": "Target is required",
      }),
      status: Joi.string()
        .valid(...Object.values(RouteStatus))
        .default(RouteStatus.ACTIVE)
        .messages({
          "any.only": `Status must be one of: ${Object.values(RouteStatus).join(", ")}`,
        }),
      description: Joi.string().max(500).messages({
        "string.max": "Description cannot exceed 500 characters",
      }),
      isPublic: Joi.boolean().default(false).messages({
        "boolean.base": "isPublic must be a boolean",
      }),
      rateLimit: Joi.object({
        limit: Joi.number().integer().min(1).required().messages({
          "number.base": "Rate limit must be a number",
          "number.integer": "Rate limit must be an integer",
          "number.min": "Rate limit must be at least 1",
          "any.required": "Rate limit is required",
        }),
        window: Joi.number().integer().min(1).required().messages({
          "number.base": "Rate limit window must be a number",
          "number.integer": "Rate limit window must be an integer",
          "number.min": "Rate limit window must be at least 1",
          "any.required": "Rate limit window is required",
        }),
      }),
      caching: Joi.object({
        enabled: Joi.boolean().required().messages({
          "boolean.base": "Caching enabled must be a boolean",
          "any.required": "Caching enabled is required",
        }),
        ttl: Joi.number().integer().min(1).default(60).messages({
          "number.base": "Caching TTL must be a number",
          "number.integer": "Caching TTL must be an integer",
          "number.min": "Caching TTL must be at least 1",
        }),
      }),
      transformation: Joi.object({
        request: Joi.string().max(5000).messages({
          "string.max": "Request transformation cannot exceed 5000 characters",
        }),
        response: Joi.string().max(5000).messages({
          "string.max": "Response transformation cannot exceed 5000 characters",
        }),
      }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Update route validation
  updateRoute: Joi.object({
    body: Joi.object({
      path: Joi.string().min(1).max(200).messages({
        "string.min": "Path must be at least 1 character long",
        "string.max": "Path cannot exceed 200 characters",
      }),
      method: Joi.string()
        .valid(...Object.values(RouteMethod))
        .messages({
          "any.only": `Method must be one of: ${Object.values(RouteMethod).join(", ")}`,
        }),
      target: Joi.string().uri().messages({
        "string.uri": "Target must be a valid URI",
      }),
      status: Joi.string()
        .valid(...Object.values(RouteStatus))
        .messages({
          "any.only": `Status must be one of: ${Object.values(RouteStatus).join(", ")}`,
        }),
      description: Joi.string().max(500).messages({
        "string.max": "Description cannot exceed 500 characters",
      }),
      isPublic: Joi.boolean().messages({
        "boolean.base": "isPublic must be a boolean",
      }),
      rateLimit: Joi.object({
        limit: Joi.number().integer().min(1).required().messages({
          "number.base": "Rate limit must be a number",
          "number.integer": "Rate limit must be an integer",
          "number.min": "Rate limit must be at least 1",
          "any.required": "Rate limit is required",
        }),
        window: Joi.number().integer().min(1).required().messages({
          "number.base": "Rate limit window must be a number",
          "number.integer": "Rate limit window must be an integer",
          "number.min": "Rate limit window must be at least 1",
          "any.required": "Rate limit window is required",
        }),
      }),
      caching: Joi.object({
        enabled: Joi.boolean().required().messages({
          "boolean.base": "Caching enabled must be a boolean",
          "any.required": "Caching enabled is required",
        }),
        ttl: Joi.number().integer().min(1).default(60).messages({
          "number.base": "Caching TTL must be a number",
          "number.integer": "Caching TTL must be an integer",
          "number.min": "Caching TTL must be at least 1",
        }),
      }),
      transformation: Joi.object({
        request: Joi.string().max(5000).allow(null).messages({
          "string.max": "Request transformation cannot exceed 5000 characters",
        }),
        response: Joi.string().max(5000).allow(null).messages({
          "string.max": "Response transformation cannot exceed 5000 characters",
        }),
      }),
    })
      .min(1)
      .messages({
        "object.min": "At least one field is required",
      }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string()
        .required()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid route ID format",
          "any.required": "Route ID is required",
        }),
    }),
  }),

  // Get route validation
  getRoute: Joi.object({
    body: Joi.object({}),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string()
        .required()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid route ID format",
          "any.required": "Route ID is required",
        }),
    }),
  }),

  // List routes validation
  listRoutes: Joi.object({
    body: Joi.object({}),
    query: Joi.object({
      page: Joi.number().integer().min(1).messages({
        "number.base": "Page must be a number",
        "number.integer": "Page must be an integer",
        "number.min": "Page must be at least 1",
      }),
      limit: Joi.number().integer().min(1).max(100).messages({
        "number.base": "Limit must be a number",
        "number.integer": "Limit must be an integer",
        "number.min": "Limit must be at least 1",
        "number.max": "Limit cannot exceed 100",
      }),
      status: Joi.string()
        .valid(...Object.values(RouteStatus))
        .messages({
          "any.only": `Status must be one of: ${Object.values(RouteStatus).join(", ")}`,
        }),
      method: Joi.string()
        .valid(...Object.values(RouteMethod))
        .messages({
          "any.only": `Method must be one of: ${Object.values(RouteMethod).join(", ")}`,
        }),
      search: Joi.string().max(100).messages({
        "string.max": "Search query cannot exceed 100 characters",
      }),
    }),
    params: Joi.object({}),
  }),
}

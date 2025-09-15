import Joi from "joi"
import { FieldType } from "../db/models/content-type.model"

export const contentTypeValidation = {
  // Create content type validation
  createContentType: Joi.object({
    body: Joi.object({
      name: Joi.string()
        .required()
        .pattern(/^[a-z0-9_-]+$/)
        .messages({
          "string.pattern.base": "Name can only contain lowercase alphanumeric characters, underscores, and hyphens",
          "any.required": "Name is required",
        }),
      displayName: Joi.string().required().messages({
        "any.required": "Display name is required",
      }),
      description: Joi.string(),
      fields: Joi.array()
        .items(
          Joi.object({
            name: Joi.string()
              .required()
              .pattern(/^[a-zA-Z0-9_-]+$/)
              .messages({
                "string.pattern.base": "Field name can only contain alphanumeric characters, underscores, and hyphens",
                "any.required": "Field name is required",
              }),
            displayName: Joi.string().required().messages({
              "any.required": "Field display name is required",
            }),
            type: Joi.string()
              .valid(...Object.values(FieldType))
              .required()
              .messages({
                "any.only": `Field type must be one of: ${Object.values(FieldType).join(", ")}`,
                "any.required": "Field type is required",
              }),
            description: Joi.string(),
            validation: Joi.object({
              required: Joi.boolean(),
              unique: Joi.boolean(),
              min: Joi.number(),
              max: Joi.number(),
              minLength: Joi.number().integer().min(0),
              maxLength: Joi.number().integer().min(0),
              pattern: Joi.string(),
              enum: Joi.array().items(Joi.string()),
            }),
            defaultValue: Joi.any(),
            isLocalized: Joi.boolean(),
            settings: Joi.object(),
          }),
        )
        .required()
        .messages({
          "any.required": "Fields are required",
        }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Update content type validation
  updateContentType: Joi.object({
    body: Joi.object({
      displayName: Joi.string(),
      description: Joi.string(),
      fields: Joi.array().items(
        Joi.object({
          name: Joi.string()
            .pattern(/^[a-zA-Z0-9_-]+$/)
            .messages({
              "string.pattern.base": "Field name can only contain alphanumeric characters, underscores, and hyphens",
            }),
          displayName: Joi.string(),
          type: Joi.string()
            .valid(...Object.values(FieldType))
            .messages({
              "any.only": `Field type must be one of: ${Object.values(FieldType).join(", ")}`,
            }),
          description: Joi.string(),
          validation: Joi.object({
            required: Joi.boolean(),
            unique: Joi.boolean(),
            min: Joi.number(),
            max: Joi.number(),
            minLength: Joi.number().integer().min(0),
            maxLength: Joi.number().integer().min(0),
            pattern: Joi.string(),
            enum: Joi.array().items(Joi.string()),
          }),
          defaultValue: Joi.any(),
          isLocalized: Joi.boolean(),
          settings: Joi.object(),
        }),
      ),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string().required().messages({
        "any.required": "Content type ID is required",
      }),
    }),
  }),

  // Add field validation
  addField: Joi.object({
    body: Joi.object({
      name: Joi.string()
        .required()
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .messages({
          "string.pattern.base": "Field name can only contain alphanumeric characters, underscores, and hyphens",
          "any.required": "Field name is required",
        }),
      displayName: Joi.string().required().messages({
        "any.required": "Field display name is required",
      }),
      type: Joi.string()
        .valid(...Object.values(FieldType))
        .required()
        .messages({
          "any.only": `Field type must be one of: ${Object.values(FieldType).join(", ")}`,
          "any.required": "Field type is required",
        }),
      description: Joi.string(),
      validation: Joi.object({
        required: Joi.boolean(),
        unique: Joi.boolean(),
        min: Joi.number(),
        max: Joi.number(),
        minLength: Joi.number().integer().min(0),
        maxLength: Joi.number().integer().min(0),
        pattern: Joi.string(),
        enum: Joi.array().items(Joi.string()),
      }),
      defaultValue: Joi.any(),
      isLocalized: Joi.boolean(),
      settings: Joi.object(),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string().required().messages({
        "any.required": "Content type ID is required",
      }),
    }),
  }),

  // Update field validation
  updateField: Joi.object({
    body: Joi.object({
      displayName: Joi.string(),
      description: Joi.string(),
      validation: Joi.object({
        required: Joi.boolean(),
        unique: Joi.boolean(),
        min: Joi.number(),
        max: Joi.number(),
        minLength: Joi.number().integer().min(0),
        maxLength: Joi.number().integer().min(0),
        pattern: Joi.string(),
        enum: Joi.array().items(Joi.string()),
      }),
      defaultValue: Joi.any(),
      isLocalized: Joi.boolean(),
      settings: Joi.object(),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string().required().messages({
        "any.required": "Content type ID is required",
      }),
      fieldId: Joi.string().required().messages({
        "any.required": "Field ID is required",
      }),
    }),
  }),
}

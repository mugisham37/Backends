import Joi from "joi"

export const mediaValidation = {
  // Update media validation
  updateMedia: Joi.object({
    body: Joi.object({
      alt: Joi.string(),
      title: Joi.string(),
      description: Joi.string(),
      tags: Joi.array().items(Joi.string()),
      folder: Joi.string(),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string().required().messages({
        "any.required": "Media ID is required",
      }),
    }),
  }),

  // Create folder validation
  createFolder: Joi.object({
    body: Joi.object({
      name: Joi.string()
        .required()
        .pattern(/^[a-zA-Z0-9_-]+$/)
        .messages({
          "string.pattern.base": "Folder name can only contain alphanumeric characters, underscores, and hyphens",
          "any.required": "Folder name is required",
        }),
      parentFolder: Joi.string(),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),
}

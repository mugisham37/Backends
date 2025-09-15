import Joi from "joi"

export const pluginValidation = {
  // Install plugin validation
  installPlugin: Joi.object({
    body: Joi.object({
      name: Joi.string().required().messages({
        "any.required": "Plugin name is required",
      }),
      version: Joi.string().required().messages({
        "any.required": "Plugin version is required",
      }),
      description: Joi.string().required().messages({
        "any.required": "Plugin description is required",
      }),
      entryPoint: Joi.string().required().messages({
        "any.required": "Plugin entry point is required",
      }),
      author: Joi.string().required().messages({
        "any.required": "Plugin author is required",
      }),
      repository: Joi.string().uri().messages({
        "string.uri": "Repository must be a valid URI",
      }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Update plugin validation
  updatePlugin: Joi.object({
    body: Joi.object({
      version: Joi.string().required().messages({
        "any.required": "Plugin version is required",
      }),
      description: Joi.string(),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string().required().messages({
        "any.required": "Plugin ID is required",
      }),
    }),
  }),

  // Get plugin validation
  getPlugin: Joi.object({
    body: Joi.object({}),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string().required().messages({
        "any.required": "Plugin ID is required",
      }),
    }),
  }),

  // Execute hook validation
  executeHook: Joi.object({
    body: Joi.object({
      hookName: Joi.string().required().messages({
        "any.required": "Hook name is required",
      }),
      args: Joi.array().items(Joi.any()),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),
}

import Joi from "joi"

export const migrationValidation = {
  // Import data validation
  importData: Joi.object({
    body: Joi.object({
      importDir: Joi.string().required().messages({
        "any.required": "Import directory is required",
      }),
      clear: Joi.boolean(),
      skipExisting: Joi.boolean(),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Create migration validation
  createMigration: Joi.object({
    body: Joi.object({
      name: Joi.string()
        .required()
        .pattern(/^[a-z0-9-_]+$/)
        .messages({
          "any.required": "Migration name is required",
          "string.pattern.base": "Migration name can only contain lowercase letters, numbers, hyphens, and underscores",
        }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Run migrations validation
  runMigrations: Joi.object({
    body: Joi.object({
      direction: Joi.string().valid("up", "down").default("up"),
      specific: Joi.string(),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),
}

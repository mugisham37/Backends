import Joi from "joi"

export const i18nValidation = {
  // Upsert translation validation
  upsertTranslation: Joi.object({
    body: Joi.object({
      locale: Joi.string().required().min(2).max(10).messages({
        "string.min": "Locale must be at least 2 characters long",
        "string.max": "Locale cannot exceed 10 characters",
        "any.required": "Locale is required",
      }),
      namespace: Joi.string().required().min(1).max(50).messages({
        "string.min": "Namespace must be at least 1 character long",
        "string.max": "Namespace cannot exceed 50 characters",
        "any.required": "Namespace is required",
      }),
      key: Joi.string().required().min(1).max(100).messages({
        "string.min": "Key must be at least 1 character long",
        "string.max": "Key cannot exceed 100 characters",
        "any.required": "Key is required",
      }),
      value: Joi.string().required().min(1).max(5000).messages({
        "string.min": "Value must be at least 1 character long",
        "string.max": "Value cannot exceed 5000 characters",
        "any.required": "Value is required",
      }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Import translations validation
  importTranslations: Joi.object({
    body: Joi.object({
      locale: Joi.string().required().min(2).max(10).messages({
        "string.min": "Locale must be at least 2 characters long",
        "string.max": "Locale cannot exceed 10 characters",
        "any.required": "Locale is required",
      }),
      namespace: Joi.string().required().min(1).max(50).messages({
        "string.min": "Namespace must be at least 1 character long",
        "string.max": "Namespace cannot exceed 50 characters",
        "any.required": "Namespace is required",
      }),
      translations: Joi.object().required().messages({
        "object.base": "Translations must be an object",
        "any.required": "Translations are required",
      }),
      overwrite: Joi.boolean().default(false).messages({
        "boolean.base": "Overwrite must be a boolean",
      }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Import translations from file validation
  importTranslationsFromFile: Joi.object({
    body: Joi.object({
      locale: Joi.string().required().min(2).max(10).messages({
        "string.min": "Locale must be at least 2 characters long",
        "string.max": "Locale cannot exceed 10 characters",
        "any.required": "Locale is required",
      }),
      namespace: Joi.string().required().min(1).max(50).messages({
        "string.min": "Namespace must be at least 1 character long",
        "string.max": "Namespace cannot exceed 50 characters",
        "any.required": "Namespace is required",
      }),
      overwrite: Joi.string().valid("true", "false").default("false").messages({
        "any.only": "Overwrite must be 'true' or 'false'",
      }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Translate validation
  translate: Joi.object({
    body: Joi.object({
      locale: Joi.string().required().min(2).max(10).messages({
        "string.min": "Locale must be at least 2 characters long",
        "string.max": "Locale cannot exceed 10 characters",
        "any.required": "Locale is required",
      }),
      namespace: Joi.string().required().min(1).max(50).messages({
        "string.min": "Namespace must be at least 1 character long",
        "string.max": "Namespace cannot exceed 50 characters",
        "any.required": "Namespace is required",
      }),
      key: Joi.string().required().min(1).max(100).messages({
        "string.min": "Key must be at least 1 character long",
        "string.max": "Key cannot exceed 100 characters",
        "any.required": "Key is required",
      }),
      defaultValue: Joi.string().max(5000).messages({
        "string.max": "Default value cannot exceed 5000 characters",
      }),
      params: Joi.object().messages({
        "object.base": "Params must be an object",
      }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Set default locale validation
  setDefaultLocale: Joi.object({
    body: Joi.object({
      locale: Joi.string().required().min(2).max(10).messages({
        "string.min": "Locale must be at least 2 characters long",
        "string.max": "Locale cannot exceed 10 characters",
        "any.required": "Locale is required",
      }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),
}

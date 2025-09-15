import Joi from "joi"
import { WebhookEvent, WebhookStatus } from "../db/models/webhook.model"

export const webhookValidation = {
  // Create webhook validation
  createWebhook: Joi.object({
    body: Joi.object({
      name: Joi.string().required().messages({
        "any.required": "Name is required",
      }),
      url: Joi.string().uri().required().messages({
        "string.uri": "URL must be a valid URI",
        "any.required": "URL is required",
      }),
      secret: Joi.string(),
      events: Joi.array()
        .items(
          Joi.string()
            .valid(...Object.values(WebhookEvent))
            .messages({
              "any.only": `Event must be one of: ${Object.values(WebhookEvent).join(", ")}`,
            }),
        )
        .required()
        .messages({
          "any.required": "Events are required",
        }),
      contentTypeIds: Joi.array().items(Joi.string()),
      status: Joi.string()
        .valid(...Object.values(WebhookStatus))
        .messages({
          "any.only": `Status must be one of: ${Object.values(WebhookStatus).join(", ")}`,
        }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Update webhook validation
  updateWebhook: Joi.object({
    body: Joi.object({
      name: Joi.string(),
      url: Joi.string().uri().messages({
        "string.uri": "URL must be a valid URI",
      }),
      secret: Joi.string(),
      events: Joi.array().items(
        Joi.string()
          .valid(...Object.values(WebhookEvent))
          .messages({
            "any.only": `Event must be one of: ${Object.values(WebhookEvent).join(", ")}`,
          }),
      ),
      contentTypeIds: Joi.array().items(Joi.string()),
      status: Joi.string()
        .valid(...Object.values(WebhookStatus))
        .messages({
          "any.only": `Status must be one of: ${Object.values(WebhookStatus).join(", ")}`,
        }),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string().required().messages({
        "any.required": "Webhook ID is required",
      }),
    }),
  }),
}

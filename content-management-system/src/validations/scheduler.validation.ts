import Joi from "joi"
import { JobStatus } from "../services/scheduler.service"

export const schedulerValidation = {
  // Create job validation
  createJob: Joi.object({
    body: Joi.object({
      name: Joi.string().required().messages({
        "any.required": "Job name is required",
      }),
      type: Joi.string().valid("cron", "immediate", "scheduled").required().messages({
        "any.required": "Job type is required",
        "any.only": "Job type must be one of: cron, immediate, scheduled",
      }),
      cronExpression: Joi.string()
        .when("type", {
          is: "cron",
          then: Joi.required(),
          otherwise: Joi.optional(),
        })
        .messages({
          "any.required": "Cron expression is required for cron jobs",
        }),
      data: Joi.object().default({}),
      scheduledFor: Joi.date()
        .iso()
        .when("type", {
          is: "scheduled",
          then: Joi.required(),
          otherwise: Joi.optional(),
        })
        .messages({
          "any.required": "scheduledFor is required for scheduled jobs",
          "date.base": "scheduledFor must be a valid date",
        }),
      maxRuns: Joi.number().integer().min(1).optional(),
      maxRetries: Joi.number().integer().min(0).default(3),
      priority: Joi.number().integer().default(0),
      tags: Joi.array().items(Joi.string()).default([]),
      runImmediately: Joi.boolean().default(false),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Clean up jobs validation
  cleanupJobs: Joi.object({
    body: Joi.object({
      olderThan: Joi.date().iso().optional().messages({
        "date.base": "olderThan must be a valid date",
      }),
      status: Joi.alternatives()
        .try(
          Joi.string().valid(...Object.values(JobStatus)),
          Joi.array().items(Joi.string().valid(...Object.values(JobStatus))),
        )
        .optional(),
      keepLastN: Joi.number().integer().min(1).optional(),
    }).or("olderThan", "status", "keepLastN"),
    query: Joi.object({}),
    params: Joi.object({}),
  }),
}

import Joi from "joi"

export const auditValidation = {
  // Delete old audit logs validation
  deleteOldAuditLogs: Joi.object({
    body: Joi.object({
      olderThan: Joi.date().iso().required().messages({
        "any.required": "olderThan date is required",
        "date.base": "olderThan must be a valid date",
        "date.format": "olderThan must be in ISO format",
      }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),
}

import Joi from "joi"
import { UserRole } from "../db/models/user.model"

export const userValidation = {
  // Create user validation
  createUser: Joi.object({
    body: Joi.object({
      email: Joi.string().email().required().messages({
        "string.email": "Please provide a valid email address",
        "any.required": "Email is required",
      }),
      password: Joi.string().min(8).required().messages({
        "string.min": "Password must be at least 8 characters long",
        "any.required": "Password is required",
      }),
      firstName: Joi.string().required().messages({
        "any.required": "First name is required",
      }),
      lastName: Joi.string().required().messages({
        "any.required": "Last name is required",
      }),
      role: Joi.string()
        .valid(...Object.values(UserRole))
        .messages({
          "any.only": `Role must be one of: ${Object.values(UserRole).join(", ")}`,
        }),
      isActive: Joi.boolean(),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Update user validation
  updateUser: Joi.object({
    body: Joi.object({
      email: Joi.string().email().messages({
        "string.email": "Please provide a valid email address",
      }),
      firstName: Joi.string(),
      lastName: Joi.string(),
      role: Joi.string()
        .valid(...Object.values(UserRole))
        .messages({
          "any.only": `Role must be one of: ${Object.values(UserRole).join(", ")}`,
        }),
      isActive: Joi.boolean(),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string().required().messages({
        "any.required": "User ID is required",
      }),
    }),
  }),

  // Change password validation
  changePassword: Joi.object({
    body: Joi.object({
      currentPassword: Joi.string().required().messages({
        "any.required": "Current password is required",
      }),
      newPassword: Joi.string().min(8).required().messages({
        "string.min": "New password must be at least 8 characters long",
        "any.required": "New password is required",
      }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Change role validation
  changeRole: Joi.object({
    body: Joi.object({
      role: Joi.string()
        .valid(...Object.values(UserRole))
        .required()
        .messages({
          "any.only": `Role must be one of: ${Object.values(UserRole).join(", ")}`,
          "any.required": "Role is required",
        }),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string().required().messages({
        "any.required": "User ID is required",
      }),
    }),
  }),
}

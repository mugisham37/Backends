import Joi from "joi"
import { UserRole } from "../db/models/user.model"

export const authValidation = {
  // Register validation
  register: Joi.object({
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
          "any.only": "Role must be one of: admin, editor, author, viewer",
        }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Login validation
  login: Joi.object({
    body: Joi.object({
      email: Joi.string().email().required().messages({
        "string.email": "Please provide a valid email address",
        "any.required": "Email is required",
      }),
      password: Joi.string().required().messages({
        "any.required": "Password is required",
      }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Refresh token validation
  refreshToken: Joi.object({
    body: Joi.object({
      refreshToken: Joi.string().required().messages({
        "any.required": "Refresh token is required",
      }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
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

  // Forgot password validation
  forgotPassword: Joi.object({
    body: Joi.object({
      email: Joi.string().email().required().messages({
        "string.email": "Please provide a valid email address",
        "any.required": "Email is required",
      }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Reset password validation
  resetPassword: Joi.object({
    body: Joi.object({
      token: Joi.string().required().messages({
        "any.required": "Token is required",
      }),
      newPassword: Joi.string().min(8).required().messages({
        "string.min": "New password must be at least 8 characters long",
        "any.required": "New password is required",
      }),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),
}

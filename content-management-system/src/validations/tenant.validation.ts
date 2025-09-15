import Joi from "joi"
import { TenantPlan, TenantStatus, TenantUserRole } from "../db/models/tenant.model"

export const tenantValidation = {
  // Create tenant validation
  createTenant: Joi.object({
    body: Joi.object({
      name: Joi.string().required().min(2).max(100).messages({
        "string.min": "Name must be at least 2 characters long",
        "string.max": "Name cannot exceed 100 characters",
        "any.required": "Name is required",
      }),
      slug: Joi.string()
        .min(2)
        .max(50)
        .pattern(/^[a-z0-9-]+$/)
        .messages({
          "string.min": "Slug must be at least 2 characters long",
          "string.max": "Slug cannot exceed 50 characters",
          "string.pattern.base": "Slug can only contain lowercase letters, numbers, and hyphens",
        }),
      description: Joi.string().max(500).messages({
        "string.max": "Description cannot exceed 500 characters",
      }),
      plan: Joi.string()
        .valid(...Object.values(TenantPlan))
        .messages({
          "any.only": "Plan must be one of: free, basic, professional, enterprise",
        }),
      domains: Joi.array().items(Joi.string()).default([]),
      settings: Joi.object().default({}),
      limits: Joi.object({
        users: Joi.number().integer().min(1),
        storage: Joi.number().integer().min(1),
        contentTypes: Joi.number().integer().min(1),
        apiRequests: Joi.number().integer().min(1),
      }).default({}),
    }),
    query: Joi.object({}),
    params: Joi.object({}),
  }),

  // Get tenant validation
  getTenant: Joi.object({
    body: Joi.object({}),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string()
        .required()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid tenant ID format",
          "any.required": "Tenant ID is required",
        }),
    }),
  }),

  // Update tenant validation
  updateTenant: Joi.object({
    body: Joi.object({
      name: Joi.string().min(2).max(100).messages({
        "string.min": "Name must be at least 2 characters long",
        "string.max": "Name cannot exceed 100 characters",
      }),
      description: Joi.string().max(500).messages({
        "string.max": "Description cannot exceed 500 characters",
      }),
      status: Joi.string().valid(...Object.values(TenantStatus)),
      plan: Joi.string().valid(...Object.values(TenantPlan)),
      domains: Joi.array().items(Joi.string()),
      settings: Joi.object({
        defaultLocale: Joi.string().min(2).max(10),
        supportedLocales: Joi.array().items(Joi.string().min(2).max(10)),
        timezone: Joi.string(),
        dateFormat: Joi.string(),
        timeFormat: Joi.string(),
        currency: Joi.string().min(3).max(3),
        securitySettings: Joi.object({
          mfaRequired: Joi.boolean(),
          passwordPolicy: Joi.object({
            minLength: Joi.number().min(6).max(32),
            requireUppercase: Joi.boolean(),
            requireLowercase: Joi.boolean(),
            requireNumbers: Joi.boolean(),
            requireSpecialChars: Joi.boolean(),
            preventPasswordReuse: Joi.number().min(0).max(24),
            expiryDays: Joi.number().min(0).max(365),
          }),
          sessionTimeout: Joi.number().min(5).max(1440),
          ipRestrictions: Joi.array().items(Joi.string()),
        }),
        customDomain: Joi.string().uri(),
        customBranding: Joi.object({
          logo: Joi.string().uri(),
          favicon: Joi.string().uri(),
          primaryColor: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/),
          secondaryColor: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/),
          accentColor: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/),
        }),
      }),
      billingInfo: Joi.object({
        contactEmail: Joi.string().email(),
        contactName: Joi.string(),
        company: Joi.string(),
        address: Joi.string(),
        city: Joi.string(),
        state: Joi.string(),
        zipCode: Joi.string(),
        country: Joi.string(),
        vatId: Joi.string(),
      }),
      trialEndsAt: Joi.date().iso(),
      customerId: Joi.string(),
      subscriptionId: Joi.string(),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string()
        .required()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid tenant ID format",
          "any.required": "Tenant ID is required",
        }),
    }),
  }),

  // Delete tenant validation
  deleteTenant: Joi.object({
    body: Joi.object({}),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string()
        .required()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid tenant ID format",
          "any.required": "Tenant ID is required",
        }),
    }),
  }),

  // List tenants validation
  listTenants: Joi.object({
    body: Joi.object({}),
    query: Joi.object({
      page: Joi.number().integer().min(1).messages({
        "number.base": "Page must be a number",
        "number.integer": "Page must be an integer",
        "number.min": "Page must be at least 1",
      }),
      limit: Joi.number().integer().min(1).max(100).messages({
        "number.base": "Limit must be a number",
        "number.integer": "Limit must be an integer",
        "number.min": "Limit must be at least 1",
        "number.max": "Limit cannot exceed 100",
      }),
      status: Joi.string()
        .valid(...Object.values(TenantStatus))
        .messages({
          "any.only": "Status must be one of: active, suspended, pending, archived",
        }),
      search: Joi.string().max(100).messages({
        "string.max": "Search query cannot exceed 100 characters",
      }),
      plan: Joi.string()
        .valid(...Object.values(TenantPlan))
        .messages({
          "any.only": "Plan must be one of: free, basic, professional, enterprise",
        }),
    }),
    params: Joi.object({}),
  }),

  // Add user to tenant validation
  addUserToTenant: Joi.object({
    body: Joi.object({
      userId: Joi.string()
        .required()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid user ID format",
          "any.required": "User ID is required",
        }),
      role: Joi.string()
        .required()
        .valid(...Object.values(TenantUserRole))
        .messages({
          "any.only": "Role must be one of: owner, admin, member",
          "any.required": "Role is required",
        }),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string()
        .required()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid tenant ID format",
          "any.required": "Tenant ID is required",
        }),
    }),
  }),

  // Update user role validation
  updateUserRole: Joi.object({
    body: Joi.object({
      role: Joi.string()
        .required()
        .valid(...Object.values(TenantUserRole))
        .messages({
          "any.only": "Role must be one of: owner, admin, member",
          "any.required": "Role is required",
        }),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string()
        .required()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid tenant ID format",
          "any.required": "Tenant ID is required",
        }),
      userId: Joi.string()
        .required()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid user ID format",
          "any.required": "User ID is required",
        }),
    }),
  }),

  // Remove user from tenant validation
  removeUserFromTenant: Joi.object({
    body: Joi.object({}),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string()
        .required()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid tenant ID format",
          "any.required": "Tenant ID is required",
        }),
      userId: Joi.string()
        .required()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid user ID format",
          "any.required": "User ID is required",
        }),
    }),
  }),

  // Update tenant plan validation
  updateTenantPlan: Joi.object({
    body: Joi.object({
      plan: Joi.string()
        .required()
        .valid(...Object.values(TenantPlan))
        .messages({
          "any.only": "Plan must be one of: free, basic, professional, enterprise",
          "any.required": "Plan is required",
        }),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string()
        .required()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid tenant ID format",
          "any.required": "Tenant ID is required",
        }),
    }),
  }),

  // Update tenant status validation
  updateTenantStatus: Joi.object({
    body: Joi.object({
      status: Joi.string()
        .required()
        .valid(...Object.values(TenantStatus))
        .messages({
          "any.only": "Status must be one of: active, suspended, pending, archived",
          "any.required": "Status is required",
        }),
    }),
    query: Joi.object({}),
    params: Joi.object({
      id: Joi.string()
        .required()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid tenant ID format",
          "any.required": "Tenant ID is required",
        }),
    }),
  }),
}

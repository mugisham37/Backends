import swaggerJsdoc from "swagger-jsdoc"
import swaggerUi from "swagger-ui-express"
import type { Express } from "express"
import { version } from "../../package.json"

// Swagger definition
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "SaaS Platform API Documentation",
    version,
    description: "API documentation for the SaaS Platform",
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
    contact: {
      name: "API Support",
      url: "https://example.com/support",
      email: "support@example.com",
    },
  },
  servers: [
    {
      url: "/api",
      description: "Development server",
    },
    {
      url: "https://api.example.com",
      description: "Production server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      tenantHeader: {
        type: "apiKey",
        in: "header",
        name: "X-Tenant-ID",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          status: {
            type: "string",
            example: "error",
          },
          message: {
            type: "string",
            example: "Error message",
          },
          errors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                field: {
                  type: "string",
                  example: "email",
                },
                message: {
                  type: "string",
                  example: "Email is required",
                },
              },
            },
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "550e8400-e29b-41d4-a716-446655440000",
          },
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          firstName: {
            type: "string",
            example: "John",
          },
          lastName: {
            type: "string",
            example: "Doe",
          },
          role: {
            type: "string",
            enum: ["admin", "user"],
            example: "user",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      Tenant: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "550e8400-e29b-41d4-a716-446655440000",
          },
          name: {
            type: "string",
            example: "Acme Inc",
          },
          slug: {
            type: "string",
            example: "acme",
          },
          plan: {
            type: "string",
            enum: ["free", "starter", "pro", "enterprise"],
            example: "starter",
          },
          status: {
            type: "string",
            enum: ["active", "inactive", "suspended"],
            example: "active",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      Project: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "550e8400-e29b-41d4-a716-446655440000",
          },
          name: {
            type: "string",
            example: "New Website",
          },
          description: {
            type: "string",
            example: "Company website redesign",
          },
          status: {
            type: "string",
            enum: ["planning", "in_progress", "review", "completed"],
            example: "in_progress",
          },
          tenantId: {
            type: "string",
            format: "uuid",
            example: "550e8400-e29b-41d4-a716-446655440000",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
      Task: {
        type: "object",
        properties: {
          id: {
            type: "string",
            format: "uuid",
            example: "550e8400-e29b-41d4-a716-446655440000",
          },
          title: {
            type: "string",
            example: "Design homepage",
          },
          description: {
            type: "string",
            example: "Create wireframes for the homepage",
          },
          status: {
            type: "string",
            enum: ["todo", "in_progress", "review", "done"],
            example: "in_progress",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            example: "medium",
          },
          assigneeId: {
            type: "string",
            format: "uuid",
            example: "550e8400-e29b-41d4-a716-446655440000",
          },
          projectId: {
            type: "string",
            format: "uuid",
            example: "550e8400-e29b-41d4-a716-446655440000",
          },
          dueDate: {
            type: "string",
            format: "date-time",
          },
          createdAt: {
            type: "string",
            format: "date-time",
          },
          updatedAt: {
            type: "string",
            format: "date-time",
          },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: "Access token is missing or invalid",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              status: "error",
              message: "Unauthorized",
            },
          },
        },
      },
      ForbiddenError: {
        description: "User does not have permission to access this resource",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              status: "error",
              message: "Forbidden",
            },
          },
        },
      },
      NotFoundError: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              status: "error",
              message: "Resource not found",
            },
          },
        },
      },
      ValidationError: {
        description: "Validation error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              status: "error",
              message: "Validation error",
              errors: [
                {
                  field: "email",
                  message: "Email is required",
                },
                {
                  field: "password",
                  message: "Password must be at least 8 characters",
                },
              ],
            },
          },
        },
      },
      ServerError: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/Error",
            },
            example: {
              status: "error",
              message: "Internal server error",
            },
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
      tenantHeader: [],
    },
  ],
  tags: [
    {
      name: "Auth",
      description: "Authentication endpoints",
    },
    {
      name: "Users",
      description: "User management endpoints",
    },
    {
      name: "Tenants",
      description: "Tenant management endpoints",
    },
    {
      name: "Projects",
      description: "Project management endpoints",
    },
    {
      name: "Tasks",
      description: "Task management endpoints",
    },
    {
      name: "Comments",
      description: "Comment management endpoints",
    },
    {
      name: "Attachments",
      description: "Attachment management endpoints",
    },
    {
      name: "Feature Flags",
      description: "Feature flag management endpoints",
    },
    {
      name: "Analytics",
      description: "Analytics endpoints",
    },
    {
      name: "Billing",
      description: "Billing and subscription endpoints",
    },
  ],
}

// Options for the swagger docs
const options = {
  swaggerDefinition,
  // Path to the API docs
  apis: ["./src/routes/*.ts", "./src/controllers/*.ts", "./src/models/*.ts"],
}

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(options)

/**
 * Configure Swagger
 * @param app Express application
 */
export const setupSwagger = (app: Express): void => {
  // Swagger page
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))

  // Docs in JSON format
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json")
    res.send(swaggerSpec)
  })

  console.log(`Swagger docs available at /api-docs`)
}

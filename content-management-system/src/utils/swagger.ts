import swaggerJsdoc from "swagger-jsdoc"
import swaggerUi from "swagger-ui-express"
import type { Express } from "express"
import { version } from "../../package.json"
import { config } from "../config"

// Swagger definition
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "CMS API Documentation",
    version,
    description: "API documentation for the CMS API",
    license: {
      name: "MIT",
      url: "https://opensource.org/licenses/MIT",
    },
    contact: {
      name: "Support",
      url: "https://example.com",
      email: "support@example.com",
    },
  },
  servers: [
    {
      url: `http://localhost:${config.port}/api`,
      description: "Development server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
}

// Options for the swagger docs
const options = {
  swaggerDefinition,
  // Paths to files containing OpenAPI definitions
  apis: ["./src/api/rest/v1/*.routes.ts", "./src/validations/*.validation.ts"],
}

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(options)

// Setup swagger middleware
export const setupSwagger = (app: Express): void => {
  // Serve swagger docs
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))

  // Serve swagger spec as JSON
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json")
    res.send(swaggerSpec)
  })
}

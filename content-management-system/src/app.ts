import express, { type Application } from "express"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import morgan from "morgan"
import { config } from "./config"
import { connectDatabase } from "./db/connection"
import { errorHandler } from "./middleware/error-handler"
import { setupSwagger } from "./utils/swagger"
import { setupGraphQL } from "./api/graphql"
import { setupRestApi } from "./api/rest"
import { logger, logStream } from "./utils/logger"
import { authenticateApiKey } from "./middleware/api-key.middleware"
import { authMiddleware } from "./middleware/auth"
import { resolveTenant } from "./middleware/tenant.middleware"
import { PluginService } from "./services/plugin.service"
import { ApiGatewayService } from "./services/api-gateway.service"
import { I18nService } from "./services/i18n.service"

export const createApp = async (): Promise<Application> => {
  // Create Express application
  const app: Application = express()

  try {
    // Connect to database
    await connectDatabase()

    // Basic middleware
    app.use(helmet())
    app.use(cors(config.cors))
    app.use(compression())
    app.use(express.json({ limit: "10mb" }))
    app.use(express.urlencoded({ extended: true, limit: "10mb" }))
    app.use(morgan("combined", { stream: logStream }))

    // Authentication middleware
    app.use(authenticateApiKey)
    app.use(authMiddleware)

    // Tenant resolution middleware
    app.use(resolveTenant)

    // Initialize services
    const pluginService = new PluginService()
    await pluginService.loadAllPlugins()

    const apiGatewayService = new ApiGatewayService()
    await apiGatewayService.loadRoutes()

    const i18nService = new I18nService()
    await i18nService.loadTranslations()

    // Set up API documentation
    setupSwagger(app)

    // Set up GraphQL API
    await setupGraphQL(app)

    // Set up REST API
    setupRestApi(app)

    // Health check endpoint
    app.get("/health", (req, res) => {
      res.status(200).json({ status: "ok", timestamp: new Date().toISOString() })
    })

    // Error handling middleware
    app.use(errorHandler)

    return app
  } catch (error) {
    logger.error("Failed to create application:", error)
    throw error
  }
}

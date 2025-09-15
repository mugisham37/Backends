import type { Application } from "express"
import { ApolloServer } from "@apollo/server"
import { expressMiddleware } from "@apollo/server/express4"
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer"
import http from "http"
import { typeDefs } from "./schema"
import { resolvers } from "./resolvers"
import { logger } from "../../utils/logger"
import { config } from "../../config"
import { authMiddleware } from "../../middleware/auth"

export const setupGraphQL = async (app: Application): Promise<void> => {
  // Create HTTP server
  const httpServer = http.createServer(app)

  // Create Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    formatError: (formattedError, error) => {
      // Log the error
      logger.error("GraphQL Error:", {
        message: formattedError.message,
        path: formattedError.path,
        extensions: formattedError.extensions,
      })

      // In production, don't expose internal server errors
      if (config.isProduction && formattedError.extensions?.code === "INTERNAL_SERVER_ERROR") {
        return {
          message: "Internal server error",
          path: formattedError.path,
          extensions: {
            code: "INTERNAL_SERVER_ERROR",
          },
        }
      }

      return formattedError
    },
  })

  // Start the Apollo Server
  await server.start()

  // Apply middleware
  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req, res }) => {
        // Apply authentication middleware to get user
        await new Promise<void>((resolve) => {
          authMiddleware(req, res, () => resolve())
        })

        return {
          user: (req as any).user,
          req,
          res,
        }
      },
    }),
  )

  logger.info("GraphQL server set up at /graphql")
}

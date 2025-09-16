import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { container } from "tsyringe";
import type { IAuthService } from "../core/types/service.types";

/**
 * Fastify Authentication Plugin
 *
 * Provides authentication middleware for Fastify routes using JWT tokens.
 */
async function authPlugin(fastify: FastifyInstance) {
  // Register authentication decorator
  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return reply.status(401).send({
            error: "Unauthorized",
            message: "Missing or invalid authorization header",
            timestamp: new Date().toISOString(),
          });
        }

        const token = authHeader.substring(7);
        const authService = container.resolve<IAuthService>("AuthService");

        const result = await authService.validateToken(token);

        if (!result.success) {
          return reply.status(401).send({
            error: "Unauthorized",
            message: result.error.message,
            timestamp: new Date().toISOString(),
          });
        }

        // Attach user to request
        request.user = result.data;
      } catch (error) {
        request.log.error("Authentication error:", error);
        return reply.status(401).send({
          error: "Unauthorized",
          message: "Authentication failed",
          timestamp: new Date().toISOString(),
        });
      }
    }
  );
}

// Declare the authenticate decorator type
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }

  interface FastifyRequest {
    user?: any;
  }
}

export default fp(authPlugin, {
  name: "fastify-auth",
});

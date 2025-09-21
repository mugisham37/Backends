import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import {
  fastifyAuthMiddleware,
  fastifyFlexibleAuth,
  fastifyOptionalAuthMiddleware,
  fastifyRequireApiKey,
  fastifyRequireAuth,
  fastifyRequireRoles,
} from "./auth";

/**
 * Enhanced Fastify Authentication Plugin
 *
 * Provides comprehensive authentication middleware for Fastify routes
 * including JWT tokens, API keys, role-based access, and flexible auth.
 */
async function authPlugin(fastify: FastifyInstance) {
  // Register standard authentication decorator
  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return fastifyAuthMiddleware(request, reply);
    }
  );

  // Register optional authentication decorator
  fastify.decorate(
    "optionalAuthenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return fastifyOptionalAuthMiddleware(request, reply);
    }
  );

  // Register require authentication decorator
  fastify.decorate(
    "requireAuth",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return fastifyRequireAuth(request, reply);
    }
  );

  // Register role-based authentication decorator
  fastify.decorate("requireRoles", (roles: string[]) =>
    fastifyRequireRoles(roles)
  );

  // Register API key authentication decorator
  fastify.decorate(
    "requireApiKey",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return fastifyRequireApiKey(request, reply);
    }
  );

  // Register flexible authentication decorator (JWT or API key)
  fastify.decorate(
    "flexibleAuth",
    async (request: FastifyRequest, reply: FastifyReply) => {
      return fastifyFlexibleAuth(request, reply);
    }
  );

  // Type definitions for decorators
  fastify.addHook("onReady", async () => {
    fastify.log.info("Enhanced authentication plugin registered successfully");
  });
} // Enhanced type declarations for all decorators
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    optionalAuthenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    requireAuth: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    requireRoles: (
      roles: string[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireApiKey: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    flexibleAuth: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }

  interface FastifyRequest {
    authUser?: {
      id: string;
      email: string;
      role: string;
      tenantId?: string;
    };
    apiKey?: {
      id: string;
      scopes: string[];
      tenantId?: string;
    };
  }
}

export default fp(authPlugin, {
  name: "enhanced-authentication",
  fastify: "4.x",
});

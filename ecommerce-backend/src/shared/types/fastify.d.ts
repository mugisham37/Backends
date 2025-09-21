/**
 * Fastify Type Extensions
 * Centralized type declarations for Fastify to avoid conflicts
 */

import type { User } from "../../core/database/schema/users.js";

declare module "fastify" {
  interface FastifyRequest {
    // User authentication
    user?: Omit<User, "password">;
    userId?: string;

    // Performance monitoring
    startTime?: number;
  }
}

// Type guard to check if request is authenticated
export interface AuthenticatedRequest extends FastifyRequest {
  user: Omit<User, "password">;
  userId: string;
}

export const isAuthenticatedRequest = (
  request: FastifyRequest
): request is AuthenticatedRequest => {
  return !!request.user && !!request.userId;
};

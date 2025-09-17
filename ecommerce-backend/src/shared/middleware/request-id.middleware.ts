/**
 * Request ID middleware for correlation tracking
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";

export const requestIdMiddleware = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> => {
  const requestId = (request.headers["x-request-id"] as string) || randomUUID();
  (request as any).id = requestId;
  reply.header("X-Request-ID", requestId);
};

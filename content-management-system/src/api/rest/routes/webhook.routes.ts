import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { container } from "tsyringe";
import type { IWebhookService } from "../../../core/types/service.types";

export const webhookRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  const webhookService = container.resolve<IWebhookService>("WebhookService");

  // Get all webhooks
  fastify.get(
    "/",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      // Implementation placeholder
      return reply.status(501).send({
        error: "Not Implemented",
        message: "Webhook listing endpoint not yet implemented",
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Create webhook
  fastify.post(
    "/",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      // Implementation placeholder
      return reply.status(501).send({
        error: "Not Implemented",
        message: "Webhook creation endpoint not yet implemented",
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Delete webhook
  fastify.delete(
    "/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      // Implementation placeholder
      return reply.status(501).send({
        error: "Not Implemented",
        message: "Webhook deletion endpoint not yet implemented",
        timestamp: new Date().toISOString(),
      });
    }
  );
};

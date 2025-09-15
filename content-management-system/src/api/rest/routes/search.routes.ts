import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { container } from "tsyringe";
import type { ISearchService } from "../../../core/types/service.types";

export const searchRoutes: FastifyPluginAsync = async (
  fastify: FastifyInstance
) => {
  const searchService = container.resolve<ISearchService>("SearchService");

  // Search endpoint
  fastify.get(
    "/",
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: {
          type: "object",
          required: ["q"],
          properties: {
            q: { type: "string", minLength: 1 },
            type: { type: "string" },
            page: { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      // Implementation placeholder
      return reply.status(501).send({
        error: "Not Implemented",
        message: "Search endpoint not yet implemented",
        timestamp: new Date().toISOString(),
      });
    }
  );
};

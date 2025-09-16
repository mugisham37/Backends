/**
 * GraphQL Fastify Plugin
 * Integrates Apollo Server with Fastify
 */

import { FastifyPluginAsync } from "fastify";
import fastifyApollo from "@as-integrations/fastify";
import { createGraphQLServer } from "./index.js";

export const graphqlPlugin: FastifyPluginAsync = async (fastify) => {
  // Create Apollo Server
  const server = createGraphQLServer();

  // Start the server
  await server.start();

  // Register the Apollo Server handler with Fastify
  await fastify.register(fastifyApollo(server), {
    context: async (request, reply) => {
      // Create GraphQL context from Fastify request
      return {
        req: {
          headers: request.headers,
          ip: request.ip,
        },
      };
    },
  });

  // Add GraphQL playground route in development
  if (process.env.NODE_ENV !== "production") {
    fastify.get("/graphql/playground", async (request, reply) => {
      const playgroundHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>GraphQL Playground</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/css/index.css" />
        </head>
        <body>
          <div id="root">
            <style>
              body { margin: 0; font-family: Open Sans, sans-serif; overflow: hidden; }
              #root { height: 100vh; }
            </style>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/middleware.js"></script>
          <script>
            window.addEventListener('load', function (event) {
              GraphQLPlayground.init(document.getElementById('root'), {
                endpoint: '/graphql'
              })
            })
          </script>
        </body>
        </html>
      `;

      reply.type("text/html").send(playgroundHTML);
    });
  }
};

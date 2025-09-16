/**
 * GraphQL WebSocket Server
 * Handles GraphQL subscriptions over WebSocket connections
 */

import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { typeDefs } from "./schema/index.js";
import { resolvers } from "./resolvers/index.js";
import { createContext } from "./context.js";
import { Server } from "http";

// Create executable schema for subscriptions
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

export interface WebSocketServerOptions {
  server: Server;
  path?: string;
}

export const createWebSocketServer = ({
  server,
  path = "/graphql",
}: WebSocketServerOptions) => {
  // Create WebSocket server
  const wsServer = new WebSocketServer({
    server,
    path,
  });

  // Use the WebSocket server for GraphQL subscriptions
  const serverCleanup = useServer(
    {
      schema,

      // Context creation for subscriptions
      context: async (ctx, msg, args) => {
        // Extract authentication from connection params or headers
        const token =
          ctx.connectionParams?.authorization ||
          ctx.connectionParams?.Authorization;

        // Create context similar to HTTP requests
        const context = await createContext({
          req: {
            headers: {
              authorization: token ? `Bearer ${token}` : undefined,
            },
          },
        });

        return context;
      },

      // Connection initialization
      onConnect: async (ctx) => {
        console.log("GraphQL WebSocket client connected");
        return true;
      },

      // Connection termination
      onDisconnect: (ctx, code, reason) => {
        console.log("GraphQL WebSocket client disconnected:", code, reason);
      },

      // Error handling
      onError: (ctx, msg, errors) => {
        console.error("GraphQL WebSocket error:", errors);
      },

      // Subscription execution
      onSubscribe: async (ctx, msg) => {
        console.log("GraphQL subscription started:", msg.payload.operationName);
      },

      // Subscription completion
      onComplete: (ctx, msg) => {
        console.log("GraphQL subscription completed:", msg.id);
      },
    },
    wsServer
  );

  return {
    wsServer,
    cleanup: serverCleanup,
  };
};

// Authentication middleware for WebSocket connections
export const authenticateWebSocket = (connectionParams: any) => {
  const token =
    connectionParams?.authorization || connectionParams?.Authorization;

  if (!token) {
    throw new Error("Authentication token required for subscriptions");
  }

  // Extract token from "Bearer <token>" format
  const actualToken = token.startsWith("Bearer ") ? token.substring(7) : token;

  return actualToken;
};

// Helper to broadcast subscription updates
export const broadcastToSubscribers = (
  pubsub: any,
  event: string,
  payload: any
) => {
  try {
    pubsub.publish(event, payload);
  } catch (error) {
    console.error("Failed to broadcast subscription update:", error);
  }
};

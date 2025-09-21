/**
 * GraphQL Server Integration Example
 * Shows how to integrate GraphQL with Fastify and WebSocket subscriptions
 */

import Fastify from "fastify";
import { createServer } from "http";
import { graphqlPlugin } from "./plugin.js";
import { createWebSocketServer } from "./websocket.js";

// Example of how to integrate GraphQL with Fastify and WebSocket subscriptions
export const createIntegratedServer = async (port: number = 3000) => {
  // Create Fastify instance
  const fastify = Fastify({
    logger: true,
  });

  // Create HTTP server for WebSocket upgrade
  const server = createServer();

  // Register GraphQL plugin
  await fastify.register(graphqlPlugin);

  // Create WebSocket server for subscriptions
  const { wsServer, cleanup } = createWebSocketServer({
    server,
    path: "/graphql",
  });

  // Health check endpoint
  fastify.get("/health", async (request, reply) => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // Start the server
  const start = async () => {
    try {
      await fastify.listen({ port, host: "0.0.0.0" });
      console.log(`🚀 Server running at http://localhost:${port}`);
      console.log(`📊 GraphQL endpoint: http://localhost:${port}/graphql`);
      console.log(`🔌 GraphQL subscriptions: ws://localhost:${port}/graphql`);

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `🎮 GraphQL Playground: http://localhost:${port}/graphql/playground`
        );
      }
    } catch (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  };

  // Graceful shutdown
  const shutdown = async () => {
    console.log("🛑 Shutting down server...");

    try {
      // Close WebSocket server
      await cleanup.dispose();
      wsServer.close();

      // Close Fastify server
      await fastify.close();

      console.log("✅ Server shutdown complete");
    } catch (err) {
      console.error("❌ Error during shutdown:", err);
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  return {
    fastify,
    server,
    wsServer,
    start,
    shutdown,
  };
};

// Example GraphQL queries and mutations for testing
export const exampleQueries = {
  // Health check
  health: `
    query {
      health
    }
  `,

  // Get current user
  me: `
    query {
      me {
        id
        email
        firstName
        lastName
        role
        status
      }
    }
  `,

  // Get vendors with pagination
  vendors: `
    query GetVendors($pagination: PaginationInput) {
      vendors(pagination: $pagination) {
        edges {
          node {
            id
            businessName
            slug
            status
            verificationStatus
            createdAt
          }
          cursor
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        totalCount
      }
    }
  `,

  // Get products with filters
  products: `
    query GetProducts($filters: ProductFiltersInput, $pagination: PaginationInput) {
      products(filters: $filters, pagination: $pagination) {
        edges {
          node {
            id
            name
            slug
            price
            status
            vendor {
              businessName
            }
            isInStock
            images
          }
        }
        totalCount
      }
    }
  `,

  // Login mutation
  login: `
    mutation Login($input: LoginInput!) {
      login(input: $input) {
        user {
          id
          email
          role
        }
        accessToken
        refreshToken
      }
    }
  `,

  // Create product mutation
  createProduct: `
    mutation CreateProduct($input: CreateProductInput!) {
      createProduct(input: $input) {
        id
        name
        slug
        price
        status
        vendor {
          businessName
        }
      }
    }
  `,
};

// Example subscriptions for testing
export const exampleSubscriptions = {
  // User updates
  userUpdated: `
    subscription UserUpdated($userId: ID!) {
      userUpdated(userId: $userId) {
        id
        email
        firstName
        lastName
        status
        updatedAt
      }
    }
  `,

  // Vendor status changes (admin only)
  vendorStatusChanged: `
    subscription VendorStatusChanged {
      vendorStatusChanged {
        id
        businessName
        status
        verificationStatus
        updatedAt
      }
    }
  `,

  // Product updates
  productUpdated: `
    subscription ProductUpdated($productId: ID!) {
      productUpdated(productId: $productId) {
        id
        name
        price
        status
        quantity
        updatedAt
      }
    }
  `,

  // Low stock alerts (vendor only)
  lowStockAlert: `
    subscription LowStockAlert($vendorId: ID!) {
      lowStockAlert(vendorId: $vendorId) {
        id
        name
        quantity
        lowStockThreshold
        vendor {
          businessName
        }
      }
    }
  `,

  // Order updates
  orderUpdated: `
    subscription OrderUpdated($orderId: ID!) {
      orderUpdated(orderId: $orderId) {
        id
        orderNumber
        status
        paymentStatus
        shippingStatus
        total
        updatedAt
      }
    }
  `,
};

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
  createIntegratedServer(4000).then(({ start }) => start());
}

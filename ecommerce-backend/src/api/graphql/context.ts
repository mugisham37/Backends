/**
 * GraphQL Context
 * Provides request context, authentication, and data sources to resolvers
 */

import { BaseContext } from "@apollo/server";
import { Database } from "../../core/database/connection.js";
import { UserRepository } from "../../core/repositories/user.repository.js";
import { VendorRepository } from "../../core/repositories/vendor.repository.js";
import { ProductRepository } from "../../core/repositories/product.repository.js";
import { OrderRepository } from "../../core/repositories/order.repository.js";
import { User } from "../../core/database/schema/index.js";
import { verifyJWT } from "../../shared/utils/jwt.utils.js";
import { UserLoader } from "./dataloaders/user.loader.js";
import { VendorLoader } from "./dataloaders/vendor.loader.js";
import { ProductLoader } from "./dataloaders/product.loader.js";

export interface GraphQLContext extends BaseContext {
  // Database connection
  db: Database;

  // Repositories (data sources)
  repositories: {
    user: UserRepository;
    vendor: VendorRepository;
    product: ProductRepository;
    order: OrderRepository;
  };

  // DataLoaders for efficient data fetching
  loaders: {
    user: UserLoader;
    vendor: VendorLoader;
    product: ProductLoader;
  };

  // Authentication
  user?: User;
  isAuthenticated: boolean;

  // Request metadata
  requestId: string;
  userAgent?: string;
  ip?: string;
}

export interface ContextInput {
  req?: {
    headers: Record<string, string | string[] | undefined>;
    ip?: string;
  };
}

// Create GraphQL context
export const createContext = async ({
  req,
}: ContextInput): Promise<GraphQLContext> => {
  // Get database connection (this would come from your DI container)
  const db = await import("../../core/database/connection.js").then((m) =>
    m.getDatabase()
  );

  // Initialize repositories
  const repositories = {
    user: new UserRepository(db),
    vendor: new VendorRepository(db),
    product: new ProductRepository(db),
    order: new OrderRepository(db),
  };

  // Initialize data loaders
  const loaders = {
    user: new UserLoader(repositories.user),
    vendor: new VendorLoader(repositories.vendor),
    product: new ProductLoader(repositories.product),
  };

  // Generate request ID
  const requestId = crypto.randomUUID();

  // Extract user agent and IP
  const userAgent = Array.isArray(req?.headers["user-agent"])
    ? req.headers["user-agent"][0]
    : req?.headers["user-agent"];
  const ip = req?.ip;

  // Initialize context
  let user: User | undefined;
  let isAuthenticated = false;

  // Extract and verify JWT token
  const authHeader = Array.isArray(req?.headers.authorization)
    ? req.headers.authorization[0]
    : req?.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7);
      const payload = await verifyJWT(token);

      if (payload.userId) {
        user = await repositories.user.findById(payload.userId);
        isAuthenticated = !!user;
      }
    } catch (error) {
      // Invalid token - continue as unauthenticated
      console.warn("Invalid JWT token:", error);
    }
  }

  return {
    db,
    repositories,
    loaders,
    user: user || undefined,
    isAuthenticated,
    requestId,
    userAgent,
    ip,
  };
};

// Helper function to require authentication
export const requireAuth = (context: GraphQLContext): User => {
  if (!context.isAuthenticated || !context.user) {
    throw new Error("Authentication required");
  }
  return context.user;
};

// Helper function to require specific role
export const requireRole = (context: GraphQLContext, roles: string[]): User => {
  const user = requireAuth(context);

  if (!roles.includes(user.role)) {
    throw new Error("Insufficient permissions");
  }

  return user;
};

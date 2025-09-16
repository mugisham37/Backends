/**
 * User GraphQL Resolvers
 * Handles user-related queries, mutations, and subscriptions
 */

import { GraphQLError } from "graphql";
import { GraphQLContext, requireAuth, requireRole } from "../context.js";
import { UserFilters } from "../../../core/repositories/user.repository.js";
import {
  hashPassword,
  comparePassword,
} from "../../../shared/utils/crypto.utils.js";
import { generateJWT, verifyJWT } from "../../../shared/utils/jwt.utils.js";
import {
  subscriptionManager,
  SUBSCRIPTION_EVENTS,
  publishUserUpdate,
} from "../subscriptions/index.js";

// Helper function to build pagination
const buildPagination = (args: any) => {
  const { pagination, sortBy = "createdAt", sortOrder = "DESC" } = args;
  return {
    limit: pagination?.first || 20,
    offset: 0, // Simplified - in real app, implement cursor-based pagination
    sortBy,
    sortOrder,
  };
};

export const userResolvers = {
  Query: {
    user: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      try {
        const user = await context.repositories.user.findById(id);
        if (!user) {
          throw new GraphQLError("User not found", {
            extensions: { code: "USER_NOT_FOUND" },
          });
        }
        return user;
      } catch (error) {
        throw new GraphQLError(`Failed to fetch user: ${error.message}`);
      }
    },

    users: async (_: any, args: any, context: GraphQLContext) => {
      // Require admin role to list users
      requireRole(context, ["admin", "moderator"]);

      try {
        const { filters, pagination } = args;
        const paginationOptions = buildPagination(args);

        const users = await context.repositories.user.findWithFilters(
          filters || {}
        );
        const totalCount = await context.repositories.user.count();

        // Apply pagination (simplified)
        const startIndex = paginationOptions.offset;
        const endIndex = startIndex + paginationOptions.limit;
        const paginatedUsers = users.slice(startIndex, endIndex);

        return {
          edges: paginatedUsers.map((user, index) => ({
            node: user,
            cursor: Buffer.from(`${startIndex + index}`).toString("base64"),
          })),
          nodes: paginatedUsers,
          pageInfo: {
            hasNextPage: endIndex < users.length,
            hasPreviousPage: startIndex > 0,
            startCursor:
              paginatedUsers.length > 0
                ? Buffer.from(`${startIndex}`).toString("base64")
                : null,
            endCursor:
              paginatedUsers.length > 0
                ? Buffer.from(`${endIndex - 1}`).toString("base64")
                : null,
          },
          totalCount,
        };
      } catch (error) {
        throw new GraphQLError(`Failed to fetch users: ${error.message}`);
      }
    },

    me: async (_: any, __: any, context: GraphQLContext) => {
      const user = requireAuth(context);
      return user;
    },

    userStats: async (_: any, __: any, context: GraphQLContext) => {
      requireRole(context, ["admin"]);

      try {
        return await context.repositories.user.getStatistics();
      } catch (error) {
        throw new GraphQLError(
          `Failed to fetch user statistics: ${error.message}`
        );
      }
    },
  },

  Mutation: {
    login: async (_: any, { input }: any, context: GraphQLContext) => {
      try {
        const { email, password } = input;

        // Find user by email
        const user = await context.repositories.user.findByEmail(email);
        if (!user) {
          throw new GraphQLError("Invalid credentials", {
            extensions: { code: "INVALID_CREDENTIALS" },
          });
        }

        // Verify password
        const isValidPassword = await comparePassword(password, user.password);
        if (!isValidPassword) {
          throw new GraphQLError("Invalid credentials", {
            extensions: { code: "INVALID_CREDENTIALS" },
          });
        }

        // Check if user is active
        if (user.status !== "active") {
          throw new GraphQLError("Account is not active", {
            extensions: { code: "ACCOUNT_INACTIVE" },
          });
        }

        // Update last login
        await context.repositories.user.updateLastLogin(user.id);

        // Generate tokens
        const accessToken = await generateJWT({
          userId: user.id,
          role: user.role,
        });
        const refreshToken = await generateJWT(
          { userId: user.id, type: "refresh" },
          "7d"
        );

        return {
          user,
          accessToken,
          refreshToken,
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(`Login failed: ${error.message}`);
      }
    },

    register: async (_: any, { input }: any, context: GraphQLContext) => {
      try {
        const { email, password, firstName, lastName, phoneNumber } = input;

        // Check if email already exists
        const existingUser = await context.repositories.user.findByEmail(email);
        if (existingUser) {
          throw new GraphQLError("Email already registered", {
            extensions: { code: "EMAIL_EXISTS" },
          });
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
        const user = await context.repositories.user.create({
          email,
          password: hashedPassword,
          firstName,
          lastName,
          phoneNumber,
          role: "customer",
          status: "active",
        });

        // Generate tokens
        const accessToken = await generateJWT({
          userId: user.id,
          role: user.role,
        });
        const refreshToken = await generateJWT(
          { userId: user.id, type: "refresh" },
          "7d"
        );

        return {
          user,
          accessToken,
          refreshToken,
        };
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(`Registration failed: ${error.message}`);
      }
    },

    refreshToken: async (
      _: any,
      { refreshToken }: any,
      context: GraphQLContext
    ) => {
      try {
        // Verify refresh token
        const payload = await verifyJWT(refreshToken);
        if (payload.type !== "refresh") {
          throw new GraphQLError("Invalid refresh token");
        }

        // Find user
        const user = await context.repositories.user.findById(payload.userId);
        if (!user || user.status !== "active") {
          throw new GraphQLError("User not found or inactive");
        }

        // Generate new tokens
        const newAccessToken = await generateJWT({
          userId: user.id,
          role: user.role,
        });
        const newRefreshToken = await generateJWT(
          { userId: user.id, type: "refresh" },
          "7d"
        );

        return {
          user,
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        };
      } catch (error) {
        throw new GraphQLError(`Token refresh failed: ${error.message}`);
      }
    },

    updateProfile: async (_: any, { input }: any, context: GraphQLContext) => {
      const user = requireAuth(context);

      try {
        const updatedUser = await context.repositories.user.update(
          user.id,
          input
        );
        if (!updatedUser) {
          throw new GraphQLError("Failed to update profile");
        }

        // Publish subscription
        publishUserUpdate(updatedUser);

        return updatedUser;
      } catch (error) {
        throw new GraphQLError(`Profile update failed: ${error.message}`);
      }
    },

    createUser: async (_: any, { input }: any, context: GraphQLContext) => {
      requireRole(context, ["admin"]);

      try {
        const { password, ...userData } = input;
        const hashedPassword = await hashPassword(password);

        const user = await context.repositories.user.create({
          ...userData,
          password: hashedPassword,
        });

        return user;
      } catch (error) {
        throw new GraphQLError(`User creation failed: ${error.message}`);
      }
    },

    updateUserStatus: async (
      _: any,
      { id, input }: any,
      context: GraphQLContext
    ) => {
      requireRole(context, ["admin", "moderator"]);

      try {
        const updatedUser = await context.repositories.user.update(id, input);
        if (!updatedUser) {
          throw new GraphQLError("User not found");
        }

        // Publish subscription
        subscriptionManager.publish(SUBSCRIPTION_EVENTS.USER_STATUS_CHANGED, {
          userStatusChanged: updatedUser,
        });

        return updatedUser;
      } catch (error) {
        throw new GraphQLError(`Status update failed: ${error.message}`);
      }
    },

    logout: async (_: any, __: any, context: GraphQLContext) => {
      requireAuth(context);
      // In a real app, you'd invalidate the token (add to blacklist, etc.)
      return true;
    },
  },

  Subscription: {
    userUpdated: {
      subscribe: (_: any, { userId }: any, context: GraphQLContext) =>
        subscriptionManager.createAuthenticatedIterator(
          SUBSCRIPTION_EVENTS.USER_UPDATED,
          context,
          subscriptionManager.createUserFilter(userId)
        ),
    },
    userStatusChanged: {
      subscribe: (_: any, __: any, context: GraphQLContext) =>
        subscriptionManager.createAuthenticatedIterator(
          SUBSCRIPTION_EVENTS.USER_STATUS_CHANGED,
          context,
          subscriptionManager.createRoleFilter(["admin", "moderator"])
        ),
    },
  },

  User: {
    fullName: (user: any) => {
      const parts = [user.firstName, user.lastName].filter(Boolean);
      return parts.length > 0 ? parts.join(" ") : null;
    },

    vendor: async (user: any, _: any, context: GraphQLContext) => {
      if (user.role !== "vendor") return null;
      return await context.repositories.vendor.findByUserId(user.id);
    },

    orders: async (user: any, args: any, context: GraphQLContext) => {
      // This would be implemented when we have the order repository
      // For now, return empty connection
      return {
        edges: [],
        nodes: [],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: null,
          endCursor: null,
        },
        totalCount: 0,
      };
    },
  },
};

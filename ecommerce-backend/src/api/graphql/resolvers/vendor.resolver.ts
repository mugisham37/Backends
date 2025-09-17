/**
 * Vendor GraphQL Resolvers
 * Handles vendor-related queries, mutations, and subscriptions
 */

import { GraphQLError } from "graphql";
import { GraphQLContext, requireAuth, requireRole } from "../context.js";
import { VendorFilters } from "../../../core/repositories/vendor.repository.js";
import { PubSub } from "graphql-subscriptions";

const pubsub = new PubSub() as any; // Temporary fix for TypeScript issues

// Helper function to generate slug from business name
const generateSlug = (businessName: string): string => {
  return businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const vendorResolvers = {
  Query: {
    vendor: async (
      _: any,
      { id, slug }: { id?: string; slug?: string },
      context: GraphQLContext
    ) => {
      try {
        let vendor;
        if (id) {
          vendor = await context.repositories.vendor.findById(id);
        } else if (slug) {
          vendor = await context.repositories.vendor.findBySlug(slug);
        } else {
          throw new GraphQLError("Either id or slug must be provided");
        }

        if (!vendor) {
          throw new GraphQLError("Vendor not found", {
            extensions: { code: "VENDOR_NOT_FOUND" },
          });
        }

        return vendor;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(`Failed to fetch vendor: ${error.message}`);
      }
    },

    vendors: async (_: any, args: any, context: GraphQLContext) => {
      try {
        const { filters, pagination } = args;

        const vendors = await context.repositories.vendor.findWithFilters(
          filters || {}
        );
        const totalCount = await context.repositories.vendor.count();

        // Apply pagination (simplified)
        const limit = pagination?.first || 20;
        const paginatedVendors = vendors.slice(0, limit);

        return {
          edges: paginatedVendors.map((vendor, index) => ({
            node: vendor,
            cursor: Buffer.from(`${index}`).toString("base64"),
          })),
          nodes: paginatedVendors,
          pageInfo: {
            hasNextPage: vendors.length > limit,
            hasPreviousPage: false,
            startCursor:
              paginatedVendors.length > 0
                ? Buffer.from("0").toString("base64")
                : null,
            endCursor:
              paginatedVendors.length > 0
                ? Buffer.from(`${paginatedVendors.length - 1}`).toString(
                    "base64"
                  )
                : null,
          },
          totalCount,
        };
      } catch (error) {
        throw new GraphQLError(`Failed to fetch vendors: ${error.message}`);
      }
    },

    myVendor: async (_: any, __: any, context: GraphQLContext) => {
      const user = requireAuth(context);

      try {
        const vendor = await context.repositories.vendor.findByUserId(user.id);
        return vendor;
      } catch (error) {
        throw new GraphQLError(
          `Failed to fetch vendor profile: ${error.message}`
        );
      }
    },

    vendorStats: async (_: any, __: any, context: GraphQLContext) => {
      requireRole(context, ["admin"]);

      try {
        const stats = await context.repositories.vendor.getStatistics();
        const recentVendors =
          await context.repositories.vendor.getRecentVendors(5);

        return {
          ...stats,
          recentVendors,
        };
      } catch (error) {
        throw new GraphQLError(
          `Failed to fetch vendor statistics: ${error.message}`
        );
      }
    },

    topVendors: async (
      _: any,
      { limit = 10 }: any,
      context: GraphQLContext
    ) => {
      try {
        const topVendors =
          await context.repositories.vendor.getTopVendorsByProducts(limit);
        return topVendors;
      } catch (error) {
        throw new GraphQLError(`Failed to fetch top vendors: ${error.message}`);
      }
    },
  },

  Mutation: {
    createVendor: async (_: any, { input }: any, context: GraphQLContext) => {
      requireRole(context, ["admin"]);

      try {
        const { businessName, email, ...vendorData } = input;

        // Check if email already exists
        const existingVendor = await context.repositories.vendor.findByEmail(
          email
        );
        if (existingVendor) {
          throw new GraphQLError(
            "Email already registered for another vendor",
            {
              extensions: { code: "EMAIL_EXISTS" },
            }
          );
        }

        // Generate slug
        let slug = generateSlug(businessName);
        let slugExists = await context.repositories.vendor.slugExists(slug);
        let counter = 1;

        while (slugExists) {
          slug = `${generateSlug(businessName)}-${counter}`;
          slugExists = await context.repositories.vendor.slugExists(slug);
          counter++;
        }

        // Create vendor (assuming userId is provided or current user)
        const vendor = await context.repositories.vendor.create({
          businessName,
          slug,
          email,
          userId: context.user!.id, // This should be provided in input in real app
          ...vendorData,
        });

        return vendor;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(`Vendor creation failed: ${error.message}`);
      }
    },

    applyAsVendor: async (_: any, { input }: any, context: GraphQLContext) => {
      const user = requireAuth(context);

      try {
        // Check if user already has a vendor profile
        const existingVendor = await context.repositories.vendor.findByUserId(
          user.id
        );
        if (existingVendor) {
          throw new GraphQLError("User already has a vendor profile", {
            extensions: { code: "VENDOR_EXISTS" },
          });
        }

        const { businessName, email, ...vendorData } = input;

        // Check if email already exists
        const existingVendorByEmail =
          await context.repositories.vendor.findByEmail(email);
        if (existingVendorByEmail) {
          throw new GraphQLError(
            "Email already registered for another vendor",
            {
              extensions: { code: "EMAIL_EXISTS" },
            }
          );
        }

        // Generate slug
        let slug = generateSlug(businessName);
        let slugExists = await context.repositories.vendor.slugExists(slug);
        let counter = 1;

        while (slugExists) {
          slug = `${generateSlug(businessName)}-${counter}`;
          slugExists = await context.repositories.vendor.slugExists(slug);
          counter++;
        }

        // Create vendor application
        const vendor = await context.repositories.vendor.create({
          userId: user.id,
          businessName,
          slug,
          email,
          status: "pending",
          ...vendorData,
        });

        // Publish subscription for admin notifications
        pubsub.publish("VENDOR_APPLICATION_RECEIVED", {
          vendorApplicationReceived: vendor,
        });

        return vendor;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(`Vendor application failed: ${error.message}`);
      }
    },

    updateVendor: async (
      _: any,
      { id, input }: any,
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      try {
        const vendor = await context.repositories.vendor.findById(id);
        if (!vendor) {
          throw new GraphQLError("Vendor not found");
        }

        // Check permissions
        const isOwner = vendor.userId === user.id;
        const isAdmin = ["admin", "moderator"].includes(user.role);

        if (!isOwner && !isAdmin) {
          throw new GraphQLError("Insufficient permissions");
        }

        const updatedVendor = await context.repositories.vendor.update(
          id,
          input
        );
        if (!updatedVendor) {
          throw new GraphQLError("Failed to update vendor");
        }

        // Publish subscription
        pubsub.publish("VENDOR_UPDATED", {
          vendorUpdated: updatedVendor,
          vendorId: id,
        });

        return updatedVendor;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(`Vendor update failed: ${error.message}`);
      }
    },

    updateVendorStatus: async (
      _: any,
      { id, input }: any,
      context: GraphQLContext
    ) => {
      requireRole(context, ["admin", "moderator"]);

      try {
        const updatedVendor = await context.repositories.vendor.updateStatus(
          id,
          input.status
        );

        if (!updatedVendor) {
          throw new GraphQLError("Vendor not found");
        }

        // Publish subscription
        pubsub.publish("VENDOR_STATUS_CHANGED", {
          vendorStatusChanged: updatedVendor,
        });

        return updatedVendor;
      } catch (error) {
        throw new GraphQLError(`Status update failed: ${error.message}`);
      }
    },

    updateVendorVerification: async (
      _: any,
      { id, input }: any,
      context: GraphQLContext
    ) => {
      requireRole(context, ["admin"]);

      try {
        const updatedVendor =
          await context.repositories.vendor.updateVerificationStatus(
            id,
            input.verificationStatus
          );

        if (!updatedVendor) {
          throw new GraphQLError("Vendor not found");
        }

        return updatedVendor;
      } catch (error) {
        throw new GraphQLError(`Verification update failed: ${error.message}`);
      }
    },

    updateVendorProfile: async (
      _: any,
      { input }: any,
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      try {
        const vendor = await context.repositories.vendor.findByUserId(user.id);
        if (!vendor) {
          throw new GraphQLError("Vendor profile not found");
        }

        const updatedVendor = await context.repositories.vendor.update(
          vendor.id,
          input
        );
        if (!updatedVendor) {
          throw new GraphQLError("Failed to update vendor profile");
        }

        return updatedVendor;
      } catch (error) {
        throw new GraphQLError(`Profile update failed: ${error.message}`);
      }
    },
  },

  Subscription: {
    vendorUpdated: {
      subscribe: (_: any, { vendorId }: any) =>
        pubsub.asyncIterator([`VENDOR_UPDATED_${vendorId}`]),
    },
    vendorStatusChanged: {
      subscribe: () => pubsub.asyncIterator(["VENDOR_STATUS_CHANGED"]),
    },
    vendorApplicationReceived: {
      subscribe: () => pubsub.asyncIterator(["VENDOR_APPLICATION_RECEIVED"]),
    },
  },

  Vendor: {
    user: async (vendor: any, _: any, context: GraphQLContext) => {
      return await context.repositories.user.findById(vendor.userId);
    },

    products: async (vendor: any, args: any, context: GraphQLContext) => {
      try {
        const products = await context.repositories.product.findByVendor(
          vendor.id
        );

        // Apply pagination (simplified)
        const limit = args.pagination?.first || 20;
        const paginatedProducts = products.slice(0, limit);

        return {
          edges: paginatedProducts.map((product, index) => ({
            node: product,
            cursor: Buffer.from(`${index}`).toString("base64"),
          })),
          nodes: paginatedProducts,
          pageInfo: {
            hasNextPage: products.length > limit,
            hasPreviousPage: false,
            startCursor:
              paginatedProducts.length > 0
                ? Buffer.from("0").toString("base64")
                : null,
            endCursor:
              paginatedProducts.length > 0
                ? Buffer.from(`${paginatedProducts.length - 1}`).toString(
                    "base64"
                  )
                : null,
          },
          totalCount: products.length,
        };
      } catch (error) {
        throw new GraphQLError(
          `Failed to fetch vendor products: ${error.message}`
        );
      }
    },

    orders: async (vendor: any, args: any, context: GraphQLContext) => {
      // This would be implemented when we have order-vendor relationships
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

    stats: async (vendor: any, _: any, context: GraphQLContext) => {
      try {
        const stats = await context.repositories.vendor.getVendorStats(
          vendor.id
        );
        return {
          ...stats,
          averageOrderValue: "0.00", // Would be calculated from orders
          conversionRate: 0.0, // Would be calculated from analytics
        };
      } catch (error) {
        throw new GraphQLError(
          `Failed to fetch vendor stats: ${error.message}`
        );
      }
    },
  },
};

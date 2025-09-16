/**
 * Product GraphQL Resolvers
 * Handles product-related queries, mutations, and subscriptions
 */

import { GraphQLError } from "graphql";
import { GraphQLContext, requireAuth, requireRole } from "../context.js";
import { ProductFilters } from "../../../core/repositories/product.repository.js";
import { PubSub } from "graphql-subscriptions";

const pubsub = new PubSub();

// Helper function to generate slug from product name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const productResolvers = {
  Query: {
    product: async (
      _: any,
      { id, slug }: { id?: string; slug?: string },
      context: GraphQLContext
    ) => {
      try {
        let product;
        if (id) {
          product = await context.repositories.product.findById(id);
        } else if (slug) {
          product = await context.repositories.product.findBySlug(slug);
        } else {
          throw new GraphQLError("Either id or slug must be provided");
        }

        if (!product) {
          throw new GraphQLError("Product not found", {
            extensions: { code: "PRODUCT_NOT_FOUND" },
          });
        }

        return product;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(`Failed to fetch product: ${error.message}`);
      }
    },

    products: async (_: any, args: any, context: GraphQLContext) => {
      try {
        const { filters, pagination } = args;

        const products = await context.repositories.product.findWithFilters(
          filters || {}
        );
        const totalCount = await context.repositories.product.count();

        // Apply pagination (simplified)
        const limit = pagination?.first || 20;
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
          totalCount,
        };
      } catch (error) {
        throw new GraphQLError(`Failed to fetch products: ${error.message}`);
      }
    },

    featuredProducts: async (
      _: any,
      { limit = 10 }: any,
      context: GraphQLContext
    ) => {
      try {
        return await context.repositories.product.getFeaturedProducts(limit);
      } catch (error) {
        throw new GraphQLError(
          `Failed to fetch featured products: ${error.message}`
        );
      }
    },

    lowStockProducts: async (_: any, __: any, context: GraphQLContext) => {
      const user = requireAuth(context);

      try {
        const products =
          await context.repositories.product.getLowStockProducts();

        // Filter by vendor if user is a vendor
        if (user.role === "vendor") {
          const vendor = await context.repositories.vendor.findByUserId(
            user.id
          );
          if (vendor) {
            return products.filter((product) => product.vendorId === vendor.id);
          }
        }

        return products;
      } catch (error) {
        throw new GraphQLError(
          `Failed to fetch low stock products: ${error.message}`
        );
      }
    },

    outOfStockProducts: async (_: any, __: any, context: GraphQLContext) => {
      const user = requireAuth(context);

      try {
        const products =
          await context.repositories.product.getOutOfStockProducts();

        // Filter by vendor if user is a vendor
        if (user.role === "vendor") {
          const vendor = await context.repositories.vendor.findByUserId(
            user.id
          );
          if (vendor) {
            return products.filter((product) => product.vendorId === vendor.id);
          }
        }

        return products;
      } catch (error) {
        throw new GraphQLError(
          `Failed to fetch out of stock products: ${error.message}`
        );
      }
    },

    searchProducts: async (
      _: any,
      { query, limit = 20 }: any,
      context: GraphQLContext
    ) => {
      try {
        const results =
          await context.repositories.product.searchForAutocomplete(
            query,
            limit
          );
        return results.map((result) => ({
          ...result,
          vendor: "Vendor Name", // Would be fetched from vendor repository
        }));
      } catch (error) {
        throw new GraphQLError(`Product search failed: ${error.message}`);
      }
    },

    productStats: async (
      _: any,
      { vendorId }: any,
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      // If vendorId is provided, check permissions
      if (vendorId) {
        const vendor = await context.repositories.vendor.findById(vendorId);
        if (!vendor) {
          throw new GraphQLError("Vendor not found");
        }

        // Check if user can access this vendor's stats
        const isOwner = vendor.userId === user.id;
        const isAdmin = ["admin", "moderator"].includes(user.role);

        if (!isOwner && !isAdmin) {
          throw new GraphQLError("Insufficient permissions");
        }
      } else {
        // Global stats - admin only
        requireRole(context, ["admin"]);
      }

      try {
        return await context.repositories.product.getStatistics();
      } catch (error) {
        throw new GraphQLError(
          `Failed to fetch product statistics: ${error.message}`
        );
      }
    },
  },

  Mutation: {
    createProduct: async (_: any, { input }: any, context: GraphQLContext) => {
      const user = requireAuth(context);

      try {
        let vendorId: string;

        if (user.role === "vendor") {
          const vendor = await context.repositories.vendor.findByUserId(
            user.id
          );
          if (!vendor) {
            throw new GraphQLError("Vendor profile not found");
          }
          if (vendor.status !== "approved") {
            throw new GraphQLError(
              "Vendor must be approved to create products"
            );
          }
          vendorId = vendor.id;
        } else if (["admin", "moderator"].includes(user.role)) {
          // Admin can create products for any vendor (vendorId should be in input)
          if (!input.vendorId) {
            throw new GraphQLError(
              "Vendor ID is required for admin product creation"
            );
          }
          vendorId = input.vendorId;
        } else {
          throw new GraphQLError("Insufficient permissions");
        }

        const { name, sku, ...productData } = input;

        // Generate slug
        let slug = generateSlug(name);
        let slugExists = await context.repositories.product.slugExists(slug);
        let counter = 1;

        while (slugExists) {
          slug = `${generateSlug(name)}-${counter}`;
          slugExists = await context.repositories.product.slugExists(slug);
          counter++;
        }

        // Check SKU uniqueness if provided
        if (sku) {
          const skuExists = await context.repositories.product.skuExists(sku);
          if (skuExists) {
            throw new GraphQLError("SKU already exists", {
              extensions: { code: "SKU_EXISTS" },
            });
          }
        }

        const product = await context.repositories.product.create({
          name,
          slug,
          sku,
          vendorId,
          ...productData,
        });

        return product;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(`Product creation failed: ${error.message}`);
      }
    },

    updateProduct: async (
      _: any,
      { id, input }: any,
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      try {
        const product = await context.repositories.product.findById(id);
        if (!product) {
          throw new GraphQLError("Product not found");
        }

        // Check permissions
        let canUpdate = false;
        if (user.role === "vendor") {
          const vendor = await context.repositories.vendor.findByUserId(
            user.id
          );
          canUpdate = vendor?.id === product.vendorId;
        } else if (["admin", "moderator"].includes(user.role)) {
          canUpdate = true;
        }

        if (!canUpdate) {
          throw new GraphQLError("Insufficient permissions");
        }

        // Check SKU uniqueness if being updated
        if (input.sku && input.sku !== product.sku) {
          const skuExists = await context.repositories.product.skuExists(
            input.sku,
            id
          );
          if (skuExists) {
            throw new GraphQLError("SKU already exists", {
              extensions: { code: "SKU_EXISTS" },
            });
          }
        }

        const updatedProduct = await context.repositories.product.update(
          id,
          input
        );
        if (!updatedProduct) {
          throw new GraphQLError("Failed to update product");
        }

        // Publish subscription
        pubsub.publish("PRODUCT_UPDATED", {
          productUpdated: updatedProduct,
          productId: id,
        });

        return updatedProduct;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError(`Product update failed: ${error.message}`);
      }
    },

    updateProductStatus: async (
      _: any,
      { id, input }: any,
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      try {
        const product = await context.repositories.product.findById(id);
        if (!product) {
          throw new GraphQLError("Product not found");
        }

        // Check permissions
        let canUpdate = false;
        if (user.role === "vendor") {
          const vendor = await context.repositories.vendor.findByUserId(
            user.id
          );
          canUpdate = vendor?.id === product.vendorId;
        } else if (["admin", "moderator"].includes(user.role)) {
          canUpdate = true;
        }

        if (!canUpdate) {
          throw new GraphQLError("Insufficient permissions");
        }

        const updatedProduct = await context.repositories.product.updateStatus(
          id,
          input.status
        );

        if (!updatedProduct) {
          throw new GraphQLError("Failed to update product status");
        }

        // Publish subscription
        pubsub.publish("PRODUCT_STATUS_CHANGED", {
          productStatusChanged: updatedProduct,
          vendorId: product.vendorId,
        });

        return updatedProduct;
      } catch (error) {
        throw new GraphQLError(`Status update failed: ${error.message}`);
      }
    },

    updateProductInventory: async (
      _: any,
      { id, input }: any,
      context: GraphQLContext
    ) => {
      const user = requireAuth(context);

      try {
        const product = await context.repositories.product.findById(id);
        if (!product) {
          throw new GraphQLError("Product not found");
        }

        // Check permissions
        let canUpdate = false;
        if (user.role === "vendor") {
          const vendor = await context.repositories.vendor.findByUserId(
            user.id
          );
          canUpdate = vendor?.id === product.vendorId;
        } else if (["admin", "moderator"].includes(user.role)) {
          canUpdate = true;
        }

        if (!canUpdate) {
          throw new GraphQLError("Insufficient permissions");
        }

        const updatedProduct =
          await context.repositories.product.updateInventory(
            id,
            input.quantity
          );

        if (!updatedProduct) {
          throw new GraphQLError("Failed to update inventory");
        }

        // Check for low stock or out of stock alerts
        if (updatedProduct.trackQuantity) {
          if (updatedProduct.quantity === 0) {
            pubsub.publish("OUT_OF_STOCK_ALERT", {
              outOfStockAlert: updatedProduct,
              vendorId: product.vendorId,
            });
          } else if (
            updatedProduct.quantity <= updatedProduct.lowStockThreshold
          ) {
            pubsub.publish("LOW_STOCK_ALERT", {
              lowStockAlert: updatedProduct,
              vendorId: product.vendorId,
            });
          }
        }

        return updatedProduct;
      } catch (error) {
        throw new GraphQLError(`Inventory update failed: ${error.message}`);
      }
    },
  },

  Subscription: {
    productUpdated: {
      subscribe: (_: any, { productId }: any) =>
        pubsub.asyncIterator(`PRODUCT_UPDATED_${productId}`),
    },
    productStatusChanged: {
      subscribe: (_: any, { vendorId }: any) =>
        vendorId
          ? pubsub.asyncIterator(`PRODUCT_STATUS_CHANGED_${vendorId}`)
          : pubsub.asyncIterator("PRODUCT_STATUS_CHANGED"),
    },
    lowStockAlert: {
      subscribe: (_: any, { vendorId }: any) =>
        pubsub.asyncIterator(`LOW_STOCK_ALERT_${vendorId}`),
    },
    outOfStockAlert: {
      subscribe: (_: any, { vendorId }: any) =>
        pubsub.asyncIterator(`OUT_OF_STOCK_ALERT_${vendorId}`),
    },
  },

  Product: {
    vendor: async (product: any, _: any, context: GraphQLContext) => {
      return await context.repositories.vendor.findById(product.vendorId);
    },

    category: async (product: any, _: any, context: GraphQLContext) => {
      if (!product.categoryId) return null;
      // This would be implemented when we have category repository
      return null;
    },

    variants: async (product: any, _: any, context: GraphQLContext) => {
      if (!product.hasVariants) return [];
      // This would be implemented when we have product variants repository
      return [];
    },

    isInStock: (product: any) => {
      if (!product.trackQuantity) return true;
      return product.quantity > 0;
    },

    isLowStock: (product: any) => {
      if (!product.trackQuantity) return false;
      return (
        product.quantity > 0 && product.quantity <= product.lowStockThreshold
      );
    },

    displayPrice: (product: any) => {
      return product.price;
    },

    savings: (product: any) => {
      if (!product.compareAtPrice) return null;
      const savings =
        parseFloat(product.compareAtPrice) - parseFloat(product.price);
      return savings > 0 ? savings.toString() : null;
    },

    savingsPercentage: (product: any) => {
      if (!product.compareAtPrice) return null;
      const comparePrice = parseFloat(product.compareAtPrice);
      const currentPrice = parseFloat(product.price);
      const savings = comparePrice - currentPrice;
      return savings > 0 ? (savings / comparePrice) * 100 : null;
    },
  },

  Category: {
    parent: async (category: any, _: any, context: GraphQLContext) => {
      if (!category.parentId) return null;
      // This would be implemented when we have category repository
      return null;
    },

    children: async (category: any, _: any, context: GraphQLContext) => {
      // This would be implemented when we have category repository
      return [];
    },

    products: async (category: any, args: any, context: GraphQLContext) => {
      try {
        const products = await context.repositories.product.findByCategory(
          category.id
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
          `Failed to fetch category products: ${error.message}`
        );
      }
    },

    productCount: async (category: any, _: any, context: GraphQLContext) => {
      try {
        const products = await context.repositories.product.findByCategory(
          category.id
        );
        return products.length;
      } catch (error) {
        return 0;
      }
    },
  },
};

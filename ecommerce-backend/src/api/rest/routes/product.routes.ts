/**
 * Product REST API routes
 * Fastify-based routes with proper validation and security
 */

import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { ProductService } from "../../../modules/ecommerce/products/product.service.js";
import { ProductRepository } from "../../../core/repositories/product.repository.js";
import { VendorRepository } from "../../../core/repositories/vendor.repository.js";
import { JWTService } from "../../../modules/auth/jwt.service.js";
import { AuthMiddleware } from "../../../shared/middleware/auth.middleware.js";
import {
  RateLimitMiddleware,
  rateLimitConfigs,
} from "../../../shared/middleware/rate-limit.middleware.js";
import { securityMiddleware } from "../../../shared/middleware/security.middleware.js";
import { db } from "../../../core/database/connection.js";
import {
  createProductSchema,
  updateProductSchema,
  productFiltersSchema,
} from "../../../shared/validators/product.validators.js";
import {
  CreateProductInput,
  UpdateProductInput,
} from "../../../modules/ecommerce/products/product.types.js";
import {
  ResponseBuilder,
  HTTP_STATUS,
} from "../../../shared/utils/response.utils.js";

// Interfaces for request/response types
interface ProductParams {
  id: string;
}

interface ProductQuery {
  vendorId?: string;
  categoryId?: string;
  status?: "active" | "inactive" | "draft" | "out_of_stock" | "discontinued";
  search?: string;
  minPrice?: string;
  maxPrice?: string;
  limit?: string;
  page?: string;
}

interface ProductStatusBody {
  status: "active" | "inactive" | "draft";
}

interface ProductInventoryBody {
  quantity: number;
}

export async function productRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
): Promise<void> {
  // Initialize services
  const jwtService = new JWTService();
  const productRepository = new ProductRepository(db);
  const vendorRepository = new VendorRepository(db);
  const productService = new ProductService(
    productRepository,
    vendorRepository
  );
  const authMiddleware = new AuthMiddleware(jwtService);
  const rateLimitMiddleware = new RateLimitMiddleware();

  // Apply security middleware to all product routes
  fastify.addHook("preHandler", securityMiddleware.securityHeaders());
  fastify.addHook("preHandler", securityMiddleware.sanitizeInput());

  // Apply rate limiting to product endpoints
  const productRateLimit = rateLimitMiddleware.createRateLimit(
    rateLimitConfigs.api
  );

  // Create product
  fastify.post<{
    Body: CreateProductInput;
  }>("/", {
    schema: {
      body: createProductSchema,
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, productRateLimit],
    handler: async (
      request: FastifyRequest<{ Body: CreateProductInput }>,
      reply: FastifyReply
    ) => {
      try {
        const vendorId = (request.user as any)?.vendorId;
        if (!vendorId) {
          return reply
            .status(HTTP_STATUS.BAD_REQUEST)
            .send(
              ResponseBuilder.error("Vendor ID required", "VENDOR_ID_REQUIRED")
            );
        }

        const product = await productService.createProduct(
          vendorId,
          request.body
        );

        return reply
          .status(HTTP_STATUS.CREATED)
          .send(
            ResponseBuilder.success(product, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create product";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(message, "CREATE_PRODUCT_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Get products with filtering
  fastify.get<{
    Querystring: ProductQuery;
  }>("/", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          vendorId: { type: "string" },
          categoryId: { type: "string" },
          status: {
            type: "string",
            enum: [
              "active",
              "inactive",
              "draft",
              "out_of_stock",
              "discontinued",
            ],
          },
          search: { type: "string" },
          minPrice: { type: "string" },
          maxPrice: { type: "string" },
          limit: { type: "string", default: "20" },
          page: { type: "string", default: "1" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "array" },
          },
        },
      },
    },
    preHandler: [productRateLimit],
    handler: async (
      request: FastifyRequest<{ Querystring: ProductQuery }>,
      reply: FastifyReply
    ) => {
      try {
        const {
          vendorId,
          categoryId,
          status,
          search,
          minPrice,
          maxPrice,
          limit = "20",
          page = "1",
        } = request.query;

        const filters = {
          ...(vendorId && { vendorId: vendorId as string }),
          ...(categoryId && { categoryId: categoryId as string }),
          ...(status && {
            status: status as
              | "active"
              | "inactive"
              | "draft"
              | "out_of_stock"
              | "discontinued",
          }),
          ...(search && { search: search as string }),
          ...(minPrice && { minPrice: parseFloat(minPrice as string) }),
          ...(maxPrice && { maxPrice: parseFloat(maxPrice as string) }),
          limit: parseInt(limit as string),
          offset: (parseInt(page as string) - 1) * parseInt(limit as string),
        };

        const products = await productService.searchProducts(filters);

        return reply.status(HTTP_STATUS.OK).send(
          ResponseBuilder.success(products, {
            requestId: (request as any).id,
          })
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch products";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(message, "FETCH_PRODUCTS_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Get featured products
  fastify.get<{
    Querystring: { limit?: string };
  }>("/featured", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          limit: { type: "string", default: "10" },
        },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "array" },
          },
        },
      },
    },
    preHandler: [productRateLimit],
    handler: async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { limit = "10" } = request.query;
        const products = await productService.getFeaturedProducts(
          parseInt(limit as string)
        );

        return reply.status(HTTP_STATUS.OK).send(
          ResponseBuilder.success(products, {
            requestId: (request as any).id,
          })
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to fetch featured products";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(message, "FETCH_FEATURED_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Get low stock products
  fastify.get("/low-stock", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "array" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, productRateLimit],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const vendorId = (request.user as any)?.vendorId;
        const products = await productService.getLowStockProducts(vendorId);

        return reply.status(HTTP_STATUS.OK).send(
          ResponseBuilder.success(products, {
            requestId: (request as any).id,
          })
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to fetch low stock products";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(message, "FETCH_LOW_STOCK_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Get product statistics
  fastify.get("/stats", {
    schema: {
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, productRateLimit],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const vendorId = (request.user as any)?.vendorId;
        const statistics = await productService.getProductStatistics(vendorId);

        return reply.status(HTTP_STATUS.OK).send(
          ResponseBuilder.success(statistics, {
            requestId: (request as any).id,
          })
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to fetch product statistics";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(message, "FETCH_STATISTICS_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Get single product
  fastify.get<{
    Params: ProductParams;
  }>("/:id", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: [productRateLimit],
    handler: async (
      request: FastifyRequest<{ Params: ProductParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const product = await productService.getProduct(id);

        if (!product) {
          return reply
            .status(HTTP_STATUS.NOT_FOUND)
            .send(
              ResponseBuilder.error(
                "Product not found",
                "PRODUCT_NOT_FOUND",
                undefined,
                { requestId: (request as any).id }
              )
            );
        }

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(product, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to fetch product";
        return reply.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send(
          ResponseBuilder.error(message, "FETCH_PRODUCT_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Update product
  fastify.put<{
    Params: ProductParams;
    Body: UpdateProductInput;
  }>("/:id", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
      body: updateProductSchema,
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, productRateLimit],
    handler: async (
      request: FastifyRequest<{
        Params: ProductParams;
        Body: UpdateProductInput;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const vendorId = (request.user as any)?.vendorId;

        if (!vendorId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error(
                "Vendor authentication required",
                "VENDOR_AUTH_REQUIRED"
              )
            );
        }

        const product = await productService.updateProduct(
          id,
          vendorId,
          request.body
        );

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(product, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update product";
        const status = message.includes("not found")
          ? HTTP_STATUS.NOT_FOUND
          : message.includes("Not authorized")
          ? HTTP_STATUS.FORBIDDEN
          : HTTP_STATUS.BAD_REQUEST;

        return reply.status(status).send(
          ResponseBuilder.error(message, "UPDATE_PRODUCT_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Update product status
  fastify.patch<{
    Params: ProductParams;
    Body: ProductStatusBody;
  }>("/:id/status", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
      body: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["active", "inactive", "draft"],
          },
        },
        required: ["status"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, productRateLimit],
    handler: async (
      request: FastifyRequest<{
        Params: ProductParams;
        Body: ProductStatusBody;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { status } = request.body;
        const vendorId = (request.user as any)?.vendorId;

        if (!vendorId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error(
                "Vendor authentication required",
                "VENDOR_AUTH_REQUIRED"
              )
            );
        }

        const product = await productService.updateProductStatus(
          id,
          vendorId,
          status
        );

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(product, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to update product status";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(message, "UPDATE_STATUS_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Update inventory
  fastify.patch<{
    Params: ProductParams;
    Body: ProductInventoryBody;
  }>("/:id/inventory", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
      body: {
        type: "object",
        properties: {
          quantity: { type: "number", minimum: 0 },
        },
        required: ["quantity"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },
    },
    preHandler: [authMiddleware.authenticate, productRateLimit],
    handler: async (
      request: FastifyRequest<{
        Params: ProductParams;
        Body: ProductInventoryBody;
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { quantity } = request.body;
        const vendorId = (request.user as any)?.vendorId;

        if (!vendorId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error(
                "Vendor authentication required",
                "VENDOR_AUTH_REQUIRED"
              )
            );
        }

        const product = await productService.updateInventory(
          id,
          vendorId,
          quantity
        );

        return reply
          .status(HTTP_STATUS.OK)
          .send(
            ResponseBuilder.success(product, { requestId: (request as any).id })
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update inventory";
        return reply.status(HTTP_STATUS.BAD_REQUEST).send(
          ResponseBuilder.error(message, "UPDATE_INVENTORY_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });

  // Delete product
  fastify.delete<{
    Params: ProductParams;
  }>("/:id", {
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
      response: {
        204: {
          type: "null",
        },
      },
    },
    preHandler: [authMiddleware.authenticate, productRateLimit],
    handler: async (
      request: FastifyRequest<{ Params: ProductParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const vendorId = (request.user as any)?.vendorId;

        if (!vendorId) {
          return reply
            .status(HTTP_STATUS.UNAUTHORIZED)
            .send(
              ResponseBuilder.error(
                "Vendor authentication required",
                "VENDOR_AUTH_REQUIRED"
              )
            );
        }

        await productService.deleteProduct(id, vendorId);

        return reply.status(HTTP_STATUS.NO_CONTENT).send();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to delete product";
        const status = message.includes("not found")
          ? HTTP_STATUS.NOT_FOUND
          : message.includes("Not authorized")
          ? HTTP_STATUS.FORBIDDEN
          : HTTP_STATUS.BAD_REQUEST;

        return reply.status(status).send(
          ResponseBuilder.error(message, "DELETE_PRODUCT_FAILED", undefined, {
            requestId: (request as any).id,
          })
        );
      }
    },
  });
}

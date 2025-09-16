/**
 * Product REST API routes
 * Clean controller with minimal complexity
 */

import { Router, Request, Response } from "express";
import { ProductService } from "../../../modules/ecommerce/products/product.service";
import {
  ResponseBuilder,
  HTTP_STATUS,
} from "../../../shared/utils/response.utils";
import {
  CreateProductInput,
  UpdateProductInput,
} from "../../../modules/ecommerce/products/product.types";

export class ProductController {
  private router = Router();

  constructor(private productService: ProductService) {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/", this.createProduct.bind(this));
    this.router.get("/", this.getProducts.bind(this));
    this.router.get("/featured", this.getFeaturedProducts.bind(this));
    this.router.get("/low-stock", this.getLowStockProducts.bind(this));
    this.router.get("/stats", this.getProductStatistics.bind(this));
    this.router.get("/:id", this.getProduct.bind(this));
    this.router.put("/:id", this.updateProduct.bind(this));
    this.router.patch("/:id/status", this.updateProductStatus.bind(this));
    this.router.patch("/:id/inventory", this.updateInventory.bind(this));
    this.router.delete("/:id", this.deleteProduct.bind(this));
  }

  async createProduct(req: Request, res: Response): Promise<void> {
    try {
      const vendorId = req.user?.vendorId || req.body.vendorId;
      if (!vendorId) {
        res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json(
            ResponseBuilder.error("Vendor ID required", "VENDOR_ID_REQUIRED")
          );
        return;
      }

      const input: CreateProductInput = req.body;
      const product = await this.productService.createProduct(vendorId, input);

      res
        .status(HTTP_STATUS.CREATED)
        .json(ResponseBuilder.success(product, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create product";
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          ResponseBuilder.error(message, "CREATE_PRODUCT_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async getProducts(req: Request, res: Response): Promise<void> {
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
      } = req.query;

      const filters = {
        ...(vendorId && { vendorId: vendorId as string }),
        ...(categoryId && { categoryId: categoryId as string }),
        ...(status && { status: status as string }),
        ...(search && { search: search as string }),
        ...(minPrice && { minPrice: parseFloat(minPrice as string) }),
        ...(maxPrice && { maxPrice: parseFloat(maxPrice as string) }),
        limit: parseInt(limit as string),
        offset: (parseInt(page as string) - 1) * parseInt(limit as string),
      };

      const products = await this.productService.searchProducts(filters);

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(products, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch products";
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(message, "FETCH_PRODUCTS_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async getProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const product = await this.productService.getProduct(id);

      if (!product) {
        res
          .status(HTTP_STATUS.NOT_FOUND)
          .json(
            ResponseBuilder.error(
              "Product not found",
              "PRODUCT_NOT_FOUND",
              undefined,
              { requestId: req.id }
            )
          );
        return;
      }

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(product, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch product";
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(message, "FETCH_PRODUCT_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async updateProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const vendorId = req.user?.vendorId;

      if (!vendorId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error(
              "Vendor authentication required",
              "VENDOR_AUTH_REQUIRED"
            )
          );
        return;
      }

      const input: UpdateProductInput = req.body;
      const product = await this.productService.updateProduct(
        id,
        vendorId,
        input
      );

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(product, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update product";
      const status = message.includes("not found")
        ? HTTP_STATUS.NOT_FOUND
        : message.includes("Not authorized")
        ? HTTP_STATUS.FORBIDDEN
        : HTTP_STATUS.BAD_REQUEST;

      res
        .status(status)
        .json(
          ResponseBuilder.error(message, "UPDATE_PRODUCT_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async updateProductStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const vendorId = req.user?.vendorId;

      if (!vendorId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error(
              "Vendor authentication required",
              "VENDOR_AUTH_REQUIRED"
            )
          );
        return;
      }

      if (!["active", "inactive", "draft"].includes(status)) {
        res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json(ResponseBuilder.error("Invalid status", "INVALID_STATUS"));
        return;
      }

      const product = await this.productService.updateProductStatus(
        id,
        vendorId,
        status
      );

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(product, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update product status";
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          ResponseBuilder.error(message, "UPDATE_STATUS_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async updateInventory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { quantity } = req.body;
      const vendorId = req.user?.vendorId;

      if (!vendorId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error(
              "Vendor authentication required",
              "VENDOR_AUTH_REQUIRED"
            )
          );
        return;
      }

      if (typeof quantity !== "number" || quantity < 0) {
        res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json(
            ResponseBuilder.error("Valid quantity required", "INVALID_QUANTITY")
          );
        return;
      }

      const product = await this.productService.updateInventory(
        id,
        vendorId,
        quantity
      );

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(product, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update inventory";
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          ResponseBuilder.error(message, "UPDATE_INVENTORY_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async deleteProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const vendorId = req.user?.vendorId;

      if (!vendorId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error(
              "Vendor authentication required",
              "VENDOR_AUTH_REQUIRED"
            )
          );
        return;
      }

      await this.productService.deleteProduct(id, vendorId);

      res.status(HTTP_STATUS.NO_CONTENT).send();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete product";
      const status = message.includes("not found")
        ? HTTP_STATUS.NOT_FOUND
        : message.includes("Not authorized")
        ? HTTP_STATUS.FORBIDDEN
        : HTTP_STATUS.BAD_REQUEST;

      res
        .status(status)
        .json(
          ResponseBuilder.error(message, "DELETE_PRODUCT_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async getFeaturedProducts(req: Request, res: Response): Promise<void> {
    try {
      const { limit = "10" } = req.query;
      const products = await this.productService.getFeaturedProducts(
        parseInt(limit as string)
      );

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(products, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to fetch featured products";
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(message, "FETCH_FEATURED_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async getLowStockProducts(req: Request, res: Response): Promise<void> {
    try {
      const vendorId = req.user?.vendorId;
      const products = await this.productService.getLowStockProducts(vendorId);

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(products, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to fetch low stock products";
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(message, "FETCH_LOW_STOCK_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async getProductStatistics(req: Request, res: Response): Promise<void> {
    try {
      const vendorId = req.user?.vendorId;
      const statistics = await this.productService.getProductStatistics(
        vendorId
      );

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(statistics, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to fetch product statistics";
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(message, "FETCH_STATISTICS_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  getRouter(): Router {
    return this.router;
  }
}

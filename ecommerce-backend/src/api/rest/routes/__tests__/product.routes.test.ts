/**
 * Product controller unit tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { ProductController } from "../product.routes";
import { ProductService } from "../../../../modules/ecommerce/products/product.service";
import { HTTP_STATUS } from "../../../../shared/utils/response.utils";

// Mock the ProductService
const mockProductService = {
  createProduct: vi.fn(),
  getProduct: vi.fn(),
  searchProducts: vi.fn(),
  updateProduct: vi.fn(),
  updateProductStatus: vi.fn(),
  updateInventory: vi.fn(),
  deleteProduct: vi.fn(),
  getFeaturedProducts: vi.fn(),
  getLowStockProducts: vi.fn(),
  getProductStatistics: vi.fn(),
} as unknown as ProductService;

describe("ProductController", () => {
  let controller: ProductController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new ProductController(mockProductService);

    mockRequest = {
      id: "test-request-id",
      user: { id: "user-123", vendorId: "vendor-123", role: "vendor" },
      params: {},
      query: {},
      body: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe("createProduct", () => {
    it("should create product successfully", async () => {
      const productData = {
        name: "Test Product",
        description: "Test description",
        price: 29.99,
        categoryId: "category-123",
      };

      const createdProduct = {
        id: "product-123",
        vendorId: "vendor-123",
        ...productData,
      };

      mockRequest.body = productData;
      mockProductService.createProduct = vi
        .fn()
        .mockResolvedValue(createdProduct);

      await controller.createProduct(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockProductService.createProduct).toHaveBeenCalledWith(
        "vendor-123",
        productData
      );
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.CREATED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: createdProduct,
        })
      );
    });

    it("should return 400 when vendor ID is missing", async () => {
      mockRequest.user = { id: "user-123", role: "customer" };
      mockRequest.body = { name: "Test Product" };

      await controller.createProduct(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: "Vendor ID required",
            code: "VENDOR_ID_REQUIRED",
          }),
        })
      );
    });

    it("should handle service errors", async () => {
      mockRequest.body = { name: "Test Product" };
      mockProductService.createProduct = vi
        .fn()
        .mockRejectedValue(new Error("Vendor not approved"));

      await controller.createProduct(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: "Vendor not approved",
            code: "CREATE_PRODUCT_FAILED",
          }),
        })
      );
    });
  });

  describe("getProduct", () => {
    it("should return product successfully", async () => {
      const product = {
        id: "product-123",
        name: "Test Product",
        price: 29.99,
      };

      mockRequest.params = { id: "product-123" };
      mockProductService.getProduct = vi.fn().mockResolvedValue(product);

      await controller.getProduct(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockProductService.getProduct).toHaveBeenCalledWith("product-123");
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: product,
        })
      );
    });

    it("should return 404 when product not found", async () => {
      mockRequest.params = { id: "product-123" };
      mockProductService.getProduct = vi.fn().mockResolvedValue(null);

      await controller.getProduct(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: "Product not found",
            code: "PRODUCT_NOT_FOUND",
          }),
        })
      );
    });
  });

  describe("updateInventory", () => {
    it("should update inventory successfully", async () => {
      const product = {
        id: "product-123",
        quantity: 50,
      };

      mockRequest.params = { id: "product-123" };
      mockRequest.body = { quantity: 50 };
      mockProductService.updateInventory = vi.fn().mockResolvedValue(product);

      await controller.updateInventory(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockProductService.updateInventory).toHaveBeenCalledWith(
        "product-123",
        "vendor-123",
        50
      );
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: product,
        })
      );
    });

    it("should return 401 when vendor not authenticated", async () => {
      mockRequest.user = { id: "user-123", role: "customer" };
      mockRequest.params = { id: "product-123" };
      mockRequest.body = { quantity: 50 };

      await controller.updateInventory(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(
        HTTP_STATUS.UNAUTHORIZED
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: "Vendor authentication required",
            code: "VENDOR_AUTH_REQUIRED",
          }),
        })
      );
    });

    it("should return 400 for invalid quantity", async () => {
      mockRequest.params = { id: "product-123" };
      mockRequest.body = { quantity: -5 };

      await controller.updateInventory(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: "Valid quantity required",
            code: "INVALID_QUANTITY",
          }),
        })
      );
    });
  });

  describe("deleteProduct", () => {
    it("should delete product successfully", async () => {
      mockRequest.params = { id: "product-123" };
      mockProductService.deleteProduct = vi.fn().mockResolvedValue(undefined);

      await controller.deleteProduct(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockProductService.deleteProduct).toHaveBeenCalledWith(
        "product-123",
        "vendor-123"
      );
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.NO_CONTENT);
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it("should handle authorization errors", async () => {
      mockRequest.params = { id: "product-123" };
      mockProductService.deleteProduct = vi
        .fn()
        .mockRejectedValue(new Error("Not authorized to delete this product"));

      await controller.deleteProduct(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: "Not authorized to delete this product",
            code: "DELETE_PRODUCT_FAILED",
          }),
        })
      );
    });
  });

  describe("getFeaturedProducts", () => {
    it("should return featured products", async () => {
      const products = [
        { id: "product-1", name: "Featured Product 1", featured: true },
        { id: "product-2", name: "Featured Product 2", featured: true },
      ];

      mockRequest.query = { limit: "5" };
      mockProductService.getFeaturedProducts = vi
        .fn()
        .mockResolvedValue(products);

      await controller.getFeaturedProducts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockProductService.getFeaturedProducts).toHaveBeenCalledWith(5);
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: products,
        })
      );
    });
  });
});

/**
 * Create Product Use Case unit tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CreateProductUseCase } from "../create-product.use-case";
import { ProductService } from "../../product.service";

// Mock service
const mockProductService = {
  createProduct: vi.fn(),
} as any;

describe("CreateProductUseCase", () => {
  let useCase: CreateProductUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new CreateProductUseCase(mockProductService);
  });

  describe("execute", () => {
    it("should create product successfully with valid input", async () => {
      const command = {
        vendorId: "vendor-id",
        productData: {
          name: "Test Product",
          description: "Test description",
          price: 99.99,
          quantity: 10,
        },
      };

      const expectedOutput = {
        id: "product-id",
        vendorId: command.vendorId,
        name: command.productData.name,
        price: command.productData.price,
        quantity: command.productData.quantity,
      };

      mockProductService.createProduct.mockResolvedValue(expectedOutput);

      const result = await useCase.execute(command);

      expect(result).toEqual(expectedOutput);
      expect(mockProductService.createProduct).toHaveBeenCalledWith(
        command.vendorId,
        command.productData
      );
    });

    it("should throw error when product name is empty", async () => {
      const command = {
        vendorId: "vendor-id",
        productData: {
          name: "",
          price: 99.99,
        },
      };

      await expect(useCase.execute(command)).rejects.toThrow(
        "Product name is required"
      );
      expect(mockProductService.createProduct).not.toHaveBeenCalled();
    });

    it("should throw error when product name is too long", async () => {
      const command = {
        vendorId: "vendor-id",
        productData: {
          name: "a".repeat(256), // 256 characters
          price: 99.99,
        },
      };

      await expect(useCase.execute(command)).rejects.toThrow(
        "Product name must be 255 characters or less"
      );
    });

    it("should throw error when price is zero or negative", async () => {
      const command = {
        vendorId: "vendor-id",
        productData: {
          name: "Test Product",
          price: 0,
        },
      };

      await expect(useCase.execute(command)).rejects.toThrow(
        "Product price must be greater than 0"
      );
    });

    it("should throw error when compare at price is not greater than regular price", async () => {
      const command = {
        vendorId: "vendor-id",
        productData: {
          name: "Test Product",
          price: 99.99,
          compareAtPrice: 89.99, // Lower than regular price
        },
      };

      await expect(useCase.execute(command)).rejects.toThrow(
        "Compare at price must be greater than regular price"
      );
    });

    it("should throw error when quantity is negative", async () => {
      const command = {
        vendorId: "vendor-id",
        productData: {
          name: "Test Product",
          price: 99.99,
          quantity: -5,
        },
      };

      await expect(useCase.execute(command)).rejects.toThrow(
        "Product quantity cannot be negative"
      );
    });

    it("should throw error when weight is zero or negative", async () => {
      const command = {
        vendorId: "vendor-id",
        productData: {
          name: "Test Product",
          price: 99.99,
          weight: 0,
        },
      };

      await expect(useCase.execute(command)).rejects.toThrow(
        "Product weight must be greater than 0"
      );
    });

    it("should throw error when SKU has invalid format", async () => {
      const command = {
        vendorId: "vendor-id",
        productData: {
          name: "Test Product",
          price: 99.99,
          sku: "invalid@sku!",
        },
      };

      await expect(useCase.execute(command)).rejects.toThrow(
        "SKU can only contain letters, numbers, hyphens, and underscores"
      );
    });

    it("should throw error when too many images provided", async () => {
      const command = {
        vendorId: "vendor-id",
        productData: {
          name: "Test Product",
          price: 99.99,
          images: Array(11).fill("image-url"), // 11 images (max is 10)
        },
      };

      await expect(useCase.execute(command)).rejects.toThrow(
        "Maximum 10 images allowed per product"
      );
    });

    it("should accept valid SKU format", async () => {
      const command = {
        vendorId: "vendor-id",
        productData: {
          name: "Test Product",
          price: 99.99,
          sku: "VALID-SKU_123",
        },
      };

      const expectedOutput = {
        id: "product-id",
        sku: "VALID-SKU_123",
      };

      mockProductService.createProduct.mockResolvedValue(expectedOutput);

      const result = await useCase.execute(command);

      expect(result).toEqual(expectedOutput);
      expect(mockProductService.createProduct).toHaveBeenCalled();
    });

    it("should accept valid compare at price", async () => {
      const command = {
        vendorId: "vendor-id",
        productData: {
          name: "Test Product",
          price: 99.99,
          compareAtPrice: 129.99, // Higher than regular price
        },
      };

      const expectedOutput = {
        id: "product-id",
        price: 99.99,
        compareAtPrice: 129.99,
      };

      mockProductService.createProduct.mockResolvedValue(expectedOutput);

      const result = await useCase.execute(command);

      expect(result).toEqual(expectedOutput);
      expect(mockProductService.createProduct).toHaveBeenCalled();
    });
  });
});

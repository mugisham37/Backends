/**
 * Product service unit tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProductService } from "../product.service";
import { ProductRepository } from "../../../../core/repositories/product.repository";
import { VendorRepository } from "../../../../core/repositories/vendor.repository";

// Mock repositories
const mockProductRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  findByVendor: vi.fn(),
  findWithFilters: vi.fn(),
  findWithRelations: vi.fn(),
  update: vi.fn(),
  updateStatus: vi.fn(),
  updateInventory: vi.fn(),
  delete: vi.fn(),
  slugExists: vi.fn(),
  skuExists: vi.fn(),
  getFeaturedProducts: vi.fn(),
  getLowStockProducts: vi.fn(),
  getStatistics: vi.fn(),
} as any;

const mockVendorRepo = {
  findById: vi.fn(),
} as any;

describe("ProductService", () => {
  let service: ProductService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProductService(mockProductRepo, mockVendorRepo);
  });

  describe("createProduct", () => {
    it("should create product successfully", async () => {
      const vendorId = "vendor-id";
      const input = {
        name: "Test Product",
        description: "Test description",
        price: 99.99,
        quantity: 10,
      };

      const mockVendor = {
        id: vendorId,
        businessName: "Test Business",
        status: "approved",
        autoApproveProducts: true,
      };

      const mockProduct = {
        id: "product-id",
        vendorId,
        name: input.name,
        slug: "test-product",
        description: input.description,
        price: "99.99",
        quantity: input.quantity,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockVendorRepo.findById.mockResolvedValue(mockVendor);
      mockProductRepo.slugExists.mockResolvedValue(false);
      mockProductRepo.create.mockResolvedValue(mockProduct);

      const result = await service.createProduct(vendorId, input);

      expect(result).toEqual({
        id: mockProduct.id,
        vendorId: mockProduct.vendorId,
        categoryId: undefined,
        name: mockProduct.name,
        slug: mockProduct.slug,
        description: mockProduct.description,
        shortDescription: undefined,
        price: 99.99,
        compareAtPrice: undefined,
        sku: undefined,
        barcode: undefined,
        trackQuantity: undefined,
        quantity: mockProduct.quantity,
        lowStockThreshold: undefined,
        weight: undefined,
        weightUnit: undefined,
        dimensions: undefined,
        status: mockProduct.status,
        condition: undefined,
        featured: undefined,
        images: [],
        metaTitle: undefined,
        metaDescription: undefined,
        attributes: undefined,
        hasVariants: undefined,
        requiresShipping: undefined,
        shippingClass: undefined,
        taxable: undefined,
        taxClass: undefined,
        publishedAt: undefined,
        createdAt: mockProduct.createdAt,
        updatedAt: mockProduct.updatedAt,
      });

      expect(mockVendorRepo.findById).toHaveBeenCalledWith(vendorId);
      expect(mockProductRepo.create).toHaveBeenCalled();
    });

    it("should throw error when vendor not found", async () => {
      const vendorId = "non-existent-vendor";
      const input = {
        name: "Test Product",
        price: 99.99,
      };

      mockVendorRepo.findById.mockResolvedValue(null);

      await expect(service.createProduct(vendorId, input)).rejects.toThrow(
        "Vendor not found"
      );
    });

    it("should throw error when vendor not approved", async () => {
      const vendorId = "vendor-id";
      const input = {
        name: "Test Product",
        price: 99.99,
      };

      const mockVendor = {
        id: vendorId,
        status: "pending",
      };

      mockVendorRepo.findById.mockResolvedValue(mockVendor);

      await expect(service.createProduct(vendorId, input)).rejects.toThrow(
        "Vendor must be approved to create products"
      );
    });
  });

  describe("updateProduct", () => {
    it("should update product successfully", async () => {
      const productId = "product-id";
      const vendorId = "vendor-id";
      const input = {
        name: "Updated Product",
        price: 149.99,
      };

      const mockProduct = {
        id: productId,
        vendorId,
        name: "Original Product",
        slug: "original-product",
        price: "99.99",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdatedProduct = {
        ...mockProduct,
        name: input.name,
        slug: "updated-product",
        price: "149.99",
      };

      mockProductRepo.findById.mockResolvedValue(mockProduct);
      mockProductRepo.slugExists.mockResolvedValue(false);
      mockProductRepo.update.mockResolvedValue(mockUpdatedProduct);

      const result = await service.updateProduct(productId, vendorId, input);

      expect(result.name).toBe(input.name);
      expect(result.price).toBe(input.price);
      expect(mockProductRepo.update).toHaveBeenCalledWith(
        productId,
        expect.objectContaining({
          name: input.name,
          price: input.price.toString(),
          slug: "updated-product",
        })
      );
    });

    it("should throw error when product not found", async () => {
      const productId = "non-existent-product";
      const vendorId = "vendor-id";
      const input = { name: "Updated Product" };

      mockProductRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateProduct(productId, vendorId, input)
      ).rejects.toThrow("Product not found");
    });

    it("should throw error when vendor not authorized", async () => {
      const productId = "product-id";
      const vendorId = "vendor-id";
      const input = { name: "Updated Product" };

      const mockProduct = {
        id: productId,
        vendorId: "different-vendor-id",
      };

      mockProductRepo.findById.mockResolvedValue(mockProduct);

      await expect(
        service.updateProduct(productId, vendorId, input)
      ).rejects.toThrow("Not authorized to update this product");
    });
  });

  describe("getProduct", () => {
    it("should get product with relations", async () => {
      const productId = "product-id";
      const mockProduct = {
        id: productId,
        name: "Test Product",
        vendor: {
          id: "vendor-id",
          businessName: "Test Business",
          slug: "test-business",
        },
        category: {
          id: "category-id",
          name: "Test Category",
          slug: "test-category",
        },
        variants: [],
      };

      mockProductRepo.findWithRelations.mockResolvedValue(mockProduct);

      const result = await service.getProduct(productId);

      expect(result).toBeDefined();
      expect(result?.vendor).toEqual(mockProduct.vendor);
      expect(result?.category).toEqual(mockProduct.category);
      expect(mockProductRepo.findWithRelations).toHaveBeenCalledWith(productId);
    });

    it("should return null when product not found", async () => {
      const productId = "non-existent-product";

      mockProductRepo.findWithRelations.mockResolvedValue(null);

      const result = await service.getProduct(productId);

      expect(result).toBeNull();
    });
  });

  describe("updateInventory", () => {
    it("should update inventory successfully", async () => {
      const productId = "product-id";
      const vendorId = "vendor-id";
      const quantity = 50;

      const mockProduct = {
        id: productId,
        vendorId,
        trackQuantity: true,
        quantity: 10,
      };

      const mockUpdatedProduct = {
        ...mockProduct,
        quantity,
      };

      mockProductRepo.findById.mockResolvedValue(mockProduct);
      mockProductRepo.updateInventory.mockResolvedValue(mockUpdatedProduct);

      const result = await service.updateInventory(
        productId,
        vendorId,
        quantity
      );

      expect(result.quantity).toBe(quantity);
      expect(mockProductRepo.updateInventory).toHaveBeenCalledWith(
        productId,
        quantity
      );
    });

    it("should throw error when product does not track inventory", async () => {
      const productId = "product-id";
      const vendorId = "vendor-id";
      const quantity = 50;

      const mockProduct = {
        id: productId,
        vendorId,
        trackQuantity: false,
      };

      mockProductRepo.findById.mockResolvedValue(mockProduct);

      await expect(
        service.updateInventory(productId, vendorId, quantity)
      ).rejects.toThrow("Product does not track inventory");
    });
  });

  describe("getFeaturedProducts", () => {
    it("should get featured products", async () => {
      const mockProducts = [
        {
          id: "product-1",
          name: "Featured Product 1",
          featured: true,
          status: "active",
        },
        {
          id: "product-2",
          name: "Featured Product 2",
          featured: true,
          status: "active",
        },
      ];

      mockProductRepo.getFeaturedProducts.mockResolvedValue(mockProducts);

      const result = await service.getFeaturedProducts(10);

      expect(result).toHaveLength(2);
      expect(mockProductRepo.getFeaturedProducts).toHaveBeenCalledWith(10);
    });
  });

  describe("getProductStatistics", () => {
    it("should get global statistics when no vendor specified", async () => {
      const mockStats = {
        totalProducts: 100,
        activeProducts: 80,
        outOfStockProducts: 5,
        lowStockProducts: 10,
        averagePrice: 75.5,
      };

      mockProductRepo.getStatistics.mockResolvedValue(mockStats);

      const result = await service.getProductStatistics();

      expect(result).toEqual(mockStats);
      expect(mockProductRepo.getStatistics).toHaveBeenCalled();
    });

    it("should get vendor-specific statistics", async () => {
      const vendorId = "vendor-id";
      const mockProducts = [
        {
          id: "product-1",
          vendorId,
          status: "active",
          trackQuantity: true,
          quantity: 0,
          lowStockThreshold: 5,
          price: "100.00",
        },
        {
          id: "product-2",
          vendorId,
          status: "active",
          trackQuantity: true,
          quantity: 3,
          lowStockThreshold: 5,
          price: "50.00",
        },
      ];

      mockProductRepo.findByVendor.mockResolvedValue(mockProducts);

      const result = await service.getProductStatistics(vendorId);

      expect(result.totalProducts).toBe(2);
      expect(result.activeProducts).toBe(2);
      expect(result.outOfStockProducts).toBe(1);
      expect(result.lowStockProducts).toBe(1);
      expect(result.averagePrice).toBe(75);
    });
  });
});

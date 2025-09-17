/**
 * Product service
 * Clean business logic for product management
 */

import {
  ProductRepository,
  ProductFilters,
} from "../../../core/repositories/product.repository";
import { VendorRepository } from "../../../core/repositories/vendor.repository";
import { Product, NewProduct } from "../../../core/database/schema";
import {
  CreateProductInput,
  UpdateProductInput,
  ProductOutput,
} from "./product.types";
import { NotificationService } from "../../notifications/notification.service";
import { WebhookService } from "../../webhook/webhook.service";
import { AnalyticsService } from "../../analytics/analytics.service";
import { CacheService } from "../../cache/cache.service";
import { StorageService } from "../../media/storage.service";

export class ProductService {
  constructor(
    private productRepo: ProductRepository,
    private vendorRepo: VendorRepository,
    private notificationService?: NotificationService,
    private webhookService?: WebhookService,
    private analyticsService?: AnalyticsService,
    private cacheService?: CacheService,
    private storageService?: StorageService
  ) {}

  async createProduct(
    vendorId: string,
    input: CreateProductInput
  ): Promise<ProductOutput> {
    // Verify vendor exists and is active
    const vendor = await this.vendorRepo.findById(vendorId);
    if (!vendor) {
      throw new Error("Vendor not found");
    }

    if (vendor.status !== "approved") {
      throw new Error("Vendor must be approved to create products");
    }

    // Generate unique slug
    const slug = await this.generateUniqueSlug(input.name);

    // Generate SKU if not provided
    const sku =
      input.sku || (await this.generateSku(vendor.businessName, input.name));

    const productData: NewProduct = {
      vendorId,
      categoryId: input.categoryId,
      name: input.name,
      slug,
      description: input.description,
      shortDescription: input.shortDescription,
      price: input.price.toString(),
      compareAtPrice: input.compareAtPrice?.toString(),
      sku,
      barcode: input.barcode,
      trackQuantity: input.trackQuantity ?? true,
      quantity: input.quantity ?? 0,
      lowStockThreshold: input.lowStockThreshold ?? 5,
      weight: input.weight?.toString(),
      weightUnit: input.weightUnit ?? "kg",
      dimensions: input.dimensions,
      condition: input.condition ?? "new",
      images: input.images ?? [],
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
      attributes: input.attributes,
      requiresShipping: input.requiresShipping ?? true,
      shippingClass: input.shippingClass,
      taxable: input.taxable ?? true,
      taxClass: input.taxClass,
      status: vendor.autoApproveProducts ? "active" : "draft",
    };

    const product = await this.productRepo.create(productData);
    const finalProduct = this.mapToOutput(product);

    // Trigger integrations after product creation
    await this.handleProductCreatedIntegrations(finalProduct, vendor);

    return finalProduct;
  }

  private async handleProductCreatedIntegrations(
    product: ProductOutput,
    vendor: any
  ): Promise<void> {
    try {
      // Analytics tracking
      if (this.analyticsService) {
        await this.analyticsService.trackEvent({
          eventType: "product",
          eventName: "product_created",
          userId: vendor.userId,
          properties: {
            productId: product.id,
            vendorId: product.vendorId,
            productName: product.name,
            price: product.price,
            category: product.categoryId,
            status: product.status,
          },
          value: Number(product.price),
        });
      }

      // Dispatch webhook event
      if (this.webhookService) {
        await this.webhookService.dispatchEvent({
          eventType: "product.created",
          eventId: `product_${product.id}_created`,
          payload: { product },
          sourceId: product.id,
          sourceType: "product",
          vendorId: product.vendorId,
        });
      }

      // Clear product caches
      if (this.cacheService) {
        await Promise.all([
          this.cacheService.delete("featured_products"),
          this.cacheService.delete(`vendor_products:${product.vendorId}`),
          this.cacheService.delete("product_statistics"),
        ]);
      }
    } catch (error) {
      console.error("Product creation integration error:", error);
    }
  }

  async updateProduct(
    id: string,
    vendorId: string,
    input: UpdateProductInput
  ): Promise<ProductOutput> {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.vendorId !== vendorId) {
      throw new Error("Not authorized to update this product");
    }

    const updateData: Partial<Product> = {};

    if (input.name !== undefined) {
      updateData.name = input.name;
      if (input.name !== product.name) {
        updateData.slug = await this.generateUniqueSlug(input.name, id);
      }
    }

    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.shortDescription !== undefined)
      updateData.shortDescription = input.shortDescription;
    if (input.price !== undefined) updateData.price = input.price.toString();
    if (input.compareAtPrice !== undefined)
      updateData.compareAtPrice = input.compareAtPrice?.toString();
    if (input.quantity !== undefined) updateData.quantity = input.quantity;
    if (input.lowStockThreshold !== undefined)
      updateData.lowStockThreshold = input.lowStockThreshold;
    if (input.weight !== undefined)
      updateData.weight = input.weight?.toString();
    if (input.weightUnit !== undefined)
      updateData.weightUnit = input.weightUnit;
    if (input.dimensions !== undefined)
      updateData.dimensions = input.dimensions;
    if (input.images !== undefined) updateData.images = input.images;
    if (input.metaTitle !== undefined) updateData.metaTitle = input.metaTitle;
    if (input.metaDescription !== undefined)
      updateData.metaDescription = input.metaDescription;
    if (input.attributes !== undefined)
      updateData.attributes = input.attributes;

    const updatedProduct = await this.productRepo.update(id, updateData);
    if (!updatedProduct) {
      throw new Error("Failed to update product");
    }

    return this.mapToOutput(updatedProduct);
  }

  async getProduct(id: string): Promise<ProductOutput | null> {
    const product = await this.productRepo.findWithRelations(id);
    return product ? this.mapToOutputWithRelations(product) : null;
  }

  async getProductBySlug(slug: string): Promise<ProductOutput | null> {
    const product = await this.productRepo.findBySlug(slug);
    return product ? this.mapToOutput(product) : null;
  }

  async getVendorProducts(
    vendorId: string,
    filters?: ProductFilters
  ): Promise<ProductOutput[]> {
    const products = filters
      ? await this.productRepo.findWithFilters({ ...filters, vendorId })
      : await this.productRepo.findByVendor(vendorId);

    return products.map((product) => this.mapToOutput(product));
  }

  async searchProducts(filters: ProductFilters): Promise<ProductOutput[]> {
    const products = await this.productRepo.findWithFilters(filters);
    return products.map((product) => this.mapToOutput(product));
  }

  async updateProductStatus(
    id: string,
    vendorId: string,
    status: "active" | "inactive" | "draft"
  ): Promise<ProductOutput> {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.vendorId !== vendorId) {
      throw new Error("Not authorized to update this product");
    }

    const updatedProduct = await this.productRepo.updateStatus(id, status);
    if (!updatedProduct) {
      throw new Error("Failed to update product status");
    }

    return this.mapToOutput(updatedProduct);
  }

  async updateInventory(
    id: string,
    vendorId: string,
    quantity: number
  ): Promise<ProductOutput> {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.vendorId !== vendorId) {
      throw new Error("Not authorized to update this product");
    }

    if (!product.trackQuantity) {
      throw new Error("Product does not track inventory");
    }

    const updatedProduct = await this.productRepo.updateInventory(id, quantity);
    if (!updatedProduct) {
      throw new Error("Failed to update inventory");
    }

    return this.mapToOutput(updatedProduct);
  }

  async deleteProduct(id: string, vendorId: string): Promise<void> {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new Error("Product not found");
    }

    if (product.vendorId !== vendorId) {
      throw new Error("Not authorized to delete this product");
    }

    const deleted = await this.productRepo.delete(id);
    if (!deleted) {
      throw new Error("Failed to delete product");
    }
  }

  async getFeaturedProducts(limit: number = 10): Promise<ProductOutput[]> {
    const products = await this.productRepo.getFeaturedProducts(limit);
    return products.map((product) => this.mapToOutput(product));
  }

  async getLowStockProducts(vendorId?: string): Promise<ProductOutput[]> {
    const products = await this.productRepo.getLowStockProducts();

    const filteredProducts = vendorId
      ? products.filter((product) => product.vendorId === vendorId)
      : products;

    return filteredProducts.map((product) => this.mapToOutput(product));
  }

  async getProductStatistics(vendorId?: string): Promise<{
    totalProducts: number;
    activeProducts: number;
    outOfStockProducts: number;
    lowStockProducts: number;
    averagePrice: number;
  }> {
    if (vendorId) {
      // Get vendor-specific stats
      const products = await this.productRepo.findByVendor(vendorId);
      const activeProducts = products.filter((p) => p.status === "active");
      const outOfStock = products.filter(
        (p) => (p.trackQuantity ?? true) && (p.quantity ?? 0) === 0
      );
      const lowStock = products.filter(
        (p) =>
          (p.trackQuantity ?? true) &&
          (p.quantity ?? 0) > 0 &&
          (p.quantity ?? 0) <= (p.lowStockThreshold ?? 5)
      );
      const avgPrice =
        activeProducts.length > 0
          ? activeProducts.reduce((sum, p) => sum + Number(p.price), 0) /
            activeProducts.length
          : 0;

      return {
        totalProducts: products.length,
        activeProducts: activeProducts.length,
        outOfStockProducts: outOfStock.length,
        lowStockProducts: lowStock.length,
        averagePrice: avgPrice,
      };
    }

    return this.productRepo.getStatistics();
  }

  private async generateUniqueSlug(
    name: string,
    excludeId?: string
  ): Promise<string> {
    let baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    let slug = baseSlug;
    let counter = 1;

    while (await this.productRepo.slugExists(slug, excludeId)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private async generateSku(
    businessName: string,
    productName: string
  ): Promise<string> {
    const businessPrefix = businessName
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z]/g, "");

    const productPrefix = productName
      .substring(0, 3)
      .toUpperCase()
      .replace(/[^A-Z]/g, "");

    const timestamp = Date.now().toString().slice(-6);

    return `${businessPrefix}${productPrefix}${timestamp}`;
  }

  private mapToOutput(product: Product): ProductOutput {
    return {
      id: product.id,
      vendorId: product.vendorId,
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      shortDescription: product.shortDescription,
      price: Number(product.price),
      compareAtPrice: product.compareAtPrice
        ? Number(product.compareAtPrice)
        : undefined,
      sku: product.sku,
      barcode: product.barcode,
      trackQuantity: product.trackQuantity ?? true,
      quantity: product.quantity ?? 0,
      lowStockThreshold: product.lowStockThreshold ?? 5,
      weight: product.weight ? Number(product.weight) : undefined,
      weightUnit: product.weightUnit,
      dimensions: product.dimensions ?? undefined,
      status: product.status,
      condition: product.condition,
      featured: product.featured ?? false,
      images: product.images || [],
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      attributes: product.attributes ?? undefined,
      hasVariants: product.hasVariants ?? false,
      requiresShipping: product.requiresShipping ?? true,
      shippingClass: product.shippingClass,
      taxable: product.taxable ?? true,
      taxClass: product.taxClass,
      publishedAt: product.publishedAt,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  private mapToOutputWithRelations(product: any): ProductOutput {
    const output = this.mapToOutput(product);

    return {
      ...output,
      vendor: product.vendor
        ? {
            id: product.vendor.id,
            businessName: product.vendor.businessName,
            slug: product.vendor.slug,
          }
        : undefined,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug,
          }
        : undefined,
      variants: product.variants || [],
    };
  }
}

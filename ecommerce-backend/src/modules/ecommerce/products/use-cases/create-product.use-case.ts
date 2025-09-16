/**
 * Create Product Use Case
 * Application logic for creating a new product
 */

import { ProductService } from "../product.service";
import { CreateProductInput, ProductOutput } from "../product.types";

export interface CreateProductCommand {
  vendorId: string;
  productData: CreateProductInput;
}

export class CreateProductUseCase {
  constructor(private productService: ProductService) {}

  async execute(command: CreateProductCommand): Promise<ProductOutput> {
    const { vendorId, productData } = command;

    // Validate input
    this.validateInput(productData);

    // Create product through service
    return this.productService.createProduct(vendorId, productData);
  }

  private validateInput(input: CreateProductInput): void {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error("Product name is required");
    }

    if (input.name.length > 255) {
      throw new Error("Product name must be 255 characters or less");
    }

    if (input.price <= 0) {
      throw new Error("Product price must be greater than 0");
    }

    if (input.compareAtPrice && input.compareAtPrice <= input.price) {
      throw new Error("Compare at price must be greater than regular price");
    }

    if (input.quantity !== undefined && input.quantity < 0) {
      throw new Error("Product quantity cannot be negative");
    }

    if (input.weight !== undefined && input.weight <= 0) {
      throw new Error("Product weight must be greater than 0");
    }

    if (input.lowStockThreshold !== undefined && input.lowStockThreshold < 0) {
      throw new Error("Low stock threshold cannot be negative");
    }

    // Validate SKU format if provided
    if (input.sku && !/^[A-Z0-9-_]+$/i.test(input.sku)) {
      throw new Error(
        "SKU can only contain letters, numbers, hyphens, and underscores"
      );
    }

    // Validate images array
    if (input.images && input.images.length > 10) {
      throw new Error("Maximum 10 images allowed per product");
    }
  }
}

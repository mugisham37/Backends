/**
 * Update Product Use Case
 * Application logic for updating an existing product
 */

import { ProductService } from "../product.service";
import { UpdateProductInput, ProductOutput } from "../product.types";

export interface UpdateProductCommand {
  productId: string;
  vendorId: string;
  productData: UpdateProductInput;
}

export class UpdateProductUseCase {
  constructor(private productService: ProductService) {}

  async execute(command: UpdateProductCommand): Promise<ProductOutput> {
    const { productId, vendorId, productData } = command;

    // Validate input
    this.validateInput(productData);

    // Update product through service
    return this.productService.updateProduct(productId, vendorId, productData);
  }

  private validateInput(input: UpdateProductInput): void {
    if (input.name !== undefined) {
      if (!input.name || input.name.trim().length === 0) {
        throw new Error("Product name cannot be empty");
      }

      if (input.name.length > 255) {
        throw new Error("Product name must be 255 characters or less");
      }
    }

    if (input.price !== undefined && input.price <= 0) {
      throw new Error("Product price must be greater than 0");
    }

    if (input.compareAtPrice !== undefined && input.price !== undefined) {
      if (input.compareAtPrice <= input.price) {
        throw new Error("Compare at price must be greater than regular price");
      }
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

    // Validate images array
    if (input.images && input.images.length > 10) {
      throw new Error("Maximum 10 images allowed per product");
    }
  }
}

/**
 * Get Product Use Case
 * Application logic for retrieving product information
 */

import { ProductService } from "../product.service";
import { ProductOutput } from "../product.types";

export interface GetProductQuery {
  productId?: string;
  slug?: string;
}

export class GetProductUseCase {
  constructor(private productService: ProductService) {}

  async execute(query: GetProductQuery): Promise<ProductOutput | null> {
    if (!query.productId && !query.slug) {
      throw new Error("Either productId or slug must be provided");
    }

    if (query.productId && query.slug) {
      throw new Error("Only one of productId or slug should be provided");
    }

    if (query.productId) {
      return this.productService.getProduct(query.productId);
    }

    if (query.slug) {
      return this.productService.getProductBySlug(query.slug);
    }

    return null;
  }
}

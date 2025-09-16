/**
 * Product DataLoader
 * Prevents N+1 queries when fetching products
 */

import DataLoader from "dataloader";
import { ProductRepository } from "../../../core/repositories/product.repository.js";
import { Product } from "../../../core/database/schema/index.js";

export class ProductLoader {
  private productRepository: ProductRepository;
  private byIdLoader: DataLoader<string, Product | null>;
  private byVendorIdLoader: DataLoader<string, Product[]>;
  private byCategoryIdLoader: DataLoader<string, Product[]>;
  private bySlugLoader: DataLoader<string, Product | null>;

  constructor(productRepository: ProductRepository) {
    this.productRepository = productRepository;

    // Loader for products by ID
    this.byIdLoader = new DataLoader<string, Product | null>(
      async (ids: readonly string[]) => {
        const products = await this.productRepository.findByIds([...ids]);
        const productMap = new Map(
          products.map((product) => [product.id, product])
        );

        return ids.map((id) => productMap.get(id) || null);
      },
      {
        cache: true,
        maxBatchSize: 100,
      }
    );

    // Loader for products by vendor ID
    this.byVendorIdLoader = new DataLoader<string, Product[]>(
      async (vendorIds: readonly string[]) => {
        const products = await this.productRepository.findByVendorIds([
          ...vendorIds,
        ]);
        const productsByVendor = new Map<string, Product[]>();

        // Group products by vendor ID
        products.forEach((product) => {
          if (!productsByVendor.has(product.vendorId)) {
            productsByVendor.set(product.vendorId, []);
          }
          productsByVendor.get(product.vendorId)!.push(product);
        });

        return vendorIds.map(
          (vendorId) => productsByVendor.get(vendorId) || []
        );
      },
      {
        cache: true,
        maxBatchSize: 50,
      }
    );

    // Loader for products by category ID
    this.byCategoryIdLoader = new DataLoader<string, Product[]>(
      async (categoryIds: readonly string[]) => {
        const products = await this.productRepository.findByCategoryIds([
          ...categoryIds,
        ]);
        const productsByCategory = new Map<string, Product[]>();

        // Group products by category ID
        products.forEach((product) => {
          if (product.categoryId) {
            if (!productsByCategory.has(product.categoryId)) {
              productsByCategory.set(product.categoryId, []);
            }
            productsByCategory.get(product.categoryId)!.push(product);
          }
        });

        return categoryIds.map(
          (categoryId) => productsByCategory.get(categoryId) || []
        );
      },
      {
        cache: true,
        maxBatchSize: 50,
      }
    );

    // Loader for products by slug
    this.bySlugLoader = new DataLoader<string, Product | null>(
      async (slugs: readonly string[]) => {
        const products = await this.productRepository.findBySlugs([...slugs]);
        const productMap = new Map(
          products.map((product) => [product.slug, product])
        );

        return slugs.map((slug) => productMap.get(slug) || null);
      },
      {
        cache: true,
        maxBatchSize: 100,
      }
    );
  }

  // Load product by ID
  async loadById(id: string): Promise<Product | null> {
    return this.byIdLoader.load(id);
  }

  // Load multiple products by IDs
  async loadManyByIds(ids: string[]): Promise<(Product | null)[]> {
    return this.byIdLoader.loadMany(ids);
  }

  // Load products by vendor ID
  async loadByVendorId(vendorId: string): Promise<Product[]> {
    return this.byVendorIdLoader.load(vendorId);
  }

  // Load products by multiple vendor IDs
  async loadManyByVendorIds(vendorIds: string[]): Promise<Product[][]> {
    return this.byVendorIdLoader.loadMany(vendorIds);
  }

  // Load products by category ID
  async loadByCategoryId(categoryId: string): Promise<Product[]> {
    return this.byCategoryIdLoader.load(categoryId);
  }

  // Load products by multiple category IDs
  async loadManyByCategoryIds(categoryIds: string[]): Promise<Product[][]> {
    return this.byCategoryIdLoader.loadMany(categoryIds);
  }

  // Load product by slug
  async loadBySlug(slug: string): Promise<Product | null> {
    return this.bySlugLoader.load(slug);
  }

  // Load multiple products by slugs
  async loadManyBySlugs(slugs: string[]): Promise<(Product | null)[]> {
    return this.bySlugLoader.loadMany(slugs);
  }

  // Clear cache for specific product
  clearProduct(id: string): void {
    this.byIdLoader.clear(id);
  }

  // Clear cache for specific vendor's products
  clearProductsByVendor(vendorId: string): void {
    this.byVendorIdLoader.clear(vendorId);
  }

  // Clear cache for specific category's products
  clearProductsByCategory(categoryId: string): void {
    this.byCategoryIdLoader.clear(categoryId);
  }

  // Clear cache for specific slug
  clearProductBySlug(slug: string): void {
    this.bySlugLoader.clear(slug);
  }

  // Clear all caches
  clearAll(): void {
    this.byIdLoader.clearAll();
    this.byVendorIdLoader.clearAll();
    this.byCategoryIdLoader.clearAll();
    this.bySlugLoader.clearAll();
  }

  // Prime cache with product data
  prime(product: Product): void {
    this.byIdLoader.prime(product.id, product);
    this.bySlugLoader.prime(product.slug, product);
  }
}

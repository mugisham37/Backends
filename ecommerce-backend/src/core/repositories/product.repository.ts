/**
 * Product repository
 * Handles all database operations for products
 */

import {
  eq,
  and,
  ilike,
  or,
  sql,
  desc,
  asc,
  gte,
  lte,
  inArray,
} from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { Database } from "../database/connection";
import {
  products,
  Product,
  NewProduct,
  productStatusEnum,
  productConditionEnum,
  categories,
  vendors,
  productVariants,
} from "../database/schema";

// Product-specific types
export interface ProductFilters {
  status?: (typeof productStatusEnum.enumValues)[number];
  condition?: (typeof productConditionEnum.enumValues)[number];
  vendorId?: string;
  categoryId?: string;
  featured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  search?: string; // Search in name, description, sku
}

export interface CreateProductData
  extends Omit<NewProduct, "id" | "createdAt" | "updatedAt"> {}

export interface UpdateProductData
  extends Partial<Omit<Product, "id" | "createdAt" | "updatedAt">> {}

export interface ProductWithRelations extends Product {
  vendor: {
    id: string;
    businessName: string;
    slug: string;
  };
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  variants?: Array<{
    id: string;
    title: string;
    price: string | null;
    quantity: number;
    isActive: boolean;
  }>;
}

export interface ProductStats {
  totalProducts: number;
  activeProducts: number;
  outOfStockProducts: number;
  lowStockProducts: number;
  averagePrice: number;
}

export class ProductRepository extends BaseRepository<
  Product,
  NewProduct,
  UpdateProductData
> {
  protected table = products;
  protected idColumn = products.id;

  constructor(db: Database) {
    super(db);
  }

  // Find product by slug
  async findBySlug(slug: string): Promise<Product | null> {
    const result = await this.db
      .select()
      .from(products)
      .where(eq(products.slug, slug))
      .limit(1);

    return result[0] || null;
  }

  // Find product by SKU
  async findBySku(sku: string): Promise<Product | null> {
    const result = await this.db
      .select()
      .from(products)
      .where(eq(products.sku, sku))
      .limit(1);

    return result[0] || null;
  }

  // Find products by vendor
  async findByVendor(vendorId: string): Promise<Product[]> {
    return this.db
      .select()
      .from(products)
      .where(eq(products.vendorId, vendorId))
      .orderBy(desc(products.createdAt));
  }

  // Find products by category
  async findByCategory(categoryId: string): Promise<Product[]> {
    return this.db
      .select()
      .from(products)
      .where(eq(products.categoryId, categoryId))
      .orderBy(desc(products.createdAt));
  }

  // Find product with all relations
  async findWithRelations(id: string): Promise<ProductWithRelations | null> {
    const result = await this.db
      .select({
        // Product fields
        id: products.id,
        vendorId: products.vendorId,
        categoryId: products.categoryId,
        name: products.name,
        slug: products.slug,
        description: products.description,
        shortDescription: products.shortDescription,
        price: products.price,
        compareAtPrice: products.compareAtPrice,
        costPrice: products.costPrice,
        sku: products.sku,
        barcode: products.barcode,
        trackQuantity: products.trackQuantity,
        quantity: products.quantity,
        lowStockThreshold: products.lowStockThreshold,
        weight: products.weight,
        weightUnit: products.weightUnit,
        dimensions: products.dimensions,
        status: products.status,
        condition: products.condition,
        featured: products.featured,
        images: products.images,
        metaTitle: products.metaTitle,
        metaDescription: products.metaDescription,
        attributes: products.attributes,
        hasVariants: products.hasVariants,
        requiresShipping: products.requiresShipping,
        shippingClass: products.shippingClass,
        taxable: products.taxable,
        taxClass: products.taxClass,
        publishedAt: products.publishedAt,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
        // Vendor fields
        vendor: {
          id: vendors.id,
          businessName: vendors.businessName,
          slug: vendors.slug,
        },
        // Category fields
        category: {
          id: categories.id,
          name: categories.name,
          slug: categories.slug,
        },
      })
      .from(products)
      .innerJoin(vendors, eq(products.vendorId, vendors.id))
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, id))
      .limit(1);

    if (!result[0]) return null;

    // Get variants if product has variants
    let variants: any[] = [];
    if (result[0].hasVariants) {
      variants = await this.db
        .select({
          id: productVariants.id,
          title: productVariants.title,
          price: productVariants.price,
          quantity: productVariants.quantity,
          isActive: productVariants.isActive,
        })
        .from(productVariants)
        .where(eq(productVariants.productId, id));
    }

    return {
      ...result[0],
      variants,
    };
  }

  // Search products with filters
  async findWithFilters(filters: ProductFilters): Promise<Product[]> {
    let query = this.db.select().from(products);

    const conditions = [];

    if (filters.status) {
      conditions.push(eq(products.status, filters.status));
    }

    if (filters.condition) {
      conditions.push(eq(products.condition, filters.condition));
    }

    if (filters.vendorId) {
      conditions.push(eq(products.vendorId, filters.vendorId));
    }

    if (filters.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }

    if (filters.featured !== undefined) {
      conditions.push(eq(products.featured, filters.featured));
    }

    if (filters.minPrice !== undefined) {
      conditions.push(gte(products.price, filters.minPrice.toString()));
    }

    if (filters.maxPrice !== undefined) {
      conditions.push(lte(products.price, filters.maxPrice.toString()));
    }

    if (filters.inStock) {
      conditions.push(
        or(
          eq(products.trackQuantity, false),
          and(eq(products.trackQuantity, true), sql`${products.quantity} > 0`)
        )
      );
    }

    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(products.name, searchTerm),
          ilike(products.description, searchTerm),
          ilike(products.sku, searchTerm)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(desc(products.createdAt));
  }

  // Get featured products
  async getFeaturedProducts(limit: number = 10): Promise<Product[]> {
    return this.db
      .select()
      .from(products)
      .where(and(eq(products.featured, true), eq(products.status, "active")))
      .orderBy(desc(products.createdAt))
      .limit(limit);
  }

  // Get low stock products
  async getLowStockProducts(): Promise<Product[]> {
    return this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.trackQuantity, true),
          sql`${products.quantity} <= ${products.lowStockThreshold}`,
          eq(products.status, "active")
        )
      )
      .orderBy(asc(products.quantity));
  }

  // Get out of stock products
  async getOutOfStockProducts(): Promise<Product[]> {
    return this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.trackQuantity, true),
          eq(products.quantity, 0),
          eq(products.status, "active")
        )
      )
      .orderBy(desc(products.updatedAt));
  }

  // Check if slug exists
  async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    let query = this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, slug));

    if (excludeId) {
      query = query.where(
        and(eq(products.slug, slug), sql`${products.id} != ${excludeId}`)
      );
    }

    const result = await query.limit(1);
    return result.length > 0;
  }

  // Check if SKU exists
  async skuExists(sku: string, excludeId?: string): Promise<boolean> {
    let query = this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, sku));

    if (excludeId) {
      query = query.where(
        and(eq(products.sku, sku), sql`${products.id} != ${excludeId}`)
      );
    }

    const result = await query.limit(1);
    return result.length > 0;
  }

  // Update product status
  async updateStatus(
    id: string,
    status: (typeof productStatusEnum.enumValues)[number]
  ): Promise<Product | null> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    // Set publishedAt when activating
    if (status === "active") {
      updateData.publishedAt = new Date();
    }

    const result = await this.db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();

    return result[0] || null;
  }

  // Update product inventory
  async updateInventory(id: string, quantity: number): Promise<Product | null> {
    const result = await this.db
      .update(products)
      .set({
        quantity,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    return result[0] || null;
  }

  // Bulk update product status
  async bulkUpdateStatus(
    ids: string[],
    status: (typeof productStatusEnum.enumValues)[number]
  ): Promise<Product[]> {
    if (ids.length === 0) return [];

    const result = await this.db
      .update(products)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(inArray(products.id, ids))
      .returning();

    return result;
  }

  // Get product statistics
  async getStatistics(): Promise<ProductStats> {
    const [totalStats, priceStats, stockStats] = await Promise.all([
      this.db
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(case when status = 'active' then 1 end)::int`,
        })
        .from(products),

      this.db
        .select({
          averagePrice: sql<number>`avg(${products.price})::numeric`,
        })
        .from(products)
        .where(eq(products.status, "active")),

      this.db
        .select({
          outOfStock: sql<number>`count(case when track_quantity = true and quantity = 0 then 1 end)::int`,
          lowStock: sql<number>`count(case when track_quantity = true and quantity <= low_stock_threshold and quantity > 0 then 1 end)::int`,
        })
        .from(products)
        .where(eq(products.status, "active")),
    ]);

    return {
      totalProducts: totalStats[0]?.total || 0,
      activeProducts: totalStats[0]?.active || 0,
      outOfStockProducts: stockStats[0]?.outOfStock || 0,
      lowStockProducts: stockStats[0]?.lowStock || 0,
      averagePrice: Number(priceStats[0]?.averagePrice) || 0,
    };
  }

  // Get products by multiple IDs
  async findByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];

    return this.db.select().from(products).where(inArray(products.id, ids));
  }

  // Get products by multiple vendor IDs
  async findByVendorIds(vendorIds: string[]): Promise<Product[]> {
    if (vendorIds.length === 0) return [];

    return this.db
      .select()
      .from(products)
      .where(inArray(products.vendorId, vendorIds))
      .orderBy(desc(products.createdAt));
  }

  // Get products by multiple category IDs
  async findByCategoryIds(categoryIds: string[]): Promise<Product[]> {
    if (categoryIds.length === 0) return [];

    return this.db
      .select()
      .from(products)
      .where(inArray(products.categoryId, categoryIds))
      .orderBy(desc(products.createdAt));
  }

  // Get products by multiple slugs
  async findBySlugs(slugs: string[]): Promise<Product[]> {
    if (slugs.length === 0) return [];

    return this.db.select().from(products).where(inArray(products.slug, slugs));
  }

  // Search products for autocomplete
  async searchForAutocomplete(
    query: string,
    limit: number = 10
  ): Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      price: string;
      image?: string;
    }>
  > {
    const searchTerm = `%${query}%`;

    const result = await this.db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        price: products.price,
        images: products.images,
      })
      .from(products)
      .where(
        and(
          eq(products.status, "active"),
          or(ilike(products.name, searchTerm), ilike(products.sku, searchTerm))
        )
      )
      .limit(limit);

    return result.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      image:
        Array.isArray(product.images) && product.images.length > 0
          ? product.images[0]
          : undefined,
    }));
  }
}

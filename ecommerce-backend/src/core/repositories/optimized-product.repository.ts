/**
 * Optimized Product Repository
 * Extends OptimizedBaseRepository with product-specific optimizations
 */

import { eq, and, or, sql, desc, asc, gte, lte, ilike } from "drizzle-orm";
import {
  OptimizedBaseRepository,
  type QueryOptions,
  type PaginatedResult,
} from "./optimized-base.repository.js";
import {
  MonitorQuery,
  MonitorBatchQuery,
} from "../decorators/query-monitor.decorator.js";
import { Cache } from "../decorators/cache.decorator.js";
import { CacheStrategies } from "../../modules/cache/cache.strategies.js";
import {
  products,
  categories,
  vendors,
  productVariants,
  type Product,
  type NewProduct,
  productStatusEnum,
} from "../database/schema/index.js";

export interface ProductFilters {
  status?: (typeof productStatusEnum.enumValues)[number];
  vendorId?: string;
  categoryId?: string;
  featured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  search?: string;
}

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

export interface ProductSearchResult {
  id: string;
  name: string;
  slug: string;
  price: string;
  image?: string;
  vendor: string;
  category?: string;
}

export class OptimizedProductRepository extends OptimizedBaseRepository<
  Product,
  NewProduct
> {
  protected table = products;
  protected tableName = "products";

  /**
   * Find product by slug with caching
   */
  @MonitorQuery({ description: "findProductBySlug" })
  @Cache({
    strategy: CacheStrategies.PRODUCT,
    keyGenerator: (slug: string) => `product:slug:${slug}`,
  })
  async findBySlug(slug: string): Promise<Product | null> {
    const result = await this.db
      .select()
      .from(products)
      .where(and(eq(products.slug, slug), eq(products.status, "active")))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find product with all relations (optimized with single query)
   */
  @MonitorQuery({ description: "findProductWithRelations" })
  @Cache({
    strategy: CacheStrategies.PRODUCT,
    keyGenerator: (id: string) => `product:relations:${id}`,
  })
  async findWithRelations(id: string): Promise<ProductWithRelations | null> {
    // Use optimized join query
    const result = await this.findWithJoins(
      [
        {
          table: vendors,
          on: eq(products.vendorId, vendors.id),
          type: "inner",
        },
        {
          table: categories,
          on: eq(products.categoryId, categories.id),
          type: "left",
        },
      ],
      {
        filters: { id },
      }
    );

    if (!result[0]) return null;

    const product = result[0];

    // Get variants if product has variants (separate optimized query)
    let variants: any[] = [];
    if (product.hasVariants) {
      variants = await this.db
        .select({
          id: productVariants.id,
          title: productVariants.title,
          price: productVariants.price,
          quantity: productVariants.quantity,
          isActive: productVariants.isActive,
        })
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, id),
            eq(productVariants.isActive, true)
          )
        )
        .orderBy(asc(productVariants.title));
    }

    return {
      ...product,
      variants,
    } as ProductWithRelations;
  }

  /**
   * Search products with advanced filtering and full-text search
   */
  @MonitorQuery({ description: "searchProducts" })
  @Cache({
    strategy: CacheStrategies.SEARCH,
    keyGenerator: (filters: ProductFilters, options: QueryOptions) =>
      `products:search:${JSON.stringify({ filters, options })}`,
  })
  async searchProducts(
    filters: ProductFilters = {},
    options: QueryOptions = {}
  ): Promise<PaginatedResult<ProductSearchResult>> {
    // Build optimized search query with full-text search
    let baseQuery = this.db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        price: products.price,
        images: products.images,
        featured: products.featured,
        createdAt: products.createdAt,
        vendor: {
          businessName: vendors.businessName,
        },
        category: {
          name: categories.name,
        },
        // Add search rank for full-text search
        ...(filters.search && {
          searchRank: sql<number>`
            ts_rank(
              to_tsvector('english', ${products.name} || ' ' || COALESCE(${products.description}, '')),
              plainto_tsquery('english', ${filters.search})
            )
          `,
        }),
      })
      .from(products)
      .innerJoin(
        vendors,
        and(eq(products.vendorId, vendors.id), eq(vendors.status, "approved"))
      )
      .leftJoin(categories, eq(products.categoryId, categories.id));

    // Build WHERE conditions
    const conditions = [eq(products.status, "active")];

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
      // Use full-text search for better performance
      conditions.push(
        sql`to_tsvector('english', ${products.name} || ' ' || COALESCE(${products.description}, '')) 
            @@ plainto_tsquery('english', ${filters.search})`
      );
    }

    // Apply WHERE conditions
    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions));
    }

    // Count query for pagination
    const countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .innerJoin(
        vendors,
        and(eq(products.vendorId, vendors.id), eq(vendors.status, "approved"))
      )
      .where(and(...conditions));

    // Apply sorting
    const {
      sort = [
        { field: "featured", direction: "desc" },
        { field: "createdAt", direction: "desc" },
      ],
    } = options;

    if (filters.search) {
      // Sort by search relevance first, then by other criteria
      baseQuery = baseQuery.orderBy(
        desc(sql`searchRank`),
        desc(products.featured),
        desc(products.createdAt)
      );
    } else {
      const orderBy = sort.map((s) => {
        const column = products[s.field as keyof typeof products];
        return s.direction === "desc" ? desc(column) : asc(column);
      });
      baseQuery = baseQuery.orderBy(...orderBy);
    }

    // Apply pagination
    const { pagination = { page: 1, limit: 20 } } = options;
    const { page = 1, limit = 20 } = pagination;
    const offset = (page - 1) * limit;

    baseQuery = baseQuery.limit(limit).offset(offset);

    // Execute queries
    const [countResult, data] = await Promise.all([countQuery, baseQuery]);

    const total = countResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // Transform results
    const transformedData: ProductSearchResult[] = data.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      price: item.price,
      image:
        Array.isArray(item.images) && item.images.length > 0
          ? item.images[0]
          : undefined,
      vendor: item.vendor.businessName,
      category: item.category?.name,
    }));

    return {
      data: transformedData,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get featured products with caching
   */
  @MonitorQuery({ description: "getFeaturedProducts" })
  @Cache({
    strategy: CacheStrategies.PRODUCT,
    keyGenerator: (limit: number) => `products:featured:${limit}`,
  })
  async getFeaturedProducts(limit: number = 10): Promise<Product[]> {
    return await this.db
      .select()
      .from(products)
      .where(and(eq(products.featured, true), eq(products.status, "active")))
      .orderBy(desc(products.createdAt))
      .limit(limit);
  }

  /**
   * Get products by category with optimized query
   */
  @MonitorQuery({ description: "getProductsByCategory" })
  @Cache({
    strategy: CacheStrategies.PRODUCT,
    keyGenerator: (categoryId: string, options: QueryOptions) =>
      `products:category:${categoryId}:${JSON.stringify(options)}`,
  })
  async getByCategory(
    categoryId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<ProductSearchResult>> {
    return this.searchProducts({ categoryId }, options);
  }

  /**
   * Get products by vendor with optimized query
   */
  @MonitorQuery({ description: "getProductsByVendor" })
  @Cache({
    strategy: CacheStrategies.PRODUCT,
    keyGenerator: (vendorId: string, options: QueryOptions) =>
      `products:vendor:${vendorId}:${JSON.stringify(options)}`,
  })
  async getByVendor(
    vendorId: string,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<ProductSearchResult>> {
    return this.searchProducts({ vendorId }, options);
  }

  /**
   * Get low stock products for inventory management
   */
  @MonitorQuery({ description: "getLowStockProducts" })
  @Cache({
    strategy: CacheStrategies.ANALYTICS,
    keyGenerator: () => "products:low-stock",
  })
  async getLowStockProducts(): Promise<Product[]> {
    return await this.db
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

  /**
   * Get product statistics with caching
   */
  @MonitorQuery({ description: "getProductStatistics" })
  @Cache({
    strategy: CacheStrategies.ANALYTICS,
    keyGenerator: () => "products:statistics",
  })
  async getStatistics(): Promise<{
    totalProducts: number;
    activeProducts: number;
    outOfStockProducts: number;
    lowStockProducts: number;
    averagePrice: number;
    topCategories: Array<{
      categoryId: string;
      categoryName: string;
      count: number;
    }>;
  }> {
    const [basicStats, stockStats, priceStats, categoryStats] =
      await Promise.all([
        // Basic counts
        this.db
          .select({
            total: sql<number>`count(*)::int`,
            active: sql<number>`count(case when status = 'active' then 1 end)::int`,
          })
          .from(products),

        // Stock statistics
        this.db
          .select({
            outOfStock: sql<number>`count(case when track_quantity = true and quantity = 0 then 1 end)::int`,
            lowStock: sql<number>`count(case when track_quantity = true and quantity <= low_stock_threshold and quantity > 0 then 1 end)::int`,
          })
          .from(products)
          .where(eq(products.status, "active")),

        // Price statistics
        this.db
          .select({
            averagePrice: sql<number>`avg(${products.price})::numeric`,
          })
          .from(products)
          .where(eq(products.status, "active")),

        // Top categories
        this.db
          .select({
            categoryId: products.categoryId,
            categoryName: categories.name,
            count: sql<number>`count(*)::int`,
          })
          .from(products)
          .innerJoin(categories, eq(products.categoryId, categories.id))
          .where(eq(products.status, "active"))
          .groupBy(products.categoryId, categories.name)
          .orderBy(desc(sql`count(*)`))
          .limit(10),
      ]);

    return {
      totalProducts: basicStats[0]?.total || 0,
      activeProducts: basicStats[0]?.active || 0,
      outOfStockProducts: stockStats[0]?.outOfStock || 0,
      lowStockProducts: stockStats[0]?.lowStock || 0,
      averagePrice: Number(priceStats[0]?.averagePrice) || 0,
      topCategories: categoryStats.map((cat) => ({
        categoryId: cat.categoryId!,
        categoryName: cat.categoryName,
        count: cat.count,
      })),
    };
  }

  /**
   * Bulk update product status with optimization
   */
  @MonitorBatchQuery({ description: "bulkUpdateProductStatus" })
  async bulkUpdateStatus(
    ids: string[],
    status: (typeof productStatusEnum.enumValues)[number]
  ): Promise<Product[]> {
    if (ids.length === 0) return [];

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    // Set publishedAt when activating
    if (status === "active") {
      updateData.publishedAt = new Date();
    }

    return await this.updateMany(
      { id: { operator: "in", value: ids } },
      updateData
    );
  }

  /**
   * Update product inventory with stock tracking
   */
  @MonitorQuery({ description: "updateProductInventory" })
  async updateInventory(
    id: string,
    quantity: number,
    operation: "set" | "increment" | "decrement" = "set"
  ): Promise<Product | null> {
    let updateData: any = {
      updatedAt: new Date(),
    };

    if (operation === "set") {
      updateData.quantity = quantity;
    } else {
      // Use SQL for atomic increment/decrement
      const operator = operation === "increment" ? "+" : "-";
      updateData.quantity = sql`${products.quantity} ${sql.raw(
        operator
      )} ${quantity}`;
    }

    return await this.update(id, updateData);
  }

  /**
   * Get product autocomplete suggestions
   */
  @MonitorQuery({ description: "getProductAutocomplete" })
  @Cache({
    strategy: CacheStrategies.SEARCH,
    keyGenerator: (query: string, limit: number) =>
      `products:autocomplete:${query}:${limit}`,
  })
  async getAutocomplete(
    query: string,
    limit: number = 10
  ): Promise<ProductSearchResult[]> {
    const searchTerm = `%${query}%`;

    const result = await this.db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        price: products.price,
        images: products.images,
        vendor: {
          businessName: vendors.businessName,
        },
      })
      .from(products)
      .innerJoin(vendors, eq(products.vendorId, vendors.id))
      .where(
        and(
          eq(products.status, "active"),
          eq(vendors.status, "approved"),
          or(ilike(products.name, searchTerm), ilike(products.sku, searchTerm))
        )
      )
      .orderBy(desc(products.featured), desc(products.createdAt))
      .limit(limit);

    return result.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      price: item.price,
      image:
        Array.isArray(item.images) && item.images.length > 0
          ? item.images[0]
          : undefined,
      vendor: item.vendor.businessName,
    }));
  }

  /**
   * Check if slug is available
   */
  @MonitorQuery({ description: "checkProductSlugAvailability" })
  @Cache({
    strategy: CacheStrategies.API_RESPONSE,
    ttl: 300,
    keyGenerator: (slug: string, excludeId?: string) =>
      `products:slug-check:${slug}:${excludeId || "new"}`,
  })
  async isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
    const conditions = [eq(products.slug, slug)];

    if (excludeId) {
      conditions.push(sql`${products.id} != ${excludeId}`);
    }

    const result = await this.db
      .select({ id: products.id })
      .from(products)
      .where(and(...conditions))
      .limit(1);

    return result.length === 0;
  }
}
